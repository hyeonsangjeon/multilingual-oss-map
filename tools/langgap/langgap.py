#!/usr/bin/env python3
"""langgap — does your repo document in one language but discuss in another?

Detects the language of a repository's README and of its issues/pull-request text
using a multi-classifier consensus (the same idea as the map: N detectors must
agree, "strictness"), then places the result inside the 40M-repo
GitHub Multilingual Repositories landscape aggregated by this project — the rank
of your language across READMEs / issues / PRs, and whether you sit in the
"non-English issues, no non-English README" gap population the map is about.

Emits a human report, machine JSON, a shields.io endpoint badge, and a
self-contained SVG badge you can drop straight into a README.

Design goals: dependency-light (pure-Python detectors), offline-testable
(--readme / --issues-text), no network required unless you pass --repo.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

# ── detector layer ────────────────────────────────────────────────────────────
# Each detector maps text -> uppercase ISO 639-1 code (or None). We keep them
# separate and require k of them to agree, mirroring the dataset's
# fasttext / gcld3 / lingua-py "at least k classifiers" strictness.

_LINGUA = None
_FASTTEXT = None
_FASTTEXT_TRIED = False
FT_MODEL_URL = "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz"


def _norm(code):
    if not code:
        return None
    code = code.strip().lower().replace("__label__", "")
    code = code.split("-")[0].split("_")[0]
    # a few 639-3 / alias fixups so detectors share one label space
    alias = {"zho": "zh", "kor": "ko", "jpn": "ja", "por": "pt", "iw": "he",
             "in": "id", "nb": "no", "nn": "no"}
    code = alias.get(code, code)
    return code.upper() if len(code) == 2 else (code.upper() if code else None)


def _lingua_detect(text):
    global _LINGUA
    if _LINGUA is None:
        from lingua import LanguageDetectorBuilder
        _LINGUA = LanguageDetectorBuilder.from_all_languages().build()
    lang = _LINGUA.detect_language_of(text)
    return _norm(lang.iso_code_639_1.name) if lang else None


def _langid_detect(text):
    import langid
    return _norm(langid.classify(text)[0])


def _fasttext_model():
    """Load lid.176.ftz, downloading (~917 KB) to a cache dir once. Optional."""
    global _FASTTEXT, _FASTTEXT_TRIED
    if _FASTTEXT_TRIED:
        return _FASTTEXT
    _FASTTEXT_TRIED = True
    try:
        import fasttext
    except Exception:
        return None
    cache = Path(os.environ.get("LANGGAP_CACHE",
                                Path.home() / ".cache" / "langgap"))
    cache.mkdir(parents=True, exist_ok=True)
    model_path = cache / "lid.176.ftz"
    if not model_path.exists():
        env = os.environ.get("LANGGAP_FT_MODEL")
        if env and Path(env).exists():
            model_path = Path(env)
        else:
            try:
                urllib.request.urlretrieve(FT_MODEL_URL, model_path)
            except Exception:
                return None
    try:
        fasttext.FastText.eprint = lambda *a, **k: None  # silence banner
        _FASTTEXT = fasttext.load_model(str(model_path))
    except Exception:
        _FASTTEXT = None
    return _FASTTEXT


def _fasttext_detect(text):
    model = _fasttext_model()
    if model is None:
        return None
    # Call the C++ binding directly: model.predict() wraps results in
    # np.array(probs, copy=False), which raises under NumPy >= 2. The binding
    # returns [(prob, "__label__xx"), ...] and skips numpy entirely.
    res = model.f.predict(text.replace("\n", " "), 1, 0.0, "strict")
    return _norm(res[0][1]) if res else None


def _selftest(fn):
    """A detector is only usable if it returns a code without raising — this
    auto-drops env-broken detectors (e.g. fasttext under an incompatible NumPy)."""
    try:
        return bool(fn("this is a short english sentence for testing"))
    except Exception:
        return False


def active_detectors(use_fasttext=True):
    """Return the list of (name, fn) detectors that actually work here."""
    candidates = []
    try:
        import lingua  # noqa: F401
        candidates.append(("lingua", _lingua_detect))
    except Exception:
        pass
    try:
        import langid  # noqa: F401
        candidates.append(("langid", _langid_detect))
    except Exception:
        pass
    if use_fasttext and _fasttext_model() is not None:
        candidates.append(("fasttext", _fasttext_detect))
    return [(n, fn) for n, fn in candidates if _selftest(fn)]


def detect_consensus(text, detectors, min_agree):
    """Classify text: return (lang or None, votes dict). A language is accepted
    only if >= min_agree detectors predict it (the winning label)."""
    text = (text or "").strip()
    votes = {}
    if len(text) < 3:
        return None, votes
    preds = []
    for name, fn in detectors:
        try:
            code = fn(text)
        except Exception:
            code = None
        votes[name] = code
        if code:
            preds.append(code)
    if not preds:
        return None, votes
    lang, n = Counter(preds).most_common(1)[0]
    return (lang if n >= min_agree else None), votes


# ── dataset landscape layer ───────────────────────────────────────────────────

def find_data_dir(explicit=None):
    if explicit:
        return Path(explicit)
    here = Path(__file__).resolve()
    for base in [here.parent, *here.parents]:
        cand = base / "site" / "data"
        if (cand / "lang-totals.json").exists():
            return cand
        cand2 = base / "data"
        if (cand2 / "lang-totals.json").exists():
            return cand2
    # bundled fallback next to this script
    local = here.parent / "data"
    if (local / "lang-totals.json").exists():
        return local
    raise FileNotFoundError(
        "Could not locate site/data (lang-totals.json). Pass --data DIR.")


class Landscape:
    def __init__(self, data_dir):
        self.dir = Path(data_dir)
        self.meta = self._load("meta.json")
        self.totals = self._load("lang-totals.json")
        self.mech = self._load("asymmetry-mechanism.json")
        self.names = self.meta.get("lang_names", {})

    def _load(self, name):
        return json.loads((self.dir / name).read_text(encoding="utf-8"))

    def name_of(self, code):
        if not code:
            return "unclassified"
        if code == "EN":
            return "English"
        return self.names.get(code, code)

    def rank(self, source, strictness, code):
        """(rank, count, total_langs) for code in a source at a strictness."""
        rows = self.totals.get(source, {}).get(str(strictness), [])
        for r in rows:
            if r["lang"] == code:
                return r.get("rank"), r.get("count"), len(rows)
        return None, None, len(rows)

    def gap_share(self, strictness, code):
        """Share of that language's *issue* repos with no non-English README."""
        for r in self.mech.get("issue_no_readme", {}).get(str(strictness), []):
            if r["lang"] == code:
                repos, no_readme = r["issue_repos"], r["no_readme"]
                return no_readme, repos, (no_readme / repos if repos else None)
        return None, None, None

    def paired_agreement(self, strictness):
        p = self.mech.get("paired", {}).get(str(strictness))
        if not p or not p.get("paired"):
            return None
        return p["agree"] / p["paired"], p["agree"], p["paired"]


# ── github fetch layer (only used with --repo) ────────────────────────────────

def _api(url, token=None):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "langgap",
        **({"Authorization": f"Bearer {token}"} if token else {}),
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_readme(repo, token=None):
    try:
        data = _api(f"https://api.github.com/repos/{repo}/readme", token)
        return base64.b64decode(data.get("content", "")).decode("utf-8", "replace")
    except Exception:
        return ""


def fetch_issue_samples(repo, token=None, limit=30):
    """Most-commented issues' title+body (mirrors the dataset's 'most-commented
    issue' basis). Returns list of text snippets."""
    url = (f"https://api.github.com/repos/{repo}/issues"
           f"?state=all&sort=comments&direction=desc&per_page={min(limit,100)}")
    try:
        items = _api(url, token)
    except Exception:
        return []
    out = []
    for it in items:
        if it.get("pull_request"):
            continue
        text = f"{it.get('title','')} {it.get('body') or ''}".strip()
        if text:
            out.append(text)
    return out


# ── snippet helper: mirror the dataset's first-150-chars basis ────────────────

def head150(text):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    return text[:150]


def dominant_issue_language(samples, detectors, min_agree):
    """Classify each sample's first 150 chars; return dominant non-English code,
    plus counts, mirroring 'repo classified as non-English issue language X'."""
    per = []
    for s in samples:
        lang, _ = detect_consensus(head150(s), detectors, min_agree)
        per.append(lang)
    non_en = [x for x in per if x and x != "EN"]
    dom = Counter(non_en).most_common(1)
    return (dom[0][0] if dom else None), Counter(per), len(samples)


# ── report assembly ───────────────────────────────────────────────────────────

def build_result(readme_text, issue_samples, land, detectors, strictness,
                 repo=None):
    n_active = len(detectors)
    min_agree = min(strictness, n_active) if n_active else strictness

    readme_lang, readme_votes = detect_consensus(
        head150(readme_text), detectors, min_agree)
    issue_lang, issue_dist, n_samples = dominant_issue_language(
        issue_samples, detectors, min_agree)

    # gap classification (the project's finding)
    if issue_lang and issue_lang != "EN":
        if readme_lang == issue_lang:
            status = "aligned"        # documents & discusses in the same language
        elif readme_lang in (None, "EN"):
            status = "gap"            # non-English issues, no non-English README
        else:
            status = "mixed"         # README one non-English lang, issues another
    else:
        status = "english_or_none"

    focus = issue_lang if (issue_lang and issue_lang != "EN") else readme_lang
    context = None
    if focus and focus != "EN":
        rr = land.rank("readme", strictness, focus)
        ir = land.rank("issue", strictness, focus)
        pr = land.rank("pull_request", strictness, focus)
        no_readme, issue_repos, share = land.gap_share(strictness, focus)
        agree = land.paired_agreement(strictness)
        context = {
            "lang": focus, "name": land.name_of(focus),
            "readme_rank": rr[0], "readme_count": rr[1],
            "issue_rank": ir[0], "issue_count": ir[1],
            "pr_rank": pr[0], "pr_count": pr[1],
            "no_readme": no_readme, "issue_repos": issue_repos,
            "no_readme_share": share,
            "paired_agreement": agree[0] if agree else None,
        }

    return {
        "repo": repo,
        "strictness": strictness,
        "detectors": [n for n, _ in detectors],
        "min_agree": min_agree,
        "readme_language": readme_lang,
        "readme_language_name": land.name_of(readme_lang),
        "readme_votes": readme_votes,
        "issue_language": issue_lang,
        "issue_language_name": land.name_of(issue_lang) if issue_lang else "unclassified",
        "issue_samples": n_samples,
        "issue_distribution": {(k or "none"): v for k, v in issue_dist.items()},
        "status": status,
        "context": context,
        "snapshot_day": land.meta.get("snapshot_day"),
    }


STATUS_LINE = {
    "gap": "GAP — documented in {readme}, discussed in {issue}",
    "aligned": "ALIGNED — documented and discussed in {issue}",
    "mixed": "MIXED — README reads {readme}, issues read {issue}",
    "english_or_none": "No non-English issue signal detected",
}


def human_report(res, land):
    rl = res["readme_language_name"]
    il = res["issue_language_name"]
    L = []
    head = res["repo"] or "(local input)"
    L.append(f"langgap · {head}")
    L.append("=" * max(24, len(head) + 10))
    line = STATUS_LINE[res["status"]].format(readme=rl, issue=il)
    L.append(line)
    L.append("")
    L.append(f"  README  language : {rl}")
    L.append(f"  issue   language : {il}"
             + (f"  ({res['issue_samples']} issues sampled)" if res["issue_samples"] else ""))
    L.append(f"  strictness       : {res['strictness']} "
             f"({res['min_agree']} of {len(res['detectors'])} detectors must agree: "
             f"{', '.join(res['detectors'])})")
    c = res["context"]
    if c:
        L.append("")
        L.append(f"  Where {c['name']} sits in the 40M-repo landscape "
                 f"(all-{res['strictness']} classifier agreement):")
        if c["issue_rank"]:
            L.append(f"    · #{c['issue_rank']} non-English language in issues "
                     f"({c['issue_count']:,} repos)")
        if c["readme_rank"]:
            L.append(f"    · #{c['readme_rank']} in READMEs ({c['readme_count']:,} repos)")
        if c["pr_rank"]:
            L.append(f"    · #{c['pr_rank']} in pull requests ({c['pr_count']:,} repos)")
        if c["no_readme_share"] is not None and res["status"] in ("gap", "mixed"):
            L.append("")
            L.append(f"    You're in the gap population: "
                     f"{c['no_readme_share']*100:.1f}% of {c['name']}-issue repos "
                     f"({c['no_readme']:,} of {c['issue_repos']:,}) have "
                     f"no non-English README — exactly what this map is about.")
        if c["paired_agreement"] is not None:
            L.append(f"    (When a repo IS non-English on both surfaces, the two "
                     f"languages agree {c['paired_agreement']*100:.1f}% of the time — "
                     f"the gap is compositional, not register-switching.)")
    L.append("")
    L.append(f"  data snapshot: {res['snapshot_day']} · "
             f"GitHub Multilingual Repositories Dataset (CC0-1.0)")
    return "\n".join(L)


def emit_github(res, land):
    """Set step outputs + append a summary when running inside GitHub Actions."""
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        label, message, color = _short(res, land)
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"status={res['status']}\n")
            f.write(f"readme_language={res['readme_language'] or ''}\n")
            f.write(f"issue_language={res['issue_language'] or ''}\n")
            f.write(f"badge_message={message}\n")
            f.write(f"badge_color={color}\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("### langgap — README ↔ issue language gap\n\n")
            f.write("```\n" + human_report(res, land) + "\n```\n")


# ── badges ────────────────────────────────────────────────────────────────────

def _short(res, land):
    rl = res["readme_language"]
    il = res["issue_language"]
    rl_d = "EN" if rl == "EN" else (rl or "—")
    il_d = "EN" if il == "EN" else (il or "—")
    if res["status"] == "gap":
        return "README ↔ issues", f"{rl_d} · {il_d} — gap", "orange"
    if res["status"] == "aligned":
        return "README ↔ issues", f"{il_d} · aligned", "brightgreen"
    if res["status"] == "mixed":
        return "README ↔ issues", f"{rl_d} · {il_d} — mixed", "yellow"
    return "README ↔ issues", f"{rl_d} · —", "lightgrey"


def badge_endpoint(res, land):
    label, message, color = _short(res, land)
    return {"schemaVersion": 1, "label": label, "message": message,
            "color": color, "labelColor": "555",
            "cacheSeconds": 21600}


_HEX = {"orange": "#fe7d37", "brightgreen": "#4c1", "yellow": "#dfb317",
        "lightgrey": "#9f9f9f"}


def badge_svg(res, land):
    label, message, color = _short(res, land)
    fill = _HEX.get(color, "#9f9f9f")
    lw = int(len(label) * 6.5) + 22
    mw = int(len(message) * 6.5) + 22
    w = lw + mw

    def esc(s):
        return (s.replace("&", "&amp;").replace("<", "&lt;")
                 .replace(">", "&gt;"))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="20" role="img" aria-label="{esc(label)}: {esc(message)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="{w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{lw}" height="20" fill="#555"/>
    <rect x="{lw}" width="{mw}" height="20" fill="{fill}"/>
    <rect width="{w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="{lw/2:.0f}" y="15" fill="#010101" fill-opacity=".3">{esc(label)}</text>
    <text x="{lw/2:.0f}" y="14">{esc(label)}</text>
    <text x="{lw + mw/2:.0f}" y="15" fill="#010101" fill-opacity=".3">{esc(message)}</text>
    <text x="{lw + mw/2:.0f}" y="14">{esc(message)}</text>
  </g>
</svg>'''


# ── cli ───────────────────────────────────────────────────────────────────────

def read_local_readme():
    for p in sorted(Path(".").glob("README*")):
        if p.is_file():
            return p.read_text(encoding="utf-8", errors="replace")
    return ""


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="langgap",
        description="Does your repo document in one language but discuss in "
                    "another? Detect the README↔issue language gap and place it "
                    "in the 40M-repo multilingual-oss-map landscape.")
    ap.add_argument("--repo", help="owner/name — fetch README + issues via the GitHub API")
    ap.add_argument("--readme", help="path to a README file (offline mode)")
    ap.add_argument("--readme-text", help="README text directly (offline mode)")
    ap.add_argument("--issues-text",
                    help="issue/PR text samples, separated by '||' (offline mode)")
    ap.add_argument("--strictness", type=int, choices=[1, 2, 3], default=3,
                    help="classifier agreement to require / compare against (default 3 = all-3)")
    ap.add_argument("--issues-limit", type=int, default=30,
                    help="how many most-commented issues to sample in --repo mode")
    ap.add_argument("--data", help="path to site/data (auto-detected in-repo)")
    ap.add_argument("--no-fasttext", action="store_true",
                    help="skip the optional fasttext detector")
    ap.add_argument("--token", help="GitHub token (else $GITHUB_TOKEN)")
    ap.add_argument("--json", action="store_true", help="print machine-readable JSON")
    ap.add_argument("--github", action="store_true",
                    help="write step outputs/summary when run inside GitHub Actions")
    ap.add_argument("--badge", help="write a shields.io endpoint badge JSON to this path")
    ap.add_argument("--svg", help="write a self-contained SVG badge to this path")
    args = ap.parse_args(argv)

    land = Landscape(find_data_dir(args.data))
    detectors = active_detectors(use_fasttext=not args.no_fasttext)
    if not detectors:
        print("error: no language detectors available. "
              "pip install -r requirements.txt", file=sys.stderr)
        return 2

    token = args.token or os.environ.get("GITHUB_TOKEN")
    readme_text, issue_samples = "", []
    if args.repo:
        readme_text = fetch_readme(args.repo, token)
        issue_samples = fetch_issue_samples(args.repo, token, args.issues_limit)
    if args.readme:
        readme_text = Path(args.readme).read_text(encoding="utf-8", errors="replace")
    if args.readme_text:
        readme_text = args.readme_text
    if args.issues_text:
        issue_samples = [s for s in args.issues_text.split("||") if s.strip()]
    if not args.repo and not readme_text:
        readme_text = read_local_readme()

    if not readme_text and not issue_samples:
        print("error: no input. Use --repo owner/name, or --readme / "
              "--readme-text / --issues-text.", file=sys.stderr)
        return 2

    res = build_result(readme_text, issue_samples, land, detectors,
                       args.strictness, repo=args.repo)

    if args.badge:
        Path(args.badge).write_text(
            json.dumps(badge_endpoint(res, land), ensure_ascii=False, indent=2),
            encoding="utf-8")
    if args.svg:
        Path(args.svg).write_text(badge_svg(res, land), encoding="utf-8")

    if args.github:
        emit_github(res, land)

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print(human_report(res, land))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

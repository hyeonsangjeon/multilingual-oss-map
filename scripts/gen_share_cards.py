#!/usr/bin/env python3
"""Generate per-language social share cards (OG images) and static HTML unfurl
stubs for the site.

Why this exists
---------------
GitHub Pages is static and social crawlers (X/Twitter, LinkedIn, Slack, Facebook)
do NOT execute JavaScript, so a single-page app cannot set per-language
``og:image``/``og:title`` at runtime. To make a link like
``…/l/ko/`` unfurl with a Korean-specific card we must ship, at build time:

  * a real raster image per language  -> site/public/og/<code>.png  (1200x630)
  * a static HTML stub per language    -> site/public/l/<code>/index.html
      - carries the og:*/twitter:* meta a crawler reads
      - redirects a human into the SPA deep link  ../../?lang=<CODE>

Everything is derived from the committed aggregate JSON (site/data/*.json), so
nothing is hand-entered — re-run this after scripts/aggregate.py refreshes the
data. Card text is kept in Latin/English (language names like "Korean") so it
rasterises with the always-present DejaVu/Liberation fonts, no CJK font needed.

Usage
-----
    python3 scripts/gen_share_cards.py           # write SVG+PNG+HTML into site/public
    SITE_URL=https://example.com/x python3 scripts/gen_share_cards.py

Outputs (all under site/public/, copied verbatim to dist/ by Vite):
    og/<code>.svg  og/<code>.png     og/default.svg  og/default.png
    l/<code>/index.html              l/index.html
"""
from __future__ import annotations

import html
import json
import os
import sys
from pathlib import Path

try:
    import cairosvg  # type: ignore
except ImportError:  # pragma: no cover
    sys.exit(
        "cairosvg is required to rasterise the cards: pip install cairosvg\n"
        "(cards render to SVG regardless; PNG is what social crawlers need.)"
    )

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
PUBLIC = ROOT / "site" / "public"
OG_DIR = PUBLIC / "og"
L_DIR = PUBLIC / "l"

SITE_URL = os.environ.get(
    "SITE_URL", "https://hyeonsangjeon.github.io/multilingual-oss-map"
).rstrip("/")

W, H = 1200, 630
STRICT = "3"  # cards show the published all-3 (high-precision) ranking

# ---- palette (mirrors site/src/styles.css tokens + palette.js Okabe–Ito hues) ----
BG0, BG1 = "#16233f", "#0b0f17"
FRAME = "#1c2637"
TEXT = "#e8edf5"
DIM = "#9fb0c8"
FAINT = "#6b7c96"
TILE_BG = "#121826"
TILE_LINE = "#263248"
C_README = "#4cc9f0"  # cyan
C_ISSUE = "#ffb703"   # amber
C_PR = "#6ee7a8"      # green
GOLD = "#ffd166"      # story / discussed-more accent
FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif"
MONO = "DejaVu Sans Mono, Liberation Mono, monospace"

HUES = ["#E69F00", "#56B4E9", "#009E73", "#F0E442",
        "#0072B2", "#D55E00", "#E7298A", "#CC3311"]
OTHER_HUE = "#8A94A6"

SOURCES = ["readme", "issue", "pull_request"]
SRC_LABEL = {"readme": "README", "issue": "ISSUES", "pull_request": "PULL REQUESTS"}
SRC_COLOR = {"readme": C_README, "issue": C_ISSUE, "pull_request": C_PR}


def load():
    meta = json.loads((DATA / "meta.json").read_text())
    lt = json.loads((DATA / "lang-totals.json").read_text())
    regions = json.loads((DATA / "lang-regions.json").read_text())["regions"]
    return meta, lt, regions


def ordinal(n):
    if n is None:
        return "\u2014"
    v = n % 100
    if 11 <= v <= 13:
        return f"{n}th"
    return f"{n}" + {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def commas(n):
    return f"{n:,}" if n is not None else "\u2014"


def esc(s):
    return html.escape(str(s), quote=True)


def text(x, y, size, fill, s, *, weight=400, anchor="start",
         family=FONT, spacing=None, opacity=None):
    attrs = [
        f'x="{x}"', f'y="{y}"', f'font-size="{size}"',
        f'font-family="{family}"', f'fill="{fill}"',
        f'font-weight="{weight}"', f'text-anchor="{anchor}"',
    ]
    if spacing is not None:
        attrs.append(f'letter-spacing="{spacing}"')
    if opacity is not None:
        attrs.append(f'opacity="{opacity}"')
    return f'<text {" ".join(attrs)}>{s}</text>'


def frame_svg(body):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <radialGradient id="bg" cx="72%" cy="-6%" r="105%">
      <stop offset="0" stop-color="{BG0}"/>
      <stop offset="0.55" stop-color="{BG1}"/>
      <stop offset="1" stop-color="{BG1}"/>
    </radialGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#bg)"/>
  <rect x="22" y="22" width="{W-44}" height="{H-44}" rx="28" fill="none" stroke="{FRAME}" stroke-width="1.5"/>
{body}
</svg>"""


def header_svg():
    return (
        f'<rect x="70" y="74" width="22" height="22" rx="5" fill="{C_README}"/>'
        + text(104, 92, 26, FAINT, "MULTILINGUAL-OSS-MAP", weight=700,
               family=MONO, spacing="3")
        + text(W - 70, 92, 22, FAINT,
               "hyeonsangjeon.github.io/multilingual-oss-map",
               anchor="end", family=MONO)
    )


def footer_svg():
    return text(
        70, 588, 23, FAINT,
        "Built from the GitHub Multilingual Repositories Dataset (CC0) \u00b7 English excluded",
    )


def tiles_svg(tiles):
    """tiles: list of (label, color, big, small) length 3, left→right."""
    gap = 24
    pad = 70
    tw = (W - 2 * pad - 2 * gap) / 3
    ty = 360
    th = 150
    out = []
    for i, (label, color, big, small) in enumerate(tiles):
        tx = pad + i * (tw + gap)
        out.append(
            f'<rect x="{tx:.1f}" y="{ty}" width="{tw:.1f}" height="{th}" rx="18" '
            f'fill="{TILE_BG}" stroke="{TILE_LINE}" stroke-width="1.5"/>'
        )
        out.append(text(tx + 26, ty + 44, 23, color, label, weight=700, spacing="1"))
        out.append(text(tx + 26, ty + 106, 58, TEXT, big, weight=800))
        out.append(text(tx + 26, ty + 140, 25, DIM, small, family=MONO))
    return "".join(out)


def lang_card_svg(meta, lt, lang, name, hue):
    def lookup(src):
        for r in lt[src][STRICT]:
            if r["lang"] == lang:
                return r
        return None

    rm, iss, pr = lookup("readme"), lookup("issue"), lookup("pull_request")

    # eyebrow label describing the asymmetry direction
    if rm and iss and iss["rank"] < rm["rank"]:
        label, label_c = "DISCUSSED MORE THAN IT IS DOCUMENTED", GOLD
    elif rm and iss and rm["rank"] < iss["rank"]:
        label, label_c = "DOCUMENTED MORE THAN IT IS DISCUSSED", C_README
    elif rm and iss:
        label, label_c = "DOCUMENTED AND DISCUSSED ALIKE", DIM
    else:
        label, label_c = "IN MULTILINGUAL OPEN SOURCE", DIM

    # numeric hook line with per-source colouring
    parts = []
    if iss:
        parts.append((f"#{iss['rank']} in issues", C_ISSUE))
    if rm:
        parts.append((f"#{rm['rank']} in READMEs", C_README))
    if pr:
        parts.append((f"#{pr['rank']} in PRs", C_PR))
    spans = []
    for i, (t, c) in enumerate(parts):
        if i:
            spans.append(f'<tspan fill="{FAINT}" font-weight="400">  \u00b7  </tspan>')
        spans.append(f'<tspan fill="{c}" font-weight="700">{esc(t)}</tspan>')
    hook = (
        f'<text x="70" y="322" font-size="40" font-family="{FONT}">'
        + "".join(spans)
        + "</text>"
    )

    # code chip, right-aligned on the name row
    code = esc(lang)
    chip_w = 46 + len(lang) * 30
    chip_x = W - 70 - chip_w
    chip = (
        f'<rect x="{chip_x}" y="150" width="{chip_w}" height="58" rx="14" '
        f'fill="#141c2e" stroke="{hue}" stroke-width="2.5"/>'
        + text(chip_x + chip_w / 2, 190, 32, hue, code, weight=700,
               anchor="middle", family=MONO)
    )

    def tile(src, rec):
        return (
            SRC_LABEL[src], SRC_COLOR[src],
            ordinal(rec["rank"]) if rec else "\u2014",
            f"{commas(rec['count'])} repos" if rec else "no data",
        )

    body = (
        header_svg()
        + text(70, 262, 24, label_c, esc(label), weight=700, spacing="2")
        + text(70, 204, 88, TEXT, esc(name), weight=800)
        + chip
        + hook
        + tiles_svg([tile("readme", rm), tile("issue", iss), tile("pull_request", pr)])
        + footer_svg()
    )
    return frame_svg(body)


def default_card_svg(meta):
    body = (
        header_svg()
        + text(70, 190, 54, TEXT, "Do developers document in English,", weight=800)
        + f'<text x="70" y="258" font-size="54" font-family="{FONT}" font-weight="800" fill="{TEXT}">'
        + f'but discuss in their <tspan fill="{GOLD}">mother tongue</tspan>?</text>'
        + text(70, 322, 31, DIM,
               "Korean is #5 in READMEs \u2014 but #1 in issue conversation.")
        + tiles_svg([
            ("REPOSITORIES", C_README, "40M+", "in the dataset"),
            ("CLASSIFIERS", C_PR, "3", "all must agree"),
            ("AGREEMENT", C_ISSUE, "99.8%", "both non-English"),
        ])
        + footer_svg()
    )
    return frame_svg(body)


STUB = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="multilingual-oss-map">
<meta property="og:title" content="{ogtitle}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{ogtitle}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{ogtitle}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<meta http-equiv="refresh" content="0; url={redirect}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%97%BA%EF%B8%8F%3C/text%3E%3C/svg%3E">
<style>html,body{{height:100%;margin:0}}body{{background:#0b0f17;color:#e8edf5;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}}a{{color:#4cc9f0}}</style>
<script>location.replace("{redirect}"+location.hash);</script>
</head>
<body>
<p>Opening the {name} view of <a href="{redirect}">multilingual-oss-map</a>\u2026</p>
</body>
</html>
"""


def write_stub(code_lc, name, title, ogtitle, desc, redirect):
    url = f"{SITE_URL}/l/{code_lc}/"
    image = f"{SITE_URL}/og/{code_lc}.png"
    doc = STUB.format(
        title=esc(title), ogtitle=esc(ogtitle), desc=esc(desc),
        url=esc(url), image=esc(image), redirect=esc(redirect), name=esc(name),
    )
    d = L_DIR / code_lc
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(doc, encoding="utf-8")


def rasterise(svg, png_path):
    cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        write_to=str(png_path),
        output_width=W,
        output_height=H,
    )


def lang_desc(name, rm, iss):
    if rm and iss and iss < rm:
        return (f"{name} ranks #{iss} in issue conversation but #{rm} in READMEs "
                f"across GitHub's 40M+ repositories \u2014 a mother-tongue signal in discussion.")
    if rm and iss and rm < iss:
        return (f"{name} ranks #{rm} in READMEs, ahead of #{iss} in issues \u2014 "
                f"strongest in written documentation. See where non-English open source lives.")
    if rm and iss:
        return f"{name} ranks #{rm} in both READMEs and issues in multilingual open source."
    return f"How {name} appears across READMEs, issues and pull requests in multilingual open source."


def target_langs(lt, regions):
    """Union of the top-12 of each source at strictness 3 that has a map region,
    ordered by README rank then issue rank (stable, story-first)."""
    seen = {}
    for src in SOURCES:
        for r in lt[src][STRICT][:12]:
            if r["lang"] in regions:
                seen.setdefault(r["lang"], True)
    rm_rank = {r["lang"]: r["rank"] for r in lt["readme"][STRICT]}
    iss_rank = {r["lang"]: r["rank"] for r in lt["issue"][STRICT]}
    return sorted(seen, key=lambda l: (rm_rank.get(l, 999), iss_rank.get(l, 999)))


def main():
    meta, lt, regions = load()
    names = meta["lang_names"]
    mappable = [r["lang"] for r in lt["readme"][STRICT] if r["lang"] in regions]
    top8 = mappable[:8]
    hue_of = {lang: HUES[i] for i, lang in enumerate(top8)}

    OG_DIR.mkdir(parents=True, exist_ok=True)
    L_DIR.mkdir(parents=True, exist_ok=True)

    langs = target_langs(lt, regions)
    hub_rows = []
    for lang in langs:
        name = names.get(lang, lang)
        hue = hue_of.get(lang, OTHER_HUE)
        svg = lang_card_svg(meta, lt, lang, name, hue)
        code_lc = lang.lower()
        (OG_DIR / f"{code_lc}.svg").write_text(svg, encoding="utf-8")
        rasterise(svg, OG_DIR / f"{code_lc}.png")

        rm = next((r["rank"] for r in lt["readme"][STRICT] if r["lang"] == lang), None)
        iss = next((r["rank"] for r in lt["issue"][STRICT] if r["lang"] == lang), None)
        desc = lang_desc(name, rm, iss)
        if rm and iss:
            ogtitle = f"{name}: #{iss} in issues, #{rm} in READMEs \u2014 multilingual-oss-map"
        else:
            ogtitle = f"{name} in multilingual open source \u2014 multilingual-oss-map"
        title = f"{name} \u2014 multilingual-oss-map"
        write_stub(code_lc, name, title, ogtitle, desc, f"../../?lang={lang}")
        hub_rows.append((lang, code_lc, name))
        print(f"  card {lang:3s} {name}")

    # default card + base image
    dsvg = default_card_svg(meta)
    (OG_DIR / "default.svg").write_text(dsvg, encoding="utf-8")
    rasterise(dsvg, OG_DIR / "default.png")

    write_hub(hub_rows)
    print(f"\nWrote {len(langs)} language cards + default to {PUBLIC}")


def write_hub(rows):
    items = "\n".join(
        f'    <li><a href="./{code_lc}/">{esc(name)} '
        f'<span style="color:#6b7c96;font-family:monospace">{esc(lang)}</span></a></li>'
        for lang, code_lc, name in rows
    )
    url = f"{SITE_URL}/l/"
    image = f"{SITE_URL}/og/default.png"
    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Share a language \u2014 multilingual-oss-map</title>
<meta name="description" content="Per-language share links for the language map of multilingual open source.">
<link rel="canonical" href="{esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="multilingual-oss-map">
<meta property="og:title" content="Share a language \u2014 multilingual-oss-map">
<meta property="og:description" content="Per-language share links for the language map of multilingual open source.">
<meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{esc(image)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%97%BA%EF%B8%8F%3C/text%3E%3C/svg%3E">
<style>body{{background:#0b0f17;color:#e8edf5;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;max-width:720px;margin:0 auto;padding:48px 24px;line-height:1.6}}a{{color:#4cc9f0;text-decoration:none}}a:hover{{text-decoration:underline}}h1{{font-size:1.4rem}}ul{{columns:2;gap:24px;padding-left:1.1em}}</style>
</head>
<body>
<h1>Share a language</h1>
<p>Each link opens the map focused on that language and unfurls with its own preview card.
Back to the <a href="../">full map</a>.</p>
<ul>
{items}
</ul>
</body>
</html>
"""
    (L_DIR / "index.html").write_text(doc, encoding="utf-8")


if __name__ == "__main__":
    main()

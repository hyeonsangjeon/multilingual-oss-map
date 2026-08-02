# langgap

**Does your project document in one language but get discussed in another?**

`langgap` detects the language of a repository's **README** and of its
**issues / pull requests**, using the same multi-classifier *consensus* idea as
[multilingual-oss-map](../../README.md) (N detectors must agree — "strictness").
It then places your result inside the **40-million-repo GitHub Multilingual
Repositories landscape** this project aggregates: where your language ranks
across READMEs / issues / PRs, and whether you sit in the *"non-English issues,
no non-English README"* gap the map is about.

It prints a human report, machine JSON, a [shields.io](https://shields.io)
endpoint badge, and a self-contained SVG badge for your README.

```text
GAP — documented in English, discussed in Korean

  README  language : English
  issue   language : Korean  (30 issues sampled)
  strictness       : 3 (3 of 3 detectors must agree: lingua, langid, fasttext)

  Where Korean sits in the 40M-repo landscape (all-3 classifier agreement):
    · #1 non-English language in issues (127,993 repos)
    · #5 in READMEs (678,605 repos)
    · #2 in pull requests (166,734 repos)

    You're in the gap population: 73.4% of Korean-issue repos (93,907 of 127,993)
    have no non-English README — exactly what this map is about.
```

## Install

```bash
pip install -r tools/langgap/requirements.txt   # lingua + langid (pure Python)
# optional 3rd classifier for a true all-3 runtime consensus:
pip install fasttext-wheel
```

The two core detectors are pure Python and install anywhere. With only those
two, runtime detection tops out at strictness **2**, but your result is still
compared against the **all-3** landscape by default (the setting that matches
GitHub's published aggregate tables).

## Use

Analyze any repo via the GitHub API (uses `$GITHUB_TOKEN` if set for higher rate
limits):

```bash
python3 tools/langgap/langgap.py --repo octocat/Hello-World
python3 tools/langgap/langgap.py --repo <owner/name> --json
python3 tools/langgap/langgap.py --repo <owner/name> --svg docs/langgap.svg
```

Offline / testable — feed text directly (no network):

```bash
python3 tools/langgap/langgap.py \
  --readme-text "A minimal HTTP client for Python." \
  --issues-text "로그인 토큰이 만료되면 에러가 발생합니다||빌드가 실패합니다 로그 첨부합니다"
```

Run with no input inside a git repo and it reads your local `README*`.

| Flag | Meaning |
| --- | --- |
| `--repo owner/name` | fetch README + most-commented issues via the GitHub API |
| `--readme PATH` / `--readme-text` | supply a README offline |
| `--issues-text "a\|\|b\|\|c"` | supply issue/PR samples offline (`\|\|`-separated) |
| `--strictness {1,2,3}` | classifier agreement to require / compare against (default **3**) |
| `--issues-limit N` | how many most-commented issues to sample (default 30) |
| `--json` / `--svg PATH` / `--badge PATH` | machine JSON / SVG badge / shields endpoint JSON |
| `--no-fasttext` | skip the optional third detector |

## Badge

**Self-contained SVG** — write it, commit it, reference it:

```bash
python3 tools/langgap/langgap.py --repo <owner/name> --svg docs/langgap.svg
```
```markdown
![README ↔ issues](docs/langgap.svg)
```

**shields.io endpoint** — host the JSON (Pages / Gist) and let shields render it:

```bash
python3 tools/langgap/langgap.py --repo <owner/name> --badge langgap.json
```
```markdown
![langgap](https://img.shields.io/endpoint?url=https://YOUR_HOST/langgap.json)
```

Colors: **orange** = gap, **green** = aligned, **yellow** = mixed, **grey** = no
non-English issue signal.

## GitHub Action

```yaml
# .github/workflows/langgap.yml
on: [workflow_dispatch]
jobs:
  langgap:
    runs-on: ubuntu-latest
    permissions: { contents: read, issues: read }
    steps:
      - uses: actions/checkout@v4
      - id: gap
        uses: hyeonsangjeon/multilingual-oss-map/tools/langgap@main
        with:
          strictness: "3"           # 1 | 2 | 3 (all-3, default)
          # badge-svg: docs/langgap.svg   # optional: write a badge to commit
      - run: echo "status=${{ steps.gap.outputs.status }}"
```

The Action writes a report to the run **Summary** and exposes `status`,
`readme_language`, `issue_language`, and `badge_message` outputs. Combine
`badge-svg:` with an auto-commit step to keep a live badge in your README.

## How it decides

- **Snippets** mirror the dataset: the **first 150 characters** of the README
  and of each sampled issue (issues taken **most-commented first**).
- Each detector predicts one language; a label is accepted only when
  **≥ strictness** detectors agree, otherwise the text is *unclassified*.
- **Status:** `gap` = non-English issues but no non-English README · `aligned` =
  same non-English language on both · `mixed` = two different non-English
  languages · `english_or_none` = no non-English issue signal.
- **Landscape** figures (ranks, the "no non-English README" share, the paired
  agreement) come from this repo's committed aggregates in
  [`site/data`](../../site/data), regenerated by `scripts/aggregate.py`.

## Limitations

Language labels are inferred from short text and can be fooled by badges,
templates, code, or mixed-language content. The source dataset contains only
**non-English** classifications, so an English/absent README shows as *"no
non-English README classification"* — never asserted as "written in English."
This is a discovery tool, not a ground-truth benchmark, and must not be used to
infer attributes of the people behind a repository. See
[`docs/methodology.md`](../../docs/methodology.md).

Data: GitHub Multilingual Repositories Dataset (CC0-1.0). Code: MIT.

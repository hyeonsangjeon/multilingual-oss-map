# Progress log — multilingual-oss-map

This file lets the build resume after an interruption. Each phase is committed on completion.

## Status

| Phase | Description | State |
| --- | --- | --- |
| 0 | Repo scaffold | ✅ done |
| 1 | Dataset schema + access notes | ✅ done |
| 2 | Aggregation pipeline (`scripts/aggregate.py`) | ✅ done |
| 3 | Language→region mapping | ✅ done |
| 4 | Map + charts (Vite/D3) | ✅ done |
| 5 | Design (dark, colorblind-safe, mobile) | ✅ done |
| 6 | Docs + Pages deployment | ✅ done |
| 7 | Self-check | ✅ done |

**All phases complete.** Live: <https://hyeonsangjeon.github.io/multilingual-oss-map/>

## Environment (verified)

- Auth: `gh` as `hyeonsangjeon`, scopes include `repo`, `workflow` → can create repo, push, deploy Pages.
- Tooling: git 2.34, node v22, npm 10, python 3.10, duckdb (python) 1.5.5.
- Raw data: 41 classification + 41 metadata parquet shards downloaded to `data-raw/` (~1.1 GB, git-ignored).

## Resume instructions

1. `bash scripts/download_data.sh` — re-fetch raw shards if `data-raw/` is empty.
2. `python3 scripts/aggregate.py` — rebuild `site/data/*.json`.
3. `cd site && npm install && npm run build` — build the dashboard.
4. Continue from the first ⬜ phase above.

## Log

- **PHASE 0** — Scaffolded repo `multilingual-oss-map`: `.gitignore` (excludes raw parquet),
  MIT `LICENSE` + CC0 data note, README draft with required keywords, `scripts/download_data.sh`,
  `docs/`. Verified dataset access and downloaded all shards.
- **PHASE 1** — Verified real schema via DuckDB over all shards (matches dataset README totals
  exactly: 80,657,333 rows / 40,817,528 repos). Wrote `docs/schema-notes.md`. Found the published
  aggregate = all-three-agree, and CJK over-firing at low strictness (decisions D6/D7).
- **PHASE 2** — Wrote `scripts/aggregate.py` (DuckDB). Validates source totals, materializes a
  47M-row consensus table, emits 4 deterministic JSON files in ~23 s. Verified **byte-identical**
  reruns and spot-checked values against GitHub's published tables (issue s3 KO=127,993 exact).
- **PHASE 3** — Hand-authored `scripts/build_regions.py` → `lang-regions.json` (83 languages→151
  countries, ISO-validated, with `broad`/`regional` flags + rationale) and `iso-countries.json`
  (alpha3→numeric/name for TopoJSON). Wrote `docs/language-region-mapping.md` (method + limits).
- **PHASE 4** — Built the Vite/D3 dashboard in `site/`: pub/sub `store`, shared `controls`
  (strictness dial + source tabs), `hero` (dynamic #1 cards + "sharpest example"), `map`
  (Natural-Earth choropleth, Viridis log scale, mobile bar fallback), `slope` (sortable README↔issue
  dumbbell), `detail` (3-source counts, classifier-agreement split, primary langs, star quantiles),
  `timeseries` (stacked area by creation year), `methodology` (§3 constraints), `footer`. Build OK
  (JS 400 kB / 121 kB gz, CSS 10 kB). Rendered headless (Playwright) with **zero console/page
  errors**; reviewed desktop + 390 px mobile. Polished the choropleth colour domain (D8).
- **PHASE 5** — Design pass: confirmed colour-blind-safe Viridis (sequential map) + labelled
  categorical timeseries, dark theme, and the mobile bar-ranking fallback (reviewed at 390 px).
  Added `scroll-margin-top` to the hero so the sticky bar never hides the eyebrow on anchor jumps,
  and `:focus-visible` outlines for keyboard a11y. `prefers-reduced-motion` already respected.
- **PHASE 6** — Wrote `docs/methodology.md` (full method + hard constraints), finalised the README
  (keyword‑rich first paragraph, live‑demo link, `docs/preview.png` hero shot, "what you can
  explore"). Added `.github/workflows/deploy.yml` (Actions: `npm ci` + `vite build` of `site/`,
  base `./`, upload `site/dist`, deploy‑pages). Enabled Pages (build type = GitHub Actions) and set
  the repo homepage to the Pages URL. About + all seven topics confirmed present.
- **PHASE 7** — Wrote `docs/self-check.md`. Verified: byte-identical idempotent re-run (80,657,333
  rows); strictness monotonicity (428 pairs, 0 violations); ranks contiguous; the three sources give
  different rankings; **exact** cross-checks vs GitHub's published all-3 tables (PT/KO README, KO
  issues = 127,993); all four disclaimers shipped in the bundle; 375 px mobile with 0 overflow; live
  Pages URL 200 with zero console/page errors on load + interaction. Three visual passes done
  (colour-domain fix in pass 1, verified in 2, live site confirmed in 3).

## Post-launch polish pass (3 items, each committed separately)

All shipped to the live site (Pages Actions deploy succeeded) and screenshot-verified on desktop
(1300px) and mobile (375px); zero console/page errors on load and on interaction.

- **P1 — Map stays visible on mobile** (`c82a92f`). Narrow screens no longer *replace* the
  choropleth with a bar ranking. The map is always rendered (scaled to width, non-interactive
  overview) and the tappable ranking is appended **below** it. Verified at 375px: map 317×165,
  ranking below, 0 horizontal overflow. (`site/src/map.js`, `site/src/styles.css`)
- **P2 — Default strictness = all-3** (`a99da41`). Was 2-of-3. all-3 matches GitHub's published
  tables, is unaffected by CJK over-firing, and gives the truest/sharpest headline (Korean #5 in
  READMEs → **#1 in issues, 127,993**; issues hero card is Korean, not the Chinese artefact).
  Labels re-marked (all-3 = default, 2-of-3 = "balanced"); rationale in `docs/decisions.md` D9.
  (`site/src/store.js`, `scripts/aggregate.py` → `site/data/meta.json`, `methodology.js`,
  `docs/methodology.md`)
- **P3 — Detail panel pre-selects Korean** (`69883f9`). Panel is filled on first load with the
  headline case; a persistent guide line + always-visible chips keep it clear any language can be
  chosen. Added a `mapInteracted` flag so the choropleth only dims-to-selection after a direct map
  click (0/177 dimmed on load; click-to-focus still works). `docs/decisions.md` D10.
  (`site/src/store.js`, `site/src/map.js`, `site/src/detail.js`, `site/src/styles.css`)

## Second polish pass (4 items, each committed separately)

Screenshot-verified on desktop (1300px) and mobile (375px); zero console/page errors. All figures
recaptured at **all‑3** strictness.

- **R1 — Mobile bar taps drive the map** (`aa8492d`). Tapping a language in the mobile ranking now
  (1) spotlights that language's region on the overview map (white outline via a new `.hl` class,
  others dimmed) and (2) updates the Language detail panel. The map stays display-only. Verified at
  375px: tapping Korean outlines N+S Korea (hl=2), dims 175/177. (`site/src/map.js`,
  `site/src/styles.css`)
- **R2 — Animated hero + supporting figures** (`5eec0b5`). Replaced the flat full-page screenshot
  with `docs/hero-loop.gif` (README→Issues→Pull Requests, the map recolouring, 559 KB, all‑3) plus
  two crops: `docs/korea-tooltip.png` (Korea tooltip: README 5th / Issues 1st / PR 2nd) and
  `docs/asymmetry.png` (dumbbell). Removed the stale `docs/preview.png`. (`README.md`, `docs/*`)
- **R3 — GitHub star button in the topbar** (`3136d0b`). Self-contained anchor (GitHub mark +
  "Star") linking to the repo, no external script; dark-theme toned with gold hover. Collapses to
  icon-only below 620px so 375px does not overflow. (`site/index.html`, `site/src/styles.css`)
- **R4 — Stale "strictness 2" copy audit** (this commit). Swept README/docs/site for pre-all‑3
  wording. Fixed `docs/schema-notes.md` (marked all‑3, not 2‑of‑3, as the site default → D9) and
  `docs/self-check.md` (the top‑3 table + label were still 2‑of‑3, showing Chinese #1 in issues;
  recomputed at all‑3 from `lang-totals.json` → Korean #1 in issues, matching the headline). The
  remaining "2‑of‑3" strings are legitimate (toggle labels, the scale definition, the decision log's
  D6→D9 history, the input spec, and this changelog).

## Colour-encoding redesign + README pass (each item committed separately)

Screenshot- and CVD-verified. The map's colour previously came from a single continuous
Viridis-by-repo-count scale (D8), so colour encoded *count*, not *language*, and the map read as one
green→yellow wash. Reworked per the `수정지시_지도색상_README-1.md` spec; supersedes the PHASE 4/5
"Viridis" map description above.

- **A — Language = hue, volume = discrete lightness** (`39e6b3b`, `1225546`). New
  `site/src/palette.js` fixes the top-8 mappable languages (by all-3 README rank: PT, ES, RU, FR, KO,
  TR, ID, ZH) to distinct Okabe–Ito-based hues, reused across every source tab and strictness so a
  language never changes colour; everything else is a neutral "Other" grey. `site/src/map.js` fills
  each country with `shadeHex(hueForLang, binScale(count))` where `binScale` is a `scaleQuantile`
  (the count distribution is too skewed for equal-width bins). Legend rebuilt as clickable language
  chips + a lightness ramp; tooltip and ranking bars follow the same encoding; borders lifted to a
  faint light stroke. Verified desktop + 375px and under deuteranopia/protanopia (headline
  comparisons — PT vs ES in South America, ZH vs KO in East Asia — stay distinct). D11.
- **Docs** (`002ce99`). `docs/decisions.md` D11 (rationale, Okabe–Ito choice, reddish-purple →
  magenta/red substitution, CVD limitation) + `docs/methodology.md` §5 colour-encoding section.
- **README** (`d07c237` B-4 split first paragraph; `64a56bb` B-1 unofficial/not-affiliated notice;
  `a62678f` B-2 License/Pages/stars badges + one-line star CTA; `5cc66c3` B-3 dataset announcement
  blog link).
- **Figures re-shot at the new palette** (`b2d75e8`, spec C-3/B-5). `docs/hero-loop.gif` (185 KB,
  < 3 MB so it stays a GIF), `docs/korea-tooltip.png`, `docs/asymmetry.png`. Also refreshed
  `docs/self-check.md`'s now-stale "Viridis" / mobile-fallback lines.

## Spotlight card + hero showing select→highlight (follow-up)

User feedback (mobile screenshot, French selected): the hero should show "select a language → only
its regions highlight", ideally with a description card.

- **New site feature** — `site/src/spotlight.js` renders `#map-spotlight`, a card under the map
  shown when `mapInteracted && selectedLang`. Language name + region badge + README/issue/PR
  ranks/counts + cross-source takeaway; hue-coloured left border; `×` clears map focus (keeps
  selection). Wired in `main.js`; container in `index.html`; styles in `styles.css` (`.map-spotlight`,
  `.sl-*`), responsive 3-col rank grid verified at 375 px.
- **Hero rebuilt** — `docs/hero-loop.gif` now cycles ES → KO → FR → PT language selections, each
  spotlighting only that language's regions with the card beneath (topbar hidden, all-3 strictness,
  1000 px, 404 KB, seamless via a PT pre-select). README hero alt/caption + the "Language map"
  bullet updated to describe select→spotlight+card. Decision logged as D12.
- **Verified** — build clean (`index-L7dmyTi9.js`); desktop + 375 px screenshots show the card;
  0 console errors. Shots saved under session files `hero-card/`.

## Time-trend check (null) + language×stack heatmap (follow-up)

Three-step request: (1) test whether the README↔issue asymmetry changes over creation-year,
controlling for issue-density; (2) build a natural-language × programming-language heatmap; (3) build
an asymmetry-timeseries only if step 1 found a real trend.

- **STEP 1 — analysis only, NULL result (D13).** DuckDB over the raw parquet. Uncontrolled, Korean's
  issue rank climbs to #1 for 2021–2025 repos, but README→has-issue coverage falls 7.5 %→1.4 %
  across years (the density confound). On the paired subset (repos with both a non-English README and
  issue at all-3), the per-year issue−README rank gap is **0 for KO/PT/ZH in every year**; within
  paired repos the two languages agree 99.8 %. The asymmetry is compositional (73.4 % of Korean-issue
  repos have English/absent READMEs), not a temporal trend. No code shipped; logged as decision D13.
- **STEP 2 — heatmap shipped (`12fc9c6`, D14).** `scripts/aggregate.py` now emits
  `site/data/lang-stack.json` (12 natural langs × 12 programming langs, counts + per-language totals,
  strictness 1/2/3). `site/src/stack.js` renders a 12×12 grid: rows normalised to a within-language
  share, a separate single-hue **violet discrete** scale (kept apart from the map's hue/lightness
  rule), hover tooltip (language, stack, repo count, share), causal-warning caption. README-based and
  strictness-responsive; independent of the source tab. Wired via data.js/main.js/index.html/styles.css.
- **STEP 3 — not built (per step 1).** No asymmetry-timeseries; the null is recorded instead (D13).
- **Verified** — build clean (`index--Ot0oPnh.js`); desktop + 375 px screenshots; 0 console errors;
  strictness toggle re-renders cells (RU·Python 25.4 %→22.9 % from all-3→≥1). Shots under session
  files `shots/20–22`.

## Timeseries "Share of year" toggle (follow-up)

Added a proportional view to the existing creation-year timeseries — a toggle, not a new section.

- **Toggle shipped.** `site/src/timeseries.js` refactored to a persistent SVG with a local
  `[Repositories] / [Share of year]` control (default = Repositories, mirrors slope.js's local-state
  pattern; independent of source/strictness but re-renders on both). Share mode uses D3
  `stackOffsetExpand` (front-end only — no re-aggregation); y-axis flips to 0–100 %. `#ts-controls`
  added to `index.html`; `.ts-controls`/`.ts-legend`/`.caption.ts-warn` added to `styles.css`.
- **Mode-specific caption + veil.** Share caption carries two warnings absent from the count caption:
  *falling share ≠ decline* (switch back to counts to check), and *recent-year undercounting distorts
  proportions more than counts* (the D13 density confound, README→issue coverage 7.5 %→1.4 %). In
  share mode only, the last two years are dimmed under a veil with a dashed boundary + "recent ·
  undercounted" marker and the caption says don't read the shaded years. Colours pinned across views.
- **Verified** — build clean (`index-DReZpZOV.js`); 13-assertion Playwright check ALL PASS: every
  year sums to 100 % (worst dev 2.2 × 10⁻¹⁶ / 171 blocks), colours identical count↔share (11 bands),
  share y-axis 0–100 %, both caption warnings present, veil drawn in share / hidden in count, all 18
  source × strictness × view combos render, 0 console errors. Desktop + 375 px shots `shots/30–33`.
  Logged as decision D16.

# Self-check — PHASE 7

Automated and visual verification of the build. Re-runnable; all commands below were executed
against the committed tree and the live deployment.

**Live deployment:** <https://hyeonsangjeon.github.io/multilingual-oss-map/> — HTTP 200,
bundle loads (JS 399.9 kB / 121 kB gz, CSS 10.3 kB / 3 kB gz), **zero console or page errors** on
load and on interaction (source switch + strictness change).

## 1. Pipeline determinism (idempotency)

Re-running the aggregation over all 80.6 M rows reproduces **byte-identical** output.

```
sha256sum site/data/*.json > before.sha
python3 scripts/aggregate.py            # DONE. processed 80,657,333 rows in ~24s
sha256sum -c before.sha                 # all 6 files: OK
git status --short site/data/           # (empty — no diff)
```

- Row count assertion in the pipeline holds: **80,657,333** classification rows /
  **40,817,528** distinct repositories (matches the dataset README exactly).

## 2. Aggregate invariants

| Check | Result |
| --- | --- |
| Strictness is cumulative: `count(≥1) ≥ count(≥2) ≥ count(≥3)` per (source, language) | **428 pairs checked, 0 violations** |
| Ranks are contiguous `1..N` in every (source, strictness) list | **pass** |
| The three sources produce different rankings (not collapsed) | **pass** (see below) |

Top‑3 non‑English languages at the default 2‑of‑3 strictness:

| Source | #1 | #2 | #3 |
| --- | --- | --- | --- |
| README | Portuguese | Chinese | Spanish |
| Issues | Chinese | Spanish | Japanese |
| Pull requests | Spanish | Korean | Portuguese |

The README vs issue difference is the project's headline: **Korean is #5 in READMEs but #1 in issues
at all‑3 strictness** (documented sparingly, discussed heavily).

## 3. Cross-check against GitHub's published aggregate

GitHub's published high‑precision tables correspond to our **all‑3 (unanimous)** counts:

| Metric | Ours (all‑3) | Published | Δ |
| --- | --- | --- | --- |
| Portuguese — README | 3,039,107 | 3,039,107 | 0 (0.000 %) |
| Korean — README | 678,605 | 678,605 | 0 (0.000 %) |
| Korean — issues | 127,993 | 127,993 | 0 (0.000 %) |

(French/German diverge ~12–17 %, documented in `docs/methodology.md` §3 as a known discrepancy in
related‑language handling — surfaced, not silently reconciled.)

## 4. Required disclaimers are shipped

Grepping the built bundle (`site/dist/assets/index-*.js`) and `site/data/meta.json`:

- ✓ "language map, not a country map"
- ✓ "not a ground-truth" benchmark
- ✓ "English is excluded"
- ✓ counts are "repositories classified as", never "repositories that use"

The methodology section renders these as first‑class cards; the map legend and captions repeat
"colour marks where a language is spoken — **not** where repositories are located".

## 5. Responsive / accessibility

- **375 px (iPhone):** horizontal overflow = **0 px**, no page errors. The map degrades to a
  horizontal **bar ranking** (Portuguese 3.7 M → Dutch 88 K) using the same colour scale.
- **390 px / 1300 px** reviewed by screenshot; layout reflows (single‑column cards, wrapped tabs).
- `:focus-visible` outlines on all controls; `prefers-reduced-motion` disables transitions.
- Colour encoding is colour‑blind‑safe **Viridis** (sequential); the categorical time series pairs
  colour with a text legend and hover labels.

## 6. Visual review (3 passes, with polish)

1. **Pass 1** — caught the choropleth washing out to "all yellow": the log colour domain was
   anchored at 1 while the smallest shaded count was ~600, so every country landed in Viridis's
   bright half. → **Fixed** to span the visible min–max (decision D8).
2. **Pass 2** — verified the fix (full colour range in use, README vs issue now clearly distinct);
   labelled the middle classifier‑agreement segment; added focus outlines + hero anchor offset.
3. **Pass 3** — reviewed the **live deployed site**: hero, README/PR maps, and the all‑3 slope
   (Korean #5→#1) all render correctly with zero console errors; source + strictness stay reactive.

## 7. Deviations from the spec (recorded, per §8)

- **Deploy via GitHub Actions**, not a committed `docs/` build output (decision D2): `docs/` is
  reserved for Markdown, so the build is produced by `.github/workflows/deploy.yml` and published to
  Pages (build type = GitHub Actions).
- **Playwright** was used only for headless visual QA and was removed from `package.json` /
  `package-lock.json`; the shipped dependency set is d3 + topojson‑client + world‑atlas + Vite.
- Some very small countries (Andorra, San Marino, Vatican, Liechtenstein) are absent from the
  world‑atlas 110 m topology, so regional languages mapped only there do not shade (documented in
  `docs/language-region-mapping.md`).

## Artifact sizes

| Artifact | Size |
| --- | --- |
| `site/data/*.json` (all six) | ~204 kB |
| `dist` JS (gzip) | 399.9 kB (121 kB) |
| `dist` CSS (gzip) | 10.3 kB (3 kB) |

# Progress log — multilingual-oss-map

This file lets the build resume after an interruption. Each phase is committed on completion.

## Status

| Phase | Description | State |
| --- | --- | --- |
| 0 | Repo scaffold | ✅ done |
| 1 | Dataset schema + access notes | ✅ done |
| 2 | Aggregation pipeline (`scripts/aggregate.py`) | ✅ done |
| 3 | Language→region mapping | ✅ done |
| 4 | Map + charts (Vite/D3) | ⏳ in progress |
| 5 | Design (dark, colorblind-safe, mobile) | ⬜ pending |
| 6 | Docs + Pages deployment | ⬜ pending |
| 7 | Self-check | ⬜ pending |

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

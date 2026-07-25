# Progress log — multilingual-oss-map

This file lets the build resume after an interruption. Each phase is committed on completion.

## Status

| Phase | Description | State |
| --- | --- | --- |
| 0 | Repo scaffold | ✅ done |
| 1 | Dataset schema + access notes | ⏳ in progress |
| 2 | Aggregation pipeline (`scripts/aggregate.py`) | ⬜ pending |
| 3 | Language→region mapping | ⬜ pending |
| 4 | Map + charts (Vite/D3) | ⬜ pending |
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

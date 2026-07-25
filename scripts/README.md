# scripts/

Build pipeline for the aggregate JSON the dashboard loads at runtime.

## Files

| Script | Purpose |
| --- | --- |
| `download_data.sh` | Fetch the raw parquet shards (~1.1 GB) into `data-raw/` (git-ignored). |
| `aggregate.py` | DuckDB → deterministic JSON in `site/data/`. |

## Run

```bash
bash scripts/download_data.sh     # ~1.1 GB (41 classification + 41 metadata shards)
python3 -m pip install duckdb pycountry
python3 scripts/aggregate.py      # writes site/data/*.json
```

## Timing (measured)

- **Download:** ~1.1 GB; a couple of minutes on a fast link (6-way parallel, resumable/idempotent).
- **Aggregate:** **~23 s** over all 80,657,333 classification rows on an 8-core / 31 GB box
  (DuckDB, 14 GB memory limit). Peak RAM well under the limit; spills to `data-raw/_duckdb_tmp/`.

Runtime and processed row counts are logged to stdout, e.g.:

```
[   1.9s] classification rows=80,657,333 distinct repos=40,817,528
[  11.6s] consensus rows=46,999,711
[  23.1s] DONE. processed 80,657,333 classification rows in 23.1s
```

## Idempotency

`aggregate.py` is deterministic: outputs contain **no wall-clock timestamp** (timing goes to
stdout only), every array is fully sorted, and medians/quantiles are integers. Running it twice
produces **byte-identical** `site/data/*.json` (verified with `sha256sum`).

## Outputs (`site/data/`)

| File | ~Size | Contents |
| --- | ---: | --- |
| `meta.json` | 4 KB | Snapshot day, totals, provenance, strictness labels, disclaimers, language names. |
| `lang-totals.json` | 47 KB | `source → strictness → [{lang, name, count, rank}]`. |
| `lang-detail.json` | 90 KB | Per language × source: classifier-agreement split, primary-language top-5, star/fork stats. |
| `timeseries.json` | 22 KB | Per `source → strictness`: repos created per year, top-10 langs + `OTHER`. |

All counts are **"repositories classified as language X"** at the chosen classifier-consensus
strictness — never "repositories that use X". See [`../docs/methodology.md`](../docs/methodology.md).

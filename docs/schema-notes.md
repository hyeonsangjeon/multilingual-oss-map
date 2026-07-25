# Dataset schema & access notes (PHASE 1)

> All facts below were verified by **reading the dataset repo docs and querying the real parquet
> shards with DuckDB** — no column names are guessed. Source: the
> [GitHub Multilingual Repositories Dataset](https://github.com/github/multilingual-repositories),
> license **CC0-1.0**.

## Access

- Data lives in the dataset repo under `data/repository_classifications/` and
  `data/repository_metadata/`, as parquet shards `part-0001.parquet … part-0041.parquet`.
- **41 classification shards** (~521 MB) + **41 metadata shards** (~599 MB) ≈ **1.1 GB** total.
- Download with [`scripts/download_data.sh`](../scripts/download_data.sh) → `data-raw/` (git-ignored).
- Query directly with DuckDB: `SELECT ... FROM 'data-raw/classifications/*.parquet'`.
- No pre-materialized "aggregate table" files are shipped — but the dataset **README publishes
  aggregate statistics tables** (per source, all-three-classifier agreement) which we reuse as a
  correctness check (see below), so we do not need to re-derive those from scratch to trust them.

## Table: `repository_classifications` (one row per repository × classification signal)

| Column | DuckDB type | Notes (from real data) |
| --- | --- | --- |
| `repository_id` | `BIGINT` | GitHub repo id. |
| `lang_code` | `VARCHAR` | **Uppercase** ISO-639 code (`PT`, `KO`, `ZH`, `NB`, …). 143 distinct. |
| `confidence` | `DOUBLE` | Always **> 0.5** (min observed 0.500002); non-English only. |
| `source` | `VARCHAR` | `readme` \| `issue` \| `pull_request`. |
| `classifier` | `VARCHAR` | `fasttext` \| `gcld3` \| `linguapy`. |

Verified totals (whole dataset, matches the dataset README exactly):

- **80,657,333** rows across **40,817,528** distinct repositories.
- By source: `readme` 66,177,034 · `pull_request` 9,724,020 · `issue` 4,756,279.
- By classifier: `gcld3` 34,441,896 · `fasttext` 25,909,973 · `linguapy` 20,305,464.
- Shards are **grouped by source** (e.g. `part-0001` is all `issue`), so partial downloads bias the
  source mix — always aggregate over **all** shards.
- **Multiple rows per (repo, source, classifier) exist** (2.4M cases) — partly a classifier emitting
  more than one language, partly **exact-duplicate rows**. All our consensus logic counts
  `COUNT(DISTINCT classifier)`, which is dedup-safe.

## Table: `repository_metadata` (one row per repository)

| Column | DuckDB type | Notes |
| --- | --- | --- |
| `repository_id` | `BIGINT` | Join key. |
| `disk_usage_bytes` | `BIGINT` | |
| `num_public_forks` | `BIGINT` | |
| `num_stars` | `BIGINT` | |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Observed range 2008-03 … 2026-05. |
| `primary_language_name` | `VARCHAR` | Programming language; nullable (`None` common). |
| `spdx_license` | `VARCHAR` | Nullable. |
| `num_pull_requests` | `BIGINT` | |
| `num_issues` | `BIGINT` | |
| `snapshot_day` | `DATE` | Single value **2026-05-01**. |

(The dataset README calls this table `repo_metadata`; the directory is `repository_metadata`.)

## Strictness (classifier consensus)

Per `(repository_id, source, lang_code)` we compute `n = COUNT(DISTINCT classifier)`. A repository
counts for a language at **strictness k** when `n ≥ k`:

- **1** — any one classifier (broad recall)
- **2** — 2-of-3 agree (**site default**, per spec §3.4)
- **3** — all three agree (high precision)

### Correctness check vs the dataset README's published tables

The README's "detected … by at least two classifiers" aggregate tables actually align with our
**strictness-3** counts (all three agree), within ~0.01–1% for most top languages:

| lang | published (README) | our strictness-3 |
| --- | ---: | ---: |
| PT | 3,039,349 | 3,039,107 |
| ES | 2,136,023 | 2,135,806 |
| RU | 1,436,777 | 1,436,703 |
| KO | 678,744 | 678,605 |
| ZH | 221,516 | 219,101 |
| JA | 166,852 | 166,720 |

FR (813,898 vs 711,593) and DE (218,534 vs 180,698) differ more — attributed to related-language
code handling in the source aggregate; recorded as a known discrepancy (docs/decisions.md D7).

### Why the toggle matters (a real finding)

gcld3 and lingua-py **over-classify CJK**: each labels ~3M READMEs as `ZH` where fastText finds
~221k. So at strictness 1–2, `ZH` dominates; at strictness 3 it collapses. The Korean
README-vs-issue asymmetry that motivates this project is sharpest at strictness 3:

```
KO rank —  README: s1=2  s2=5  s3=5   |   Issue: s1=2  s2=4  s3=1
```

## Data-file design (finalized for scripts/aggregate.py)

- `meta.json` — snapshot day, totals, generation time, dataset provenance, English-exclusion note.
- `lang-totals.json` — `{lang, name, source, strictness, repo_count, rank}` for all languages.
- `lang-detail.json` — per language × source: classifier-agreement split (n=1/2/3), primary
  programming-language top-5, median stars & forks (median, not mean — long-tailed).
- `timeseries.json` — repos per `{year, lang, source, strictness}` from `created_at`, top langs + OTHER.
- `lang-regions.json` — language → ISO-3166 country codes (PHASE 3, hand-authored with provenance).

#!/usr/bin/env python3
"""
aggregate.py — build the small JSON files the dashboard loads at runtime.

Reads the raw GitHub Multilingual Repositories Dataset parquet shards from
data-raw/ (see scripts/download_data.sh) with DuckDB and writes deterministic
JSON to site/data/. Heavy work happens here, once; the browser never touches
the 80M-row source.

Consensus / strictness
----------------------
For each (repository_id, source, lang_code) we count DISTINCT classifiers
(fastText / gcld3 / lingua-py) that predicted the language. A repo counts for a
language at strictness k when that count >= k (1 = broad recall, 2 = 2-of-3
balanced, 3 = all-three high precision, default). See docs/schema-notes.md.

Determinism: outputs contain no wall-clock time (timing is logged to stdout),
arrays are fully sorted, medians are integers — so re-runs are byte-identical.
"""
from __future__ import annotations
import json, os, sys, time
from pathlib import Path
import duckdb
import pycountry

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data-raw"
OUT = ROOT / "site" / "data"
CLASS_GLOB = str(RAW / "classifications" / "*.parquet")
META_GLOB = str(RAW / "metadata" / "*.parquet")

SOURCES = ["readme", "issue", "pull_request"]
CLASSIFIERS = ["fasttext", "gcld3", "linguapy"]
# Published dataset README totals — asserted so a bad/partial download fails loudly.
EXPECT_ROWS = 80_657_333
EXPECT_REPOS = 40_817_528
# How many languages get an explicit timeseries line before the rest fold into OTHER.
TS_TOP = 10

LANG_NAME_OVERRIDES = {"IW": "Hebrew"}  # IW = legacy ISO 639-1 code for Hebrew (now HE)

t0 = time.time()
def log(msg: str) -> None:
    print(f"[{time.time() - t0:6.1f}s] {msg}", flush=True)

def lang_name(code: str) -> str:
    if code in LANG_NAME_OVERRIDES:
        return LANG_NAME_OVERRIDES[code]
    o = pycountry.languages.get(alpha_2=code.lower())
    if o is None:
        o = pycountry.languages.get(alpha_3=code.lower())
    return getattr(o, "name", code) if o else code

def write_json(name: str, obj) -> None:
    path = OUT / name
    # compact + sorted keys => deterministic, small
    text = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    log(f"wrote {name} ({path.stat().st_size/1024:.1f} KB)")

def ranked(rows) -> list[dict]:
    """rows: iterable of (lang, count) -> sorted, ranked list of dicts."""
    ordered = sorted(rows, key=lambda r: (-int(r[1]), r[0]))
    out = []
    for i, (lang, cnt) in enumerate(ordered):
        out.append({"lang": lang, "name": lang_name(lang), "count": int(cnt), "rank": i + 1})
    return out


def main() -> int:
    if not Path(CLASS_GLOB.replace("*.parquet", "part-0001.parquet")).exists():
        log("ERROR: raw shards not found. Run scripts/download_data.sh first.")
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = RAW / "_duckdb_tmp"; tmp.mkdir(exist_ok=True)
    con = duckdb.connect(config={
        "threads": str(min(8, os.cpu_count() or 4)),
        "memory_limit": "14GB",
        "temp_directory": str(tmp),
    })

    # ---- validate source ----
    log("validating source totals ...")
    rows = con.sql(f"SELECT count(*) FROM '{CLASS_GLOB}'").fetchone()[0]
    repos = con.sql(f"SELECT count(DISTINCT repository_id) FROM '{CLASS_GLOB}'").fetchone()[0]
    log(f"classification rows={rows:,} distinct repos={repos:,}")
    assert rows == EXPECT_ROWS, f"row count {rows} != expected {EXPECT_ROWS}"
    assert repos == EXPECT_REPOS, f"repo count {repos} != expected {EXPECT_REPOS}"
    by_source = dict(con.sql(
        f"SELECT source, count(*) FROM '{CLASS_GLOB}' GROUP BY 1").fetchall())
    by_classifier = dict(con.sql(
        f"SELECT classifier, count(*) FROM '{CLASS_GLOB}' GROUP BY 1").fetchall())
    snapshot_day = str(con.sql(f"SELECT min(snapshot_day) FROM '{META_GLOB}'").fetchone()[0])

    # ---- materialize consensus + slim metadata once ----
    log("building consensus table (distinct classifiers per repo/source/lang) ...")
    con.sql(f"""
        CREATE TABLE agree AS
        SELECT source, lang_code AS lang, repository_id AS rid,
               count(DISTINCT classifier) AS n
        FROM '{CLASS_GLOB}'
        GROUP BY 1, 2, 3
    """)
    agree_rows = con.sql("SELECT count(*) FROM agree").fetchone()[0]
    log(f"consensus rows={agree_rows:,}")

    log("building slim metadata table ...")
    con.sql(f"""
        CREATE TABLE meta AS
        SELECT repository_id AS rid,
               CAST(extract(year FROM created_at) AS INTEGER) AS yr,
               num_stars, num_public_forks, primary_language_name AS pl
        FROM '{META_GLOB}'
    """)

    # ---- lang-totals: per source x strictness, ranked language counts ----
    log("aggregating lang-totals ...")
    totals = {}
    for src in SOURCES:
        totals[src] = {}
        for k in (1, 2, 3):
            rws = con.sql(
                f"SELECT lang, count(*) FROM agree WHERE source='{src}' AND n>={k} GROUP BY 1"
            ).fetchall()
            totals[src][str(k)] = ranked(rws)
    write_json("lang-totals.json", totals)

    # collect the set of languages we will describe in detail (present anywhere)
    all_langs = [r[0] for r in con.sql("SELECT DISTINCT lang FROM agree").fetchall()]

    # ---- lang-detail: agreement split + programming langs + medians ----
    log("aggregating lang-detail (agreement split) ...")
    # exact agreement buckets per (source, lang): how many repos had n = 1 / 2 / 3
    agr = con.sql("""
        SELECT source, lang,
               count(*) FILTER (WHERE n=1) AS e1,
               count(*) FILTER (WHERE n=2) AS e2,
               count(*) FILTER (WHERE n=3) AS e3
        FROM agree GROUP BY 1, 2
    """).fetchall()
    detail: dict[str, dict] = {L: {} for L in all_langs}
    for src, lang, e1, e2, e3 in agr:
        detail[lang][src] = {
            "agree": {"1": int(e1), "2": int(e2), "3": int(e3)},
            "repos_s2": int(e2 + e3),
            "pl_top5": [],
            "stars_median": None, "stars_mean": None, "stars_p90": None,
            "stars_p99": None, "forks_median": None,
        }

    log("aggregating lang-detail (primary programming language, medians) — join at strictness 2 ...")
    # primary programming language top-5 per (source, lang) over the strictness-2 repo set
    pl_rows = con.sql("""
        WITH j AS (
            SELECT a.source, a.lang, m.pl
            FROM agree a JOIN meta m ON a.rid = m.rid
            WHERE a.n >= 2 AND m.pl IS NOT NULL
        ), c AS (
            SELECT source, lang, pl, count(*) AS cnt FROM j GROUP BY 1, 2, 3
        ), r AS (
            SELECT source, lang, pl, cnt,
                   row_number() OVER (PARTITION BY source, lang ORDER BY cnt DESC, pl) AS rk
            FROM c
        )
        SELECT source, lang, pl, cnt FROM r WHERE rk <= 5 ORDER BY source, lang, rk
    """).fetchall()
    for src, lang, pl, cnt in pl_rows:
        if src in detail.get(lang, {}):
            detail[lang][src]["pl_top5"].append({"name": pl, "count": int(cnt)})

    med_rows = con.sql("""
        SELECT a.source, a.lang,
               CAST(median(m.num_stars) AS BIGINT) AS stars_med,
               CAST(round(avg(m.num_stars), 1) AS DOUBLE) AS stars_mean,
               CAST(quantile_disc(m.num_stars, 0.90) AS BIGINT) AS stars_p90,
               CAST(quantile_disc(m.num_stars, 0.99) AS BIGINT) AS stars_p99,
               CAST(median(m.num_public_forks) AS BIGINT) AS forks_med
        FROM agree a JOIN meta m ON a.rid = m.rid
        WHERE a.n >= 2
        GROUP BY 1, 2
    """).fetchall()
    for src, lang, sm, smean, sp90, sp99, fm in med_rows:
        if src in detail.get(lang, {}):
            d = detail[lang][src]
            d["stars_median"] = int(sm)
            d["stars_mean"] = float(smean)
            d["stars_p90"] = int(sp90)
            d["stars_p99"] = int(sp99)
            d["forks_median"] = int(fm)
    write_json("lang-detail.json", detail)

    # ---- timeseries: repos created per year, per (source, strictness), top langs + OTHER ----
    log("aggregating timeseries (join consensus x metadata on year) ...")
    ts_raw = con.sql("""
        SELECT a.source, a.lang, m.yr,
               count(*) FILTER (WHERE a.n>=1) AS s1,
               count(*) FILTER (WHERE a.n>=2) AS s2,
               count(*) FILTER (WHERE a.n>=3) AS s3
        FROM agree a JOIN meta m ON a.rid = m.rid
        WHERE m.yr IS NOT NULL AND m.yr BETWEEN 2008 AND 2026
        GROUP BY 1, 2, 3
    """).fetchall()
    # index: (source, strictness) -> {lang -> {year -> count}}
    scol = {1: 3, 2: 4, 3: 5}
    timeseries: dict = {s: {} for s in SOURCES}
    for src in SOURCES:
        for k in (1, 2, 3):
            per_lang: dict[str, dict[int, int]] = {}
            years: set[int] = set()
            for row in ts_raw:
                if row[0] != src:
                    continue
                lang, yr, cnt = row[1], int(row[2]), int(row[scol[k]])
                if cnt == 0:
                    continue
                per_lang.setdefault(lang, {})[yr] = per_lang.setdefault(lang, {}).get(yr, 0) + cnt
                years.add(yr)
            totby = sorted(per_lang.items(), key=lambda kv: (-sum(kv[1].values()), kv[0]))
            top = [l for l, _ in totby[:TS_TOP]]
            yr_sorted = sorted(years)
            data = []
            for y in yr_sorted:
                rec = {"year": y}
                other = 0
                for lang, ym in per_lang.items():
                    v = ym.get(y, 0)
                    if lang in top:
                        rec[lang] = v
                    else:
                        other += v
                for l in top:
                    rec.setdefault(l, 0)
                rec["OTHER"] = other
                data.append(rec)
            timeseries[src][str(k)] = {"langs": top + ["OTHER"], "data": data}
    write_json("timeseries.json", timeseries)

    # ---- lang-stack: natural language (README) x primary programming language ----
    # A repo's natural language is taken from its README classification (the map's
    # default lens); its tech stack is metadata.primary_language_name. Axes are the
    # top-12 natural languages and top-12 programming languages at strictness 3, so
    # the grid stays stable while the strictness toggle only re-weights the cells.
    # Cell value in the UI is a within-language share: count / (that language's repos
    # with a known primary language). This is README-based and independent of the
    # source toggle — the stack is a repo attribute, not a property of who is talking.
    log("aggregating lang-stack (natural language x programming language) ...")
    NAT_TOP, PL_TOP = 12, 12
    nat_axis = [r[0] for r in con.sql(
        "SELECT lang, count(*) c FROM agree WHERE source='readme' AND n>=3 "
        f"GROUP BY 1 ORDER BY c DESC, lang LIMIT {NAT_TOP}").fetchall()]
    pl_axis = [r[0] for r in con.sql(
        "SELECT m.pl, count(*) c FROM agree a JOIN meta m ON a.rid=m.rid "
        "WHERE a.source='readme' AND a.n>=3 AND m.pl IS NOT NULL "
        f"GROUP BY 1 ORDER BY c DESC, m.pl LIMIT {PL_TOP}").fetchall()]
    sql_list = lambda xs: "(" + ",".join("'" + x.replace("'", "''") + "'" for x in xs) + ")"
    natset, plset = sql_list(nat_axis), sql_list(pl_axis)
    stack_out = {
        "natural_langs": [{"lang": L, "name": lang_name(L)} for L in nat_axis],
        "prog_langs": pl_axis,
        "by_strictness": {},
    }
    for k in (1, 2, 3):
        tot = dict(con.sql(
            "SELECT a.lang, count(*) FROM agree a JOIN meta m ON a.rid=m.rid "
            f"WHERE a.source='readme' AND a.n>={k} AND m.pl IS NOT NULL "
            f"AND a.lang IN {natset} GROUP BY 1").fetchall())
        cells = con.sql(
            "SELECT a.lang, m.pl, count(*) FROM agree a JOIN meta m ON a.rid=m.rid "
            f"WHERE a.source='readme' AND a.n>={k} AND m.pl IN {plset} "
            f"AND a.lang IN {natset} GROUP BY 1, 2").fetchall()
        per = {L: {"total": int(tot.get(L, 0)), "cells": {}} for L in nat_axis}
        for L, P, c in cells:
            per[L]["cells"][P] = int(c)
        stack_out["by_strictness"][str(k)] = per
    write_json("lang-stack.json", stack_out)

    # ---- asymmetry-mechanism: where the README<->issue asymmetry actually lives ----
    # Two facts behind the headline (see docs/decisions.md D13/D15):
    #   1. Among repositories classified in BOTH a README and an issue (a "paired"
    #      repo), how often is the dominant README language the same as the dominant
    #      issue language? (One number per strictness — it is ~99.8%.)
    #   2. For each language, of the repositories whose ISSUES are classified in it,
    #      what share have NO non-English README classification at all? Because the
    #      dataset holds only non-English labels, "no non-English README" means the
    #      README is English, absent, too short, or below the confidence cut — never
    #      asserted as English. This is where the asymmetry lives: outside the paired
    #      set. Raw integer counts are stored; the UI derives the percentages, so the
    #      output stays byte-identical on re-run.
    log("aggregating asymmetry-mechanism (paired agreement + no-README share) ...")
    mech_order = [r[0] for r in con.sql(
        "SELECT lang, count(DISTINCT rid) c FROM agree WHERE source='issue' AND n>=3 "
        "GROUP BY 1 ORDER BY c DESC, lang LIMIT 12").fetchall()]
    mechanism = {"order": mech_order, "paired": {}, "issue_no_readme": {}, "pair_counts": {}}
    for k in (1, 2, 3):
        mech_rows = con.sql(
            f"WITH iss AS (SELECT DISTINCT lang, rid FROM agree WHERE source='issue' AND n>={k}), "
            f"rd AS (SELECT DISTINCT rid FROM agree WHERE source='readme' AND n>={k}) "
            "SELECT i.lang, count(*) AS issue_repos, "
            "count(*) FILTER (WHERE r.rid IS NULL) AS no_readme "
            "FROM iss i LEFT JOIN rd r USING (rid) GROUP BY 1").fetchall()
        by_lang = {lang: (int(ir), int(nr)) for lang, ir, nr in mech_rows}
        mechanism["issue_no_readme"][str(k)] = [
            {"lang": L, "name": lang_name(L),
             "issue_repos": by_lang.get(L, (0, 0))[0],
             "no_readme": by_lang.get(L, (0, 0))[1]}
            for L in mech_order
        ]
        pr = con.sql(
            f"WITH rd AS (SELECT rid, lang, row_number() OVER (PARTITION BY rid ORDER BY n DESC, lang) rn "
            f"            FROM agree WHERE source='readme' AND n>={k}), "
            f"iss AS (SELECT rid, lang, row_number() OVER (PARTITION BY rid ORDER BY n DESC, lang) rn "
            f"        FROM agree WHERE source='issue' AND n>={k}), "
            "rp AS (SELECT rid, lang FROM rd WHERE rn=1), "
            "ip AS (SELECT rid, lang FROM iss WHERE rn=1), "
            "paired AS (SELECT rp.lang AS rlang, ip.lang AS ilang FROM rp JOIN ip USING (rid)) "
            "SELECT count(*), count(*) FILTER (WHERE rlang=ilang) FROM paired").fetchone()
        mechanism["paired"][str(k)] = {"paired": int(pr[0]), "agree": int(pr[1])}

        # Per-language circle counts for the Venn view: README-primary repos (A),
        # issue-primary repos (B) and their intersection (both), all from the SAME
        # primary-language definition as `paired` above so both <= A and both <= B
        # hold exactly (the diagram's circles stay geometrically valid).
        pc_rows = con.sql(
            f"WITH rd AS (SELECT rid, lang, row_number() OVER (PARTITION BY rid ORDER BY n DESC, lang) rn "
            f"            FROM agree WHERE source='readme' AND n>={k}), "
            f"iss AS (SELECT rid, lang, row_number() OVER (PARTITION BY rid ORDER BY n DESC, lang) rn "
            f"        FROM agree WHERE source='issue' AND n>={k}), "
            "rp AS (SELECT rid, lang FROM rd WHERE rn=1), "
            "ip AS (SELECT rid, lang FROM iss WHERE rn=1), "
            "ra AS (SELECT lang, count(*) c FROM rp GROUP BY 1), "
            "ia AS (SELECT lang, count(*) c FROM ip GROUP BY 1), "
            "ba AS (SELECT rp.lang lang, count(*) c FROM rp JOIN ip USING (rid) "
            "       WHERE rp.lang=ip.lang GROUP BY 1) "
            "SELECT coalesce(ra.lang, ia.lang) lang, coalesce(ra.c,0) readme, "
            "       coalesce(ia.c,0) issue, coalesce(ba.c,0) AS \"both\" "
            "FROM ra FULL OUTER JOIN ia ON ra.lang=ia.lang "
            "LEFT JOIN ba ON coalesce(ra.lang, ia.lang)=ba.lang").fetchall()
        pc_by = {lang: (int(rm), int(iss_), int(bo)) for lang, rm, iss_, bo in pc_rows}
        mechanism["pair_counts"][str(k)] = [
            {"lang": L, "name": lang_name(L),
             "readme": pc_by.get(L, (0, 0, 0))[0],
             "issue": pc_by.get(L, (0, 0, 0))[1],
             "both": pc_by.get(L, (0, 0, 0))[2]}
            for L in mech_order
        ]
    write_json("asymmetry-mechanism.json", mechanism)

    # ---- meta.json ----
    log("writing meta.json ...")
    names = {L: lang_name(L) for L in sorted(all_langs)}
    meta = {
        "snapshot_day": snapshot_day,
        "dataset": {
            "name": "GitHub Multilingual Repositories Dataset",
            "repo": "github/multilingual-repositories",
            "url": "https://github.com/github/multilingual-repositories",
            "license": "CC0-1.0",
        },
        "pipeline_version": 1,
        "totals": {
            "classification_rows": int(rows),
            "distinct_repositories": int(repos),
            "rows_by_source": {s: int(by_source[s]) for s in SOURCES},
            "rows_by_classifier": {c: int(by_classifier[c]) for c in CLASSIFIERS},
        },
        "sources": SOURCES,
        "classifiers": CLASSIFIERS,
        "strictness": {
            "default": 3,
            "labels": {
                "1": "\u22651 classifier (broad recall)",
                "2": "2-of-3 agree (balanced)",
                "3": "all 3 agree (high precision, default)",
            },
        },
        "english_excluded": True,
        "notes": {
            "english": "The source dataset contains only non-English classifications "
                       "(confidence > 0.5). English counts are not present, so English is "
                       "excluded from the map and no English share is invented.",
            "language_not_country": "This is a language map, not a country map. Shaded regions mark "
                       "where a language is commonly used \u2014 not where repositories are located.",
            "not_ground_truth": "Labels are inferred from the first 150 characters of a README / "
                       "most-commented issue / most-commented PR. This is a discovery tool, not a "
                       "ground-truth language benchmark. Counts are 'repos classified as X', never "
                       "'repos that use X', and must not be used to infer attributes of people.",
            "published_tables": "GitHub's published aggregate tables correspond to the strictest "
                       "(3-of-3) setting.",
        },
        "lang_names": names,
    }
    write_json("meta.json", meta)

    log(f"DONE. processed {rows:,} classification rows in {time.time()-t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())

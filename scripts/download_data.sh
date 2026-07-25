#!/usr/bin/env bash
# Download the raw GitHub Multilingual Repositories Dataset parquet shards.
# ~1.1 GB total. Output goes to data-raw/ which is git-ignored (never committed).
# Idempotent: existing, non-empty files are skipped.
set -u
BASE="https://raw.githubusercontent.com/github/multilingual-repositories/main/data"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p data-raw/classifications data-raw/metadata

fetch_list() { # $1 = subdir under data/
  gh api --paginate "repos/github/multilingual-repositories/contents/data/$1" \
    --jq '.[].name' 2>/dev/null | sort -u
}

dl() {
  local kind="$1" name="$2" sub="$3" out="data-raw/$3/$2"
  if [ -s "$out" ]; then echo "skip $sub/$name"; return 0; fi
  curl -sS -f -m 300 --retry 4 --retry-delay 2 -o "$out" "$BASE/$kind/$name" \
    && echo "ok   $sub/$name" || { echo "FAIL $sub/$name"; rm -f "$out"; return 1; }
}
export -f dl; export BASE

fetch_list repository_classifications | while read -r f; do
  echo "repository_classifications $f classifications"
done > /tmp/_joblist.txt
fetch_list repository_metadata | while read -r f; do
  echo "repository_metadata $f metadata"
done >> /tmp/_joblist.txt

echo "Downloading $(wc -l < /tmp/_joblist.txt) shards..."
xargs -P 6 -n 3 bash -c 'dl "$0" "$1" "$2"' < /tmp/_joblist.txt
echo "=== DOWNLOAD COMPLETE ==="
du -sh data-raw/classifications data-raw/metadata

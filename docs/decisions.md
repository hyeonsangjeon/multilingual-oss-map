# Decision log

Records non-obvious decisions and their rationale, per spec §8 judgment priority:
1) Hard constraints (§3) > 2) Honesty > 3) Performance > 4) Narrative > 5) Aesthetics.

## D1 — Repo name
`polyglot-commit` in the spec is replaced by **`multilingual-oss-map`** per the user's instruction.

## D2 — Pages source = GitHub Actions (not `docs/` folder)
The spec PHASE 0 note "`docs/` (build output → Pages)" conflicts with PHASE 6 ("deploy via GitHub
Actions") and with using `docs/` for markdown docs. **Decision:** deploy the built Vite site via a
GitHub Actions workflow (Pages "GitHub Actions" source). `docs/` holds only markdown documentation.
Rationale: honesty/consistency — avoids mixing build artifacts with docs; Actions is the spec's
explicit PHASE 6 mechanism.

## D3 — Strictness via classifier agreement
Per (repository_id, source, lang_code), count distinct classifiers (fasttext/gcld3/linguapy) that
predicted that language. `strictness = k` means "≥ k classifiers agree". This matches the dataset
README's published "at least two classifiers with > 0.5 confidence" aggregate (= strictness 2),
which we reproduce as a correctness check (§3.4, honesty).

## D4 — English is excluded by dataset design
The dataset only contains **non-English** classifications (confidence > 0.5, non-English). We
therefore cannot compute a real "English share" number. Per §3.1 we (a) exclude English from the
map, (b) title it a "non-English" map, and (c) state in the English card that English counts are not
present in the source data rather than inventing one. (Honesty > narrative.)

## D6 — Default strictness = 2 (2-of-3), with the asymmetry framed as precision-dependent
Empirically, gcld3 and lingua-py **over-fire on CJK** (they each classify ~3M READMEs as ZH,
vs fastText's ~221k). So rankings shift a lot with strictness:
- KO README rank: s1→2, s2→5, s3→5 · KO issue rank: s1→2, s2→4, **s3→1**.
The clean spec narrative ("Korean #1 in issues, #5 in READMEs") holds at **strictness 3**, which
reproduces GitHub's published aggregate tables (see D7). Per §3.4 (hard constraint) the toggle
default stays **2-of-3**; honesty (§8 #2) and narrative (§8 #4) are served by: dynamic hero "#1"
cards, a slope chart sorted by asymmetry with captions naming KO/PT/JA, a one-click "show the
sharpest example" that sets strictness 3 + issue + KO, and a note that GitHub's published figures use
the strictest 3-of-3 setting. Rationale: keep the specified default, never hide the CJK over-firing —
the toggle *demonstrating* it is the honesty device §3.4 asks for.

## D7 — Published aggregate = all-three-agree; used as a correctness check
GitHub's README "aggregate statistics" tables match our **strictness-3** (all three classifiers
agree) counts within ~0.01–1% for PT/ES/RU/KO/TR/ID/ZH/JA (e.g. PT 3,039,349 vs 3,039,107; KO
678,744 vs 678,605). FR/DE differ more (~12%/17%), likely due to related-language code handling in
the source aggregate; documented as a known discrepancy. This is used in PHASE 7 to validate the
consensus logic (§3.4, honesty). Small residuals are consistent with exact-duplicate rows present in
the source shards (dedup-safe here because we count `DISTINCT classifier`).

## D5 — Counts are per (source, strictness); repos may appear under multiple languages
A repository can be classified as more than one language (classifier disagreement, or genuinely
mixed). So Σ(per-language repo counts) ≥ distinct repositories, especially at strictness 1. Documented
in methodology; never presented as mutually exclusive shares.

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

## D5 — Counts are per (source, strictness); repos may appear under multiple languages
A repository can be classified as more than one language (classifier disagreement, or genuinely
mixed). So Σ(per-language repo counts) ≥ distinct repositories, especially at strictness 1. Documented
in methodology; never presented as mutually exclusive shares.

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

## D8 — Choropleth colour domain uses the visible min–max, not [1, max]
The per-country dominant-language counts are heavily right-skewed (≈600 to 3.7 M). A log colour
scale anchored at 1 pushed every shaded country into the bright half of Viridis, so the map read as
"all yellow" and lost its signal. Fixed the sequential-log domain to the **actually shaded** values
(`[min, max]`, with a mild floor of `max/6000` so a single tiny outlier can't wash the ramp out).
This is a purely visual encoding change — the underlying counts, tooltips and captions are
unchanged — and it makes the README↔issue source switch legible (spec §5 aesthetics, below the
honesty/hard-constraint tiers of §8). Colour ramp remains colour-blind-safe Viridis (spec §9).

## D9 — Default strictness changed to all-3 (supersedes D6's default)
Per an explicit user directive, the **default strictness is now 3 (all three classifiers agree)**,
overriding the original spec §3.4 default of 2-of-3 (recorded in D6). Rationale:
- **Honesty / correctness (§8 #2):** all-3 reproduces GitHub's *published* aggregate tables (D7), so
  the numbers a visitor sees first match the dataset's own headline figures.
- **Not distorted by CJK over-firing:** gcld3 and lingua-py over-fire on CJK at looser settings
  (D6). At 2-of-3 the hero "#1 non-English issues" card reads **Chinese** (an artefact); at all-3 it
  reads **Korean (127,993)** — the true top non-English issue language.
- **Sharpest, truest narrative (§8 #4):** the headline asymmetry (Korean **#5 in READMEs → #1 in
  issues**) is cleanest and *accurate* at all-3, rather than the softened "#4 in issues" at 2-of-3.
The toggle still exposes ≥1 / 2-of-3 / all-3 (the honesty dial D6 asks for) and the labels now mark
all-3 as the default; 2-of-3 is relabelled "balanced" (no longer "default"). The 2-of-3 correctness
cross-check against the dataset README's "≥ two classifiers" aggregate is unchanged.

## D10 — Detail panel starts on Korean; map stays whole until clicked
On first load the language-detail panel was empty, which read as broken. **Decision:** initialise
`selectedLang = "KO"` so the panel is populated from the start with the site's headline case
(Korean: #5 in READMEs, #1 in issues), while a persistent guide line and the always-visible chips
make it clear any language can be chosen. To avoid a side effect — the choropleth dims every country
except the selected language's regions — we gate that dimming behind a new `mapInteracted` flag that
is set **only** by a direct map click. So the map loads whole (important now that it is also the
mobile centrepiece, D-mobile), and click-to-focus still works on desktop. Aesthetics/narrative,
below the honesty tier of §8.

## D11 — Map colour: categorical hue (language) + discrete lightness (volume); supersedes D8
The choropleth drove every country's fill from a single continuous Viridis‑by‑repo‑count scale
(D8), so colour encoded *count*, not *language*. Two different‑language regions with similar counts
came out the same colour, and because the count distribution is extremely skewed the whole map
collapsed into one green→yellow wash — neighbouring language regions were indistinguishable, which
directly contradicts the site's premise ("a **language** map"). **Decision:** split the two
variables (spec A, honesty/correctness tier of §8 — the encoding was actively misleading):
- **Hue = language identity.** The top‑8 mappable languages get distinct categorical hues; the rest
  are one neutral "Other" grey (>8 categorical colours are not reliably separable). The top‑8 are
  fixed **once** from the all‑3 README ranking (PT, ES, RU, FR, KO, TR, ID, ZH) and reused across
  every source tab and strictness — the single most important rule: if a language were re‑coloured
  per tab, comparing tabs would be impossible.
- **Lightness = volume, in discrete quantile bins** (not a continuous ramp, and not equal‑width —
  the skew would put almost everything in one bin). Boundaries are what make magnitude differences
  perceptible.
- **Palette = Okabe–Ito**, the standard colour‑blind‑safe categorical set. Six hues are used as‑is.
  Okabe–Ito's reddish‑purple `#CC79A7` was **dropped**: under a deuteranopia simulation it collapses
  onto the neutral "Other" grey (ΔE ≈ 5), and the language it would have marked (Indonesian) sits
  surrounded by "Other"‑grey neighbours — the worst possible case. The two lowest‑ranked,
  geographically isolated languages (Indonesian, Chinese) instead use a magenta `#E7298A` + red
  `#CC3311`, both verified against their actual map neighbours.
- **Known limitation (documented honestly, not hidden):** eight‑way categorical colour is at the
  theoretical limit of red‑green‑safe distinguishability, made harder here because lightness is
  spent on volume rather than identity. Under deuteranopia/protanopia the five headline languages
  (PT, ES, RU, FR, KO) and every *adjacent* coloured border stay distinct, but a few **non‑adjacent**
  warm hues (e.g. Portuguese/French/Chinese) converge toward gold. They are separated by oceans and
  continents and named in the legend, so identity is still recoverable; the headline stories
  (Korean; Portuguese vs Spanish South America) are unaffected. See docs/methodology.md §5.

This is a purely visual‑encoding change — counts, tooltips and captions are unchanged. It replaces
D8's continuous‑ramp fix (that only rescaled the wash; it did not address the root cause that colour
was encoding the wrong variable).

## D12 — A per-selection description card in the map area; hero shows select→spotlight

Selecting a language already dimmed the map to that language's regions (D10/D11), but the *reading*
of that selection — where the language ranks across README, issues and pull requests — only lived in
the full **Language detail** section far down the page. On mobile especially, tapping a ranking bar
lit up the map with no nearby explanation.

**Decision:** add a compact **spotlight card** (`site/src/spotlight.js`, `#map-spotlight`) directly
under the map. When a language is selected *and the map is focused on it* (`mapInteracted &&
selectedLang`), the card shows the language name, a region descriptor, its README / issue /
pull‑request ranks + counts (the current source is outlined), and a one‑line cross‑source takeaway.
Its left border and swatch use the language's fixed hue (D11), tying the card to the map colour. A
`×` clears the map focus (`mapInteracted:false`) while keeping `selectedLang`, so the detail panel
below stays populated (D10).

- **Gated on `mapInteracted`, not just `selectedLang`:** the card appears exactly when the map is
  spotlighted, so card presence ⇔ map highlight. On load the map stays whole (D10) and the card is
  hidden — no "the map says nothing but a card is shouting" mismatch.
- **Hero rebuilt to demonstrate this:** `docs/hero-loop.gif` no longer loops the subtle
  source‑switch recolour (only ~1.6 % of pixels changed — honest but underwhelming). It now cycles
  four language selections (Spanish → Korean → French → Portuguese); each spotlights only that
  language's regions across the map with the description card beneath. Captured at all‑3 strictness,
  topbar chrome hidden, 1000 px wide, 404 KB (< 3 MB, kept as GIF). Seamless loop: a Portuguese
  pre‑select before capture makes the first and last settled states identical.

Purely additive — counts, tooltips, the map encoding and the detail panel are unchanged.

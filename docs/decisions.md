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

## D13 — Asymmetry over creation-year: no density-robust trend (a null result, kept as a null)

Before building an "asymmetry over time" visualisation, we tested whether the README↔issue rank
asymmetry (a language ranking higher in issues than in READMEs, e.g. Korean) actually *grows or
shrinks* across repository creation years, for Korean, Portuguese and Chinese. The worry, stated
up front, was a **spurious trend**: older repositories have had more time to accumulate issues, so
issue classifications are denser for old repos than new ones, and that density gradient alone can
masquerade as a changing asymmetry.

To control for it we recomputed ranks on a **paired subset** — only repositories that have *both* a
non-English README language and a non-English issue language at the default all-3 strictness — so
every repo in the comparison contributes to both sides and the density gradient cancels.

**Decision:** do **not** build an asymmetry-timeseries section. There is no meaningful
density-robust trend to show, and "there is no trend" is itself a finding worth recording rather
than dressing up.

- **Uncontrolled, the trend looks real but is an artifact.** Ranking all repos by year, Korean's
  *issue* rank climbs to #1 for repos created 2021–2025 while its README rank stays ~4–5 — an
  apparently widening gap. But README→has-classified-issue coverage falls from **7.5 % (2013) to
  1.4 % (2025)**: the exact density confound anticipated.
- **Paired, the asymmetry disappears in every year.** Within repos classified in both sources, the
  per-year gap between issue rank and README rank is **0 for KO, PT and ZH across all years** —
  because within a paired repo the README and issue language agree **99.8 %** of the time
  (189,292 / 189,747 paired repos).
- **The asymmetry is compositional, not temporal.** It lives almost entirely in repos that have a
  non-English issue but an **English or absent README** — **73.4 %** of Korean-issue repos
  (Spanish 72.8 %, Russian 77.6 %, Japanese 90.3 %, Chinese 97.0 %). Those repos cannot enter the
  paired subset by construction, which is why pairing removes the phenomenon. The asymmetry is a
  property of *which repositories exist*, not of a within-repo behavioural shift over time.
- **Scale of the check:** 10,134,400 non-English README repos and 801,799 non-English issue repos
  at all-3; 189,747 paired. Analysis-only (DuckDB over the raw parquet); no code shipped for this
  step.

## D14 — Language × programming-language heatmap: README-based, within-language share, separate scale

The natural-language × programming-language matrix ("every language brings its own stack") had three
design forks worth pinning down.

**Decision:** identify a repository's natural language from its **README** classification (the map's
default lens), normalise each row to a **within-language share**, and render it with a **separate
single-hue violet scale cut into discrete bins** — never the map's colour system.

- **README, not per-source.** A tech stack (`primary_language_name`) is a repository attribute; it
  does not change with who is writing the issue. Deriving the natural language from README gives one
  stable community identity per repo and matches the map's default. The section therefore responds
  to the strictness dial but is deliberately **independent of the source tab** (noted in its
  caption), rather than implying the stack shifts by discussion language.
- **Within-language share, not absolute counts.** Absolute repo counts would let the largest
  communities (Portuguese, Spanish, Russian) dominate every column and wash out smaller ones. Each
  row is normalised to that language's repositories with a known primary language, so the cell reads
  "of language X's repos, this fraction use stack Y" — surfacing real signatures (Russian → Python
  25 %, Korean → Java 19 %, Turkish → C# 12 %, Indonesian → PHP 12 %, Vietnamese → JavaScript 20 %).
- **A separate discrete scale.** The map encodes hue = language and lightness = volume (D11). Reusing
  it here would collide semantically, so the heatmap uses one hue (violet, absent from the map
  palette) in six discrete steps. Discrete bins keep it categorically distinct and easier to read
  than a continuous ramp.
- **Axes fixed at all-3.** The top-12 natural languages and top-12 programming languages are chosen
  once at the default strictness so the grid's shape is stable; only the cell values re-weight as the
  dial moves.
- **Caption guards against causal reading:** a hot cell reflects the overall popularity of a stack as
  much as any language-specific taste, so it must not be read as "language X causes stack Y."

## D15 — Surface the asymmetry's mechanism on the site as a text card, not a chart

D13 recorded (in this file only) *why* the README↔issue asymmetry exists: it is compositional, not a
within-repository register switch. But the site's headline — "documented in English, discussed in a
mother tongue" — was left to imply the stronger, wrong reading (one repo doing both). The mechanism
had to move from the decision log onto the site so the narrative is precise.

**Decision:** add a section, **"Where the asymmetry actually lives,"** directly under the asymmetry
(slope) chart, built as a **text + numbers card, not a new chart**, and drive every figure from
`scripts/aggregate.py` (`site/data/asymmetry-mechanism.json`) rather than hard-coding STEP 1's
one-off query output.

- **Why a text card, not a chart.** The finding is two scalars per language plus one global scalar —
  a paired-agreement percentage and a per-language "no non-English README" share. A chart would
  dress a handful of numbers as if they were a distribution; horizontal share bars + one big stat
  read faster and don't invent structure. It also keeps the section light (no new D3 component) and
  visually subordinate to the dumbbell it annotates, signalling "this refines the chart above."
- **Two figures, both recomputed and strictness-responsive.** (a) In paired repos the dominant README
  and issue languages match — 99.8 % at all-3, and the value *rises* with strictness (76.2 → 99.3 →
  99.8) because stricter consensus removes CJK over-detection. (b) Per language, the share of
  issue-classified repos with no non-English README (KO 73.4, JA 90.3, ZH 97.0 at all-3). Raw integer
  counts are stored; the UI derives percentages, so the JSON stays byte-identical on re-run.
- **Wording guard (the crux).** The dataset holds only non-English classifications (D-preamble / §1),
  so "no non-English README classification" is **not** "English README." The card and caption say the
  README is *English, absent, too short, or below the confidence cut — never asserted as English*,
  and tie this explicitly to "English is excluded by design." Claiming "73 % write English READMEs"
  would have been the exact over-reach this project refuses elsewhere.
- **Refines, does not negate.** The copy states the headline still holds — these languages really are
  discussed more than documented — while relocating the cause to a distinct *population* of
  repositories. The section reads as a sharpening of the story, not a retraction.
- **Methodology + limitations updated too:** `docs/methodology.md` §5 gives the calculation
  definitions; a "The asymmetry is compositional" card was added to the on-site Method & limitations
  grid (pulling the paired % from the same data, not hard-coded).

## D16 — Add a "Share of year" (100 %-normalised) view to the timeseries, with a mode-specific caption

The creation-year timeseries shipped only as an absolute stacked area. That view answers "how many?"
and reads as "everything grows together" — the proportional contest between languages (who is *gaining
ground* on whom) is invisible when every band inflates with the overall volume. Normalising each year
to 100 % surfaces that second story from the same data.

**Decision:** add a local **[Repositories] / [Share of year]** toggle to the timeseries section
(default = Repositories), not a new section. Share mode re-stacks with D3 `stackOffsetExpand`; the
absolute view keeps `stackOffsetNone`.

- **Front-end normalisation, no re-aggregation.** Share is a pure re-projection of the existing
  `timeseries.json` (each column divided by its own total), so the aggregation pipeline is untouched
  and idempotency is unaffected. Verified numerically: every source × strictness × year normalises to
  1.0 within 2.2 × 10⁻¹⁶ (171 year-blocks, 0 empty).
- **Colours are pinned across views.** The palette is a function of `(source, strictness)` only —
  `viewMode` never changes the language set — so a language keeps its exact hue when you flip between
  counts and share. If the same band jumped colour on toggle, cross-view comparison would be
  impossible. Asserted in the verifier (11 bands, fills identical count ↔ share).
- **The caption is the point, and it changes with the mode.** Share is far easier to misread than
  counts, so the two views must *not* share a caption. The share caption carries two warnings the
  count caption does not:
  1. **A falling share is not a decline** — a language can grow in absolute numbers yet lose share
     when others grow faster; the copy tells the reader to switch back to *Repositories* to check.
  2. **Recent-year undercounting distorts proportions more than counts** — issue/PR coverage thins
     over time and at *different rates per language* (the same density confound found in D13, where
     README→issue coverage falls 7.5 % → 1.4 %), so late-year proportion shifts can be pure
     classification-density artefacts. This is the STEP 1 confound resurfacing in a sharper form.
- **The last two years are visually quarantined.** In share mode only, the final two years are dimmed
  under a translucent veil with a dashed boundary and a "recent · undercounted" marker, and the
  caption says outright *don't read the shaded years*. The veil is share-only because that is where
  the distortion is dangerous; in count mode the same undercount is obvious from the falling bars and
  needs no veil.
- **Smooth, legible transition.** The SVG was refactored from rebuild-on-render to a persistent
  skeleton so switching modes morphs the area paths (450 ms) and fades the veil, rather than flashing.
  Axes update immediately (no tick interpolation between the 0–120 K and 0–100 % scales, which would
  look broken). Verified: all 18 source × strictness × view combinations render with zero console
  errors.

# Language → region mapping

**A language map is not a country map.** This document explains how
[`site/data/lang-regions.json`](../site/data/lang-regions.json) is built and, just as importantly,
what it does *not* claim.

## What the mapping is

For each language we list the ISO 3166-1 alpha-3 countries where that language is a **de jure
official / national** language or a **de facto majority** everyday language. It is generated (and
its country codes validated against `pycountry`) by
[`scripts/build_regions.py`](../scripts/build_regions.py). 83 languages are mapped across 151
countries.

Each entry carries:

| Field | Meaning |
| --- | --- |
| `countries` | ISO 3166-1 alpha-3 codes to shade for this language. |
| `broad` | `true` when the language spans many countries (Spanish, Arabic, French, Portuguese, Russian, Persian, Swahili). A single choropleth necessarily flattens this. |
| `regional` | `true` for sub-national / regional languages (Catalan, Galician, Basque, Welsh, Xhosa, Zulu, Corsican, Occitan, Frisian, several Indian state languages). These are mapped to the country they sit in and are usually visually overridden by that country's larger language. |
| `rationale` | One-line provenance for the mapping. |

## What the mapping is **not** (limitations)

1. **Not repository location.** The dataset classifies the *language of text* in a README / issue /
   PR. A repo whose README is Spanish may be authored anywhere on Earth. Colors mark **where a
   language is spoken**, not where code lives. This is stated in the legend, the map subtitle, and
   `meta.json`.
2. **Not a claim about people.** Per dataset terms and spec §3.2 we never infer attributes of repo
   owners or contributors. "Korean repositories" always means "repositories **classified as**
   Korean", not "repositories by Koreans".
3. **Broad languages are under-served by a map.** Spanish across 20 countries or Arabic across 21
   cannot be honestly reduced to one shade of one country; the `broad` flag and the legend say so,
   and the language detail panel gives the real per-language totals.
4. **English is excluded entirely** (spec §3.1): it is global, and the source dataset contains no
   English classifications anyway. The map is explicitly a **non-English** map.
5. **Overlaps are resolved by magnitude, not priority.** When several languages map to one country
   (e.g. German/French/Italian → Switzerland; the 11 official languages → South Africa), the
   overview map shades that country by the language with the **largest repository count** for the
   current source/strictness. Hover reveals the specific language. This is a display choice, not a
   statement that one language "owns" the country.
6. **Countries the dataset can't place stay blank.** Esperanto and Latin have no national territory
   (`countries: []`); they never shade the map but still appear in the rankings and detail panel.

## Coding notes

- Language codes in the dataset are **uppercase ISO 639**; `IW` is the legacy code for Hebrew and is
  mapped alongside `HE`.
- `XKX` (Kosovo) is a user-assigned code used by the world-atlas TopoJSON; it is added manually
  because it is not in `pycountry`.
- Country **numeric** codes (from `iso-countries.json`) are used to match the world-atlas TopoJSON,
  whose feature ids are ISO 3166-1 numeric.

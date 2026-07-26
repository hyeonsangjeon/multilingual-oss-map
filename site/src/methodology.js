import { meta, mechanism } from "./data.js";
import { commas, human, pct1 } from "./format.js";

export function mountMethodology() {
  const grid = document.getElementById("method-grid");
  const t = meta.totals;
  const p3 = mechanism.paired["3"];
  const cards = [
    {
      warn: true,
      h: "The asymmetry is compositional",
      p: `A language ranking higher in issues than READMEs is not one repository documenting in ` +
        `English and talking in a mother tongue. In repositories classified in both sources the two ` +
        `languages match ${pct1(p3.agree / p3.paired)} (all-3); the gap comes from a separate ` +
        `population — repositories with non-English issues but no non-English README classification ` +
        `(English, absent, or unclassifiable). See “Where the asymmetry actually lives.”`,
    },
    {
      warn: true,
      h: "A language map, not a country map",
      p: meta.notes.language_not_country +
        " A region is shaded by the language most repositories there are classified in; it never claims those repositories are hosted or authored in that country.",
    },
    {
      warn: true,
      h: "Inferred labels, not ground truth",
      p: meta.notes.not_ground_truth,
    },
    {
      h: "English is excluded by design",
      p: meta.notes.english,
    },
    {
      h: "Three classifiers, one honesty dial",
      p: `Each text is labelled by fastText, gcld3 and lingua-py. Strictness = how many must agree: ≥1 is broad recall, 2-of-3 is balanced, all-3 is the high-precision default and matches the dataset's own published tables. CJK languages are the most sensitive to this dial.`,
    },
    {
      h: "What the numbers count",
      p: `Every value is “repositories classified as language X” from the first ~150 characters of a README, the most-commented issue, or the most-commented pull request — three separate text sources, never merged. A repository can count in several languages.`,
    },
    {
      h: "Data & reproducibility",
      p: `Built from ${commas(t.classification_rows)} classifications across ${commas(
        t.distinct_repositories
      )} repositories (${human(t.rows_by_source.readme)} README, ${human(
        t.rows_by_source.issue
      )} issue, ${human(t.rows_by_source.pull_request)} PR). Aggregated deterministically with DuckDB — see the pipeline and docs in the repository.`,
    },
  ];

  grid.innerHTML = cards
    .map(
      (c) => `
    <div class="method-card${c.warn ? " warn" : ""}">
      <h3>${c.h}</h3>
      <p>${c.p}</p>
    </div>`
    )
    .join("");
}

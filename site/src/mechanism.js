// "Where the asymmetry actually lives" — a text + numbers card, not a chart.
//
// STEP 1 (docs/decisions.md D13/D15) showed the README<->issue rank asymmetry is
// compositional, so the site should say so precisely. Two facts, both recomputed in
// scripts/aggregate.py and re-weighted here by the strictness dial:
//   A. In repositories classified in BOTH a README and an issue, the dominant README
//      language equals the dominant issue language ~99.8% of the time — the registers
//      do not split inside a repository.
//   B. For each language, a large share of the repositories whose ISSUES are in it
//      have NO non-English README classification at all, so they cannot enter the
//      paired set in (A). That "outside" population is where the asymmetry lives.
//
// Wording guard: the dataset holds only non-English labels (English is excluded by
// design), so "no non-English README classification" means the README is English,
// absent, too short, or below the confidence cut — never asserted as English.
import { getState, subscribe } from "./store.js";
import { mechanism } from "./data.js";
import { commas, pct1 } from "./format.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

const BAR_C = "#ffb703"; // issue amber — ties these bars to the issue side of the asymmetry
const TOP_N = 6;
let holder, caption;

export function mountMechanism() {
  holder = document.getElementById("mech-holder");
  caption = document.getElementById("mech-caption");
  if (!holder) return;
  render(getState());
  let last = getState().strictness;
  subscribe((s) => {
    if (s.strictness === last) return; // recomputed per strictness only
    last = s.strictness;
    render(s);
  });
}

function render(s) {
  const k = String(s.strictness);
  const paired = mechanism.paired[k];
  const byLang = new Map(mechanism.issue_no_readme[k].map((e) => [e.lang, e]));
  const show = mechanism.order.slice(0, TOP_N).map((L) => byLang.get(L)).filter(Boolean);
  const agree = paired.paired ? paired.agree / paired.paired : 0;

  holder.innerHTML =
    `<div class="mech-card">` +
      `<div class="mech-stat">${pct1(agree)}</div>` +
      `<p class="mech-stat-label">of repositories classified in <strong>both</strong> a README and ` +
      `its issues carry the <strong>same</strong> language</p>` +
      `<p class="mech-note">The two registers do not split inside a repository. When a project's ` +
      `README is labelled non-English, its issues almost always match it — ` +
      `<span class="num">${commas(paired.agree)}</span> of <span class="num">${commas(paired.paired)}</span> ` +
      `paired repositories. This is the overlap where the two circles meet in the diagram above.</p>` +
    `</div>` +
    `<div class="mech-card">` +
      `<h3 class="mech-card-h">So where does it come from?</h3>` +
      `<p class="mech-note">Of the repositories whose <em>issues</em> are classified in a language, ` +
      `this share have <strong>no non-English README classification</strong> — they never enter the ` +
      `paired set on the left:</p>` +
      `<div class="mech-bars">` +
      show.map((e) => {
        const p = e.issue_repos ? e.no_readme / e.issue_repos : 0;
        return `<div class="mech-bar-row" data-l="${e.name}" data-nr="${e.no_readme}" data-ir="${e.issue_repos}">` +
          `<span class="mech-bar-name">${e.name}</span>` +
          `<span class="mech-bar-track"><i style="width:${(p * 100).toFixed(1)}%;background:${BAR_C}"></i></span>` +
          `<span class="mech-bar-val">${Math.round(p * 100)}%</span>` +
        `</div>`;
      }).join("") +
      `</div>` +
    `</div>`;

  holder.querySelectorAll(".mech-bar-row").forEach((row) => {
    row.addEventListener("mousemove", (e) => {
      const { l, nr, ir } = row.dataset;
      showTip(
        `<div class="tt-title">${l}</div>` +
        `<div class="tt-row">No non-English README: <span class="num">${commas(+nr)}</span></div>` +
        `<div class="tt-row">Issue-classified repos: <span class="num">${commas(+ir)}</span></div>` +
        `<div class="tt-row" style="color:var(--accent2)">${pct1(+nr / +ir)} have no non-English README</div>`,
        e
      );
      moveTip(e);
    });
    row.addEventListener("mouseleave", hideTip);
  });

  caption.innerHTML = captionText(s, byLang);
}

function captionText(s, byLang) {
  const zh = byLang.get("ZH");
  const zhTxt = zh && zh.issue_repos
    ? ` Chinese is the extreme: ${pct1(zh.no_readme / zh.issue_repos)} of its issue-classified ` +
      `repositories have no non-English README.`
    : "";
  return (
    `<strong>“No non-English README classification”</strong> is not the same as “English README.” ` +
    `The dataset carries only non-English labels — English is excluded by design — so it means the ` +
    `README is English, absent, too short, or below the confidence cut; the data never says which.` +
    zhTxt +
    ` This <em>sharpens</em> the headline rather than denying it: these languages really are discussed ` +
    `more than they are documented, but the mechanism is compositional — a distinct population of ` +
    `repositories that talk in a mother tongue without a non-English README, not one repository ` +
    `switching registers. Strictness ${s.strictness}: stricter consensus strips CJK over-detection, ` +
    `so paired agreement climbs toward all-3's ${pct1(mechanism.paired["3"].agree / mechanism.paired["3"].paired)}.`
  );
}

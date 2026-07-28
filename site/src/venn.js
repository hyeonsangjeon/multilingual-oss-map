// Area-proportional README<->issue Venn for the selected language.
//
// The propositions ("if a repo's issues are Korean, its README is Korean too")
// are confusion-of-the-inverse traps: the SAME overlap is a small slice of the big
// README circle but a larger slice of the small issue circle. Drawing the two circles
// to scale — areas proportional to repo counts, the lens sized to the exact paired
// intersection from scripts/aggregate.py (mechanism.pair_counts) — makes the base-rate
// asymmetry visible without any conditional-probability arithmetic.
//
// Reacts to BOTH controls: strictness (the dial) recomputes every count; selecting a
// language anywhere (map / slope / detail / the chips here) re-points the diagram.
import { getState, subscribe, setState } from "./store.js";
import { mechanism } from "./data.js";
import { commas, pct1 } from "./format.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

const README_C = "#4cc9f0"; // cyan — matches slope.js README rank + --accent2
const ISSUE_C = "#ffb703"; // amber — matches slope.js / mech bars issue side
const W = 560, H = 340, TOP = 64, BOT = 22, SIDE = 18;
const CHIP_N = 8; // languages offered as quick chips (rest still resolve if selected elsewhere)

let holder;

export function mountVenn() {
  holder = document.getElementById("venn-holder");
  if (!holder) return;
  render(getState());
  let lastK = getState().strictness, lastL = getState().selectedLang;
  subscribe((s) => {
    if (s.strictness === lastK && s.selectedLang === lastL) return;
    lastK = s.strictness; lastL = s.selectedLang;
    render(s);
  });
}

const pairList = (k) => mechanism.pair_counts[String(k)];
const pairMap = (k) => new Map(pairList(k).map((e) => [e.lang, e]));

// intersection (lens) area of two circles at centre distance d
function lensArea(d, rA, rB) {
  if (d >= rA + rB) return 0;
  if (d <= Math.abs(rA - rB)) return Math.PI * Math.min(rA, rB) ** 2;
  const a = rA * rA * Math.acos((d * d + rA * rA - rB * rB) / (2 * d * rA));
  const b = rB * rB * Math.acos((d * d + rB * rB - rA * rA) / (2 * d * rB));
  const c = 0.5 * Math.sqrt((-d + rA + rB) * (d + rA - rB) * (d - rA + rB) * (d + rA + rB));
  return a + b - c;
}
// distance d that yields a target lens area (area shrinks monotonically as d grows)
function solveD(rA, rB, target) {
  const loD = Math.abs(rA - rB), hiD = rA + rB;
  if (target <= 0) return hiD;
  if (target >= Math.PI * Math.min(rA, rB) ** 2) return loD;
  let lo = loD, hi = hiD;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (lensArea(mid, rA, rB) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function render(s) {
  const k = String(s.strictness);
  const pm = pairMap(k);
  const L = pm.has(s.selectedLang) ? s.selectedLang : "KO";
  const e = pm.get(L);
  const A = e.readme, B = e.issue, both = e.both;
  const rAi = A - both, iOnly = B - both;
  const pRi = A ? both / A : 0; // README => issue  (small)
  const pIr = B ? both / B : 0; // issue  => README (larger)
  const noIssue = e.readme_no_issue || 0;                 // README repos with NO classified issue
  const withIssue = Math.max(A - noIssue, 0);             // README repos that DO have a classified issue
  const overlapAgree = withIssue ? both / withIssue : 0;  // agreement INSIDE the overlap (~100%)
  const pNoIssue = A ? noIssue / A : 0;                   // share of README circle that can't reach the overlap

  // area-proportional geometry in unit space, then scaled to fit
  const rAu = Math.sqrt(A / Math.PI), rBu = Math.sqrt(B / Math.PI);
  const du = solveD(rAu, rBu, both);
  const availW = W - 2 * SIDE, availH = H - TOP - BOT;
  const maxRu = Math.max(rAu, rBu);
  const f = Math.min(availW / (rAu + du + rBu), availH / (2 * maxRu));
  const rA = rAu * f, rB = rBu * f, d = du * f;
  const groupW = rA + d + rB;
  const cxA = SIDE + (availW - groupW) / 2 + rA;
  const cxB = cxA + d;
  const cy = TOP + availH / 2;
  const lensx = d > 0 ? cxA + (d * d + rA * rA - rB * rB) / (2 * d) : cxA + rA;
  const hh = Math.sqrt(Math.max(rA * rA - (lensx - cxA) ** 2, 0));

  const showRA = rA > 46; // room for an interior "README only" count
  const showIO = rB > 42;
  const showRAsub = rA > 68; // extra room for the "no classified issue" descriptor
  const showIOsub = rB > 68;

  const svg =
    `<svg class="venn-svg" viewBox="0 0 ${W} ${H}" role="img" ` +
    `aria-label="${e.name}: ${commas(A)} README repositories, ${commas(B)} issue repositories, ${commas(both)} both">` +
      // circles (semi-transparent so the lens blends visibly)
      `<circle class="vc" data-r="readme" cx="${cxA.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rA.toFixed(1)}" ` +
        `fill="${README_C}" fill-opacity="0.5" stroke="${README_C}" stroke-width="2"/>` +
      `<circle class="vc" data-r="issue" cx="${cxB.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rB.toFixed(1)}" ` +
        `fill="${ISSUE_C}" fill-opacity="0.5" stroke="${ISSUE_C}" stroke-width="2"/>` +
      // interior counts (only when the slice is big enough to hold text)
      (showRA
        ? `<text x="${(cxA - rA * 0.32).toFixed(1)}" y="${cy.toFixed(1)}" class="v-in" text-anchor="middle">` +
          `<tspan x="${(cxA - rA * 0.32).toFixed(1)}" dy="${showRAsub ? -10 : -2}">README only</tspan>` +
          `<tspan x="${(cxA - rA * 0.32).toFixed(1)}" dy="16">${commas(rAi)}</tspan>` +
          (showRAsub ? `<tspan x="${(cxA - rA * 0.32).toFixed(1)}" dy="15" class="v-in-note">no classified issue</tspan>` : "") +
          `</text>`
        : "") +
      (showIO
        ? `<text x="${(cxB + rB * 0.34).toFixed(1)}" y="${cy.toFixed(1)}" class="v-in v-in-dark" text-anchor="middle">` +
          `<tspan x="${(cxB + rB * 0.34).toFixed(1)}" dy="${showIOsub ? -10 : -2}">issues only</tspan>` +
          `<tspan x="${(cxB + rB * 0.34).toFixed(1)}" dy="16">${commas(iOnly)}</tspan>` +
          (showIOsub ? `<tspan x="${(cxB + rB * 0.34).toFixed(1)}" dy="15" class="v-in-note v-in-note-dark">no classified README</tspan>` : "") +
          `</text>`
        : "") +
      // header row — corners are always clear of the circles (TOP reserves the band)
      `<text x="${SIDE}" y="20" class="v-top" fill="${README_C}" text-anchor="start">` +
        `<tspan x="${SIDE}">${e.name} README</tspan>` +
        `<tspan x="${SIDE}" dy="17">${commas(A)}</tspan></text>` +
      `<text x="${W - SIDE}" y="20" class="v-top" fill="${ISSUE_C}" text-anchor="end">` +
        `<tspan x="${W - SIDE}">${e.name} issues</tspan>` +
        `<tspan x="${W - SIDE}" dy="17">${commas(B)}</tspan></text>` +
      // "both" callout, top-centre, with a leader down to the lens
      `<text x="${(W / 2).toFixed(1)}" y="16" class="v-both" text-anchor="middle">both = ${commas(both)}</text>` +
      `<line x1="${(W / 2).toFixed(1)}" y1="22" x2="${lensx.toFixed(1)}" y2="${(cy - hh - 2).toFixed(1)}" ` +
        `stroke="var(--text-dim)" stroke-width="1.2"/>` +
      `<circle cx="${lensx.toFixed(1)}" cy="${(cy - hh - 2).toFixed(1)}" r="2.4" fill="var(--text)"/>` +
      // lens hit target for tooltip
      `<circle class="vc" data-r="both" cx="${lensx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${Math.max(hh * 0.6, 7).toFixed(1)}" ` +
        `fill="transparent"/>` +
    `</svg>`;

  const chips = pairList(k).slice(0, CHIP_N).map((c) =>
    `<button type="button" class="chip${c.lang === L ? " active" : ""}" data-l="${c.lang}">${c.name}</button>`
  ).join("");

  const inr = mechanism.issue_no_readme[k].find((x) => x.lang === L);
  const pNoReadme = inr && inr.issue_repos ? inr.no_readme / inr.issue_repos : (pIr ? 1 - pIr : 0);
  const pairedK = mechanism.paired[k];
  const agree = pairedK.paired ? pairedK.agree / pairedK.paired : 0;

  holder.innerHTML =
    `<div class="venn-card">` +
      `<div class="venn-head">` +
        `<h3 class="venn-title">Same repositories, two different fractions</h3>` +
        `<span class="venn-sub">area \u221d repositories \u00b7 strictness ${s.strictness} \u00b7 tap a language</span>` +
      `</div>` +
      svg +
      `<div class="venn-chips">${chips}</div>` +
      `<div class="venn-legend">` +
        `<div class="venn-leg-row"><span class="venn-sw" style="background:${README_C}"></span>` +
          `<span>\u201c${e.name} README \u21d2 ${e.name} issues\u201d holds just <strong>${pct1(pRi)}</strong> ` +
          `\u2014 of all ${commas(A)} ${e.name}-README repos, and <strong>${pct1(pNoIssue)}</strong> of those have ` +
          `no classified issue, so they can never reach the overlap.</span></div>` +
        `<div class="venn-leg-row"><span class="venn-sw" style="background:${ISSUE_C}"></span>` +
          `<span>\u201c${e.name} issues \u21d2 ${e.name} README\u201d holds <strong>${pct1(pIr)}</strong> ` +
          `\u2014 of all ${commas(B)} ${e.name}-issue repos, and <strong>${pct1(pNoReadme)}</strong> of those have ` +
          `no non-English README.</span></div>` +
        `<div class="venn-leg-row"><span class="venn-sw venn-sw-both"></span>` +
          `<span><strong>Inside the overlap</strong> \u2014 repos classified on both surfaces \u2014 the two languages ` +
          `agree <strong>${pct1(overlapAgree)}</strong> for ${e.name} (<strong>${pct1(agree)}</strong> across all ` +
          `languages). This is the paired-match figure.</span></div>` +
      `</div>` +
      `<p class="venn-cap">Both figures are correct because their denominators differ: a repository whose issues ` +
        `are never classified still counts inside the ${e.name} README circle but can never enter the overlap, so ` +
        `\u201cREADME \u21d2 issues\u201d reads only <strong>${pct1(pRi)}</strong> while agreement <em>inside</em> ` +
        `the overlap stays at <strong>${pct1(overlapAgree)}</strong>.</p>` +
    `</div>`;

  wireTips(holder, e);
  holder.querySelectorAll(".venn-chips .chip").forEach((b) =>
    b.addEventListener("click", () => setState({ selectedLang: b.dataset.l }))
  );
}

function wireTips(root, e) {
  const A = e.readme, B = e.issue, both = e.both;
  const info = {
    readme: `<div class="tt-title">${e.name} README</div>` +
      `<div class="tt-row"><span class="num">${commas(A)}</span> repositories</div>` +
      `<div class="tt-row" style="color:var(--accent2)">${pct1(both / A)} also have ${e.name} issues</div>`,
    issue: `<div class="tt-title">${e.name} issues</div>` +
      `<div class="tt-row"><span class="num">${commas(B)}</span> repositories</div>` +
      `<div class="tt-row" style="color:var(--accent2)">${pct1(both / B)} also have a ${e.name} README</div>`,
    both: `<div class="tt-title">Both surfaces ${e.name}</div>` +
      `<div class="tt-row"><span class="num">${commas(both)}</span> repositories</div>` +
      `<div class="tt-row">${pct1(both / A)} of READMEs \u00b7 ${pct1(both / B)} of issues</div>`,
  };
  root.querySelectorAll(".vc").forEach((el) => {
    const key = el.dataset.r;
    el.addEventListener("mousemove", (ev) => { showTip(info[key], ev); moveTip(ev); });
    el.addEventListener("mouseleave", hideTip);
  });
}

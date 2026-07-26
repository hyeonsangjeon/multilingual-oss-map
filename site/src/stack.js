// Natural language × primary programming language heatmap.
//
// Each row is a natural language (from README classification — the map's default
// lens); each column is a repository's primary programming language. The cell is a
// WITHIN-LANGUAGE share: of that language's repositories with a known primary
// language, the fraction written primarily in that programming language. Absolute
// counts would let the biggest language communities dominate every row, so the row
// is normalised to itself. The scale is a deliberately SEPARATE single-hue violet
// ramp, cut into discrete bins, so it never collides with the map's rule of
// hue = language / lightness = volume. The grid responds to the strictness dial; it
// is README-based and does not depend on the source tab (a stack is a repository
// attribute, not a property of who is talking).
import { getState, subscribe } from "./store.js";
import { langStack } from "./data.js";
import { commas } from "./format.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

// Discrete violet sequential scale (dark -> light). Thresholds are within-language %.
const RAMP = ["#221f3a", "#342a5e", "#49398a", "#6a51bf", "#9277e6", "#c3adf7"];
const EDGES = [3, 6, 10, 15, 20]; // <3 | 3–6 | 6–10 | 10–15 | 15–20 | ≥20
const LABELS = ["<3%", "3–6", "6–10", "10–15", "15–20", "≥20%"];
const DARK_TEXT = 4; // bins >= this get dark text for contrast on light violet

function binOf(p) {
  let i = 0;
  while (i < EDGES.length && p >= EDGES[i]) i++;
  return i;
}

let holder, legend, caption;

export function mountStack() {
  holder = document.getElementById("stack-holder");
  legend = document.getElementById("stack-legend");
  caption = document.getElementById("stack-caption");
  if (!holder) return;
  renderLegend();
  render(getState());
  let last = null;
  subscribe((s) => {
    if (s.strictness === last) return; // README-based: ignore source changes
    render(s);
  });
}

function renderLegend() {
  legend.innerHTML =
    `<span class="stack-legend-lab">share within language</span>` +
    RAMP.map(
      (c, i) => `<span class="stack-key"><i style="background:${c}"></i>${LABELS[i]}</span>`
    ).join("");
}

function render(s) {
  const data = langStack;
  const block = data.by_strictness[String(s.strictness)];
  const nats = data.natural_langs; // [{lang,name}]
  const pls = data.prog_langs; // [name,...]
  holder.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "heat-grid";
  grid.style.gridTemplateColumns = `var(--heat-rowh) repeat(${pls.length}, minmax(30px, 1fr))`;

  // corner + column headers (programming languages, vertical)
  grid.insertAdjacentHTML("beforeend", `<div class="heat-corner"></div>`);
  for (const p of pls) {
    const h = document.createElement("div");
    h.className = "heat-colh";
    h.innerHTML = `<span>${p}</span>`;
    grid.appendChild(h);
  }

  // rows
  for (const { lang, name } of nats) {
    const rec = block[lang] || { total: 0, cells: {} };
    const rh = document.createElement("div");
    rh.className = "heat-rowh";
    rh.textContent = name;
    rh.title = name;
    grid.appendChild(rh);

    for (const p of pls) {
      const cnt = rec.cells[p] || 0;
      const share = rec.total ? (100 * cnt) / rec.total : 0;
      const b = binOf(share);
      const cell = document.createElement("div");
      cell.className = "heat-cell";
      cell.style.background = cnt ? RAMP[b] : "var(--bg-elev)";
      if (cnt) {
        cell.style.color = b >= DARK_TEXT ? "#1a1330" : "rgba(233,237,245,.82)";
        cell.textContent = share >= 1 ? Math.round(share) : "";
      }
      cell.dataset.l = name;
      cell.dataset.p = p;
      cell.dataset.c = cnt;
      cell.dataset.s = share.toFixed(1);
      grid.appendChild(cell);
    }
  }

  // single delegated hover handler
  grid.addEventListener("mousemove", (e) => {
    const cell = e.target.closest(".heat-cell");
    if (!cell) { hideTip(); return; }
    const { l, p, c, s: sh } = cell.dataset;
    showTip(
      `<div class="tt-title">${l} · ${p}</div>` +
      `<div class="tt-row">Repositories: <span class="num">${commas(+c)}</span></div>` +
      `<div class="tt-row">Share within ${l}: <span class="num">${sh}%</span></div>`,
      e
    );
    moveTip(e);
  });
  grid.addEventListener("mouseleave", hideTip);

  holder.appendChild(grid);

  caption.innerHTML =
    `Rows are natural languages (by README, top ${nats.length}); columns are the top ` +
    `${pls.length} primary programming languages. Each cell is that language's share of ` +
    `repositories written primarily in that stack, at <strong>${strictLabel(s.strictness)}</strong> ` +
    `strictness — normalised per row, so a big community can't wash out a small one. ` +
    `README-based, so it does not change with the source tab above. ` +
    `<em>Read it as preference, not cause:</em> it reflects the overall popularity of each ` +
    `stack as much as any language-specific taste, so don't read a hot cell as “language X ` +
    `causes stack Y.”`;
}

function strictLabel(k) {
  return { 1: "≥1 classifier", 2: "2-of-3", 3: "all-3" }[k] || `${k}`;
}

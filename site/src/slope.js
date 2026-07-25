import { select, scaleLinear, scalePoint } from "d3";
import { getState, setState, subscribe } from "./store.js";
import { totalsFor, langRegions } from "./data.js";
import { ordinal, commas } from "./format.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

const README_C = "#4cc9f0";
const ISSUE_C = "#ffb703";
const W = 900, RH = 30, ML = 150, MR = 60, MT = 46, MB = 10;

let holder, caption, controls;
let sortMode = "asym"; // asym | readme | issue

export function mountSlope() {
  holder = document.getElementById("slope-holder");
  caption = document.getElementById("slope-caption");
  controls = document.getElementById("slope-controls");
  buildControls();
  render(getState());
  subscribe(render);
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => render(getState()), 180); });
}

function buildControls() {
  controls.innerHTML = `<span class="control-label" style="margin:0 4px 0 0">Sort by</span>`;
  const seg = document.createElement("div");
  seg.className = "segmented compact";
  [["asym", "Asymmetry"], ["readme", "README rank"], ["issue", "Issue rank"]].forEach(([k, lbl]) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = lbl; b.dataset.k = k;
    b.classList.toggle("active", k === sortMode);
    b.addEventListener("click", () => {
      sortMode = k;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.k === k));
      render(getState());
    });
    seg.appendChild(b);
  });
  controls.appendChild(seg);
  const legend = document.createElement("div");
  legend.style.cssText = "display:flex;gap:16px;font-size:.82rem;color:var(--text-dim);margin-left:auto";
  legend.innerHTML =
    `<span><span class="dot" style="background:${README_C}"></span>README rank</span>` +
    `<span><span class="dot" style="background:${ISSUE_C}"></span>Issue rank</span>`;
  controls.appendChild(legend);
}

function buildRows(s) {
  const rm = totalsFor("readme", s.strictness);
  const iss = totalsFor("issue", s.strictness);
  const rmRank = new Map(rm.map((r) => [r.lang, r]));
  const issRank = new Map(iss.map((r) => [r.lang, r]));
  const pool = new Set([...rm.slice(0, 15), ...iss.slice(0, 15)].map((r) => r.lang));
  const rows = [];
  for (const lang of pool) {
    const a = rmRank.get(lang), b = issRank.get(lang);
    if (!a || !b) continue; // need both to show a movement
    rows.push({ lang, name: a.name, rRank: a.rank, iRank: b.rank, rCount: a.count, iCount: b.count,
      asym: Math.abs(a.rank - b.rank), better: b.rank < a.rank });
  }
  if (sortMode === "readme") rows.sort((x, y) => x.rRank - y.rRank || x.lang.localeCompare(y.lang));
  else if (sortMode === "issue") rows.sort((x, y) => x.iRank - y.iRank || x.lang.localeCompare(y.lang));
  else rows.sort((x, y) => y.asym - x.asym || x.rRank - y.rRank);
  return rows.slice(0, 16);
}

function render(s) {
  const rows = buildRows(s);
  holder.innerHTML = "";
  if (!rows.length) { holder.innerHTML = `<div class="empty">No overlapping languages at this strictness.</div>`; return; }
  const H = MT + MB + rows.length * RH;
  const maxRank = Math.max(...rows.flatMap((r) => [r.rRank, r.iRank]));
  const x = scaleLinear().domain([1, maxRank]).range([ML, W - MR]);
  const y = scalePoint().domain(rows.map((r) => r.lang)).range([MT, MT + (rows.length - 1) * RH]).padding(0);

  const svg = select(holder).append("svg").attr("viewBox", `0 0 ${W} ${H}`);

  // axis header + ticks
  svg.append("text").attr("x", ML).attr("y", 22).attr("class", "lane").style("fill", "var(--text-dim)").text("← better rank");
  [1, Math.ceil(maxRank / 2), maxRank].forEach((t) => {
    svg.append("text").attr("x", x(t)).attr("y", 34).attr("text-anchor", "middle").attr("class", "slope-label").text("#" + t);
    svg.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", MT - 6).attr("y2", H - MB)
      .attr("stroke", "var(--line-soft)").attr("stroke-width", 0.5);
  });

  const g = svg.append("g");
  rows.forEach((r) => {
    const yy = y(r.lang);
    const hi = r.lang === s.selectedLang || r.lang === "KO";
    const row = g.append("g").attr("class", "slope-dot")
      .style("cursor", "pointer")
      .on("mousemove", (e) => hover(e, r))
      .on("mouseleave", hideTip)
      .on("click", () => { setState({ selectedLang: r.lang }); document.getElementById("detail-section").scrollIntoView({ behavior: "smooth" }); });
    // connector
    row.append("line").attr("x1", x(r.rRank)).attr("x2", x(r.iRank)).attr("y1", yy).attr("y2", yy)
      .attr("class", "slope-line" + (hi ? " hi" : ""))
      .attr("stroke", r.better ? "var(--pos)" : "var(--neg)");
    // dots
    row.append("circle").attr("cx", x(r.rRank)).attr("cy", yy).attr("r", hi ? 6 : 5).attr("fill", README_C);
    row.append("circle").attr("cx", x(r.iRank)).attr("cy", yy).attr("r", hi ? 6 : 5).attr("fill", ISSUE_C);
    // label
    row.append("text").attr("x", ML - 12).attr("y", yy + 4).attr("text-anchor", "end")
      .attr("class", "slope-label" + (hi ? " hi" : "")).text(r.name);
  });

  caption.innerHTML = captionText(s, rows);
}

function hover(e, r) {
  const dir = r.better ? `up ${r.rRank - r.iRank} places` : (r.rRank === r.iRank ? "no change" : `down ${r.iRank - r.rRank} places`);
  showTip(
    `<div class="tt-title">${r.name}</div>` +
    `<div class="tt-row">README: <span class="num">${ordinal(r.rRank)}</span> · ${commas(r.rCount)}</div>` +
    `<div class="tt-row">Issues: <span class="num">${ordinal(r.iRank)}</span> · ${commas(r.iCount)}</div>` +
    `<div class="tt-row" style="color:var(--accent2)">Issue rank ${dir}</div>`, e);
  moveTip(e);
}

function captionText(s, rows) {
  const ko = rows.find((r) => r.lang === "KO");
  const pt = rows.find((r) => r.lang === "PT");
  let txt = `Strictness ${s.strictness}. `;
  if (ko) txt += `<strong>Korean</strong> is ${ordinal(ko.rRank)} in READMEs but ${ordinal(ko.iRank)} in issues — ` +
    `documented sparingly, discussed heavily. `;
  if (pt) txt += `<strong>Portuguese</strong> shows the opposite tilt (${ordinal(pt.rRank)} → ${ordinal(pt.iRank)}): ` +
    `strong in written READMEs. `;
  txt += `Green links mean a language ranks better in issues than READMEs; increase strictness (top) to sharpen the effect — ` +
    `at "all 3" it matches GitHub's published high-precision tables.`;
  return txt;
}

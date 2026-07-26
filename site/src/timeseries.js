import {
  select, scaleLinear, stack, area, curveMonotoneX, max as d3max, bisector,
  schemeTableau10, axisBottom, axisLeft, pointer, stackOffsetExpand, stackOffsetNone, format,
} from "d3";
import { getState, subscribe } from "./store.js";
import { timeseries, meta } from "./data.js";
import { human, commas } from "./format.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

const W = 920, H = 420, M = { t: 14, r: 16, b: 34, l: 52 };
const OTHER_C = "#55606f";
const DUR = 480;
const fPct = format(".1%");
const fPctAxis = format(".0%");

let holder, caption, controls;
let viewMode = "count"; // count | share — local, independent of source/strictness
let svg, areasG, veilG, xAxisG, yAxisG, guide, hoverRect, legendDiv;

export function mountTimeseries() {
  holder = document.getElementById("ts-holder");
  caption = document.getElementById("ts-caption");
  controls = document.getElementById("ts-controls");
  buildControls();
  render(getState());
  subscribe(render);
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => render(getState()), 180); });
}

function buildControls() {
  controls.innerHTML = `<span class="control-label" style="margin:0 8px 0 0">View</span>`;
  const seg = document.createElement("div");
  seg.className = "segmented compact";
  [["count", "Repositories"], ["share", "Share of year"]].forEach(([k, lbl]) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = lbl; b.dataset.k = k;
    const on = k === viewMode;
    b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", () => {
      if (viewMode === k) return;
      viewMode = k;
      seg.querySelectorAll("button").forEach((x) => {
        const a = x.dataset.k === k;
        x.classList.toggle("active", a); x.setAttribute("aria-pressed", String(a));
      });
      render(getState());
    });
    seg.appendChild(b);
  });
  controls.appendChild(seg);
}

function palette(langs) {
  const m = new Map();
  let i = 0;
  langs.forEach((l) => { m.set(l, l === "OTHER" ? OTHER_C : schemeTableau10[i++ % 10]); });
  return m;
}

function ensureSvg() {
  if (svg) return;
  svg = select(holder).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  areasG = svg.append("g").attr("class", "ts-areas");
  veilG = svg.append("g").attr("class", "ts-veil").style("opacity", 0);
  xAxisG = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.b})`);
  yAxisG = svg.append("g").attr("class", "axis").attr("transform", `translate(${M.l},0)`);
  guide = svg.append("line").attr("y1", M.t).attr("y2", H - M.b)
    .attr("stroke", "var(--text-faint)").attr("stroke-dasharray", "3 3").style("opacity", 0);
  hoverRect = svg.append("rect").attr("x", M.l).attr("y", M.t)
    .attr("width", W - M.r - M.l).attr("height", H - M.b - M.t).attr("fill", "transparent");
  legendDiv = document.createElement("div");
  legendDiv.className = "ts-legend";
  holder.appendChild(legendDiv);
}

function render(s) {
  const block = timeseries[s.source]?.[String(s.strictness)];
  if (!block || !block.data.length) {
    if (svg) { svg.remove(); svg = null; }
    if (legendDiv) { legendDiv.remove(); legendDiv = null; }
    holder.innerHTML = `<div class="empty">No time series for this view.</div>`;
    caption.textContent = ""; caption.classList.remove("ts-warn");
    return;
  }
  if (!svg) holder.innerHTML = "";
  ensureSvg();

  const { langs, data } = block;
  const colors = palette(langs);
  const share = viewMode === "share";

  const series = stack().keys(langs).offset(share ? stackOffsetExpand : stackOffsetNone)(data);
  const x = scaleLinear().domain([data[0].year, data[data.length - 1].year]).range([M.l, W - M.r]);
  const y = scaleLinear().range([H - M.b, M.t]);
  if (share) y.domain([0, 1]);
  else y.domain([0, d3max(series[series.length - 1], (d) => d[1]) || 1]).nice();

  const areaGen = area().x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(curveMonotoneX);

  // areas (keyed by language so colours stay put and mode switches morph smoothly)
  const paths = areasG.selectAll("path").data(series, (d) => d.key);
  paths.exit().remove();
  const ent = paths.enter().append("path")
    .attr("fill", (d) => colors.get(d.key)).attr("opacity", 0.86).attr("d", areaGen);
  ent.append("title");
  ent.merge(paths).attr("fill", (d) => colors.get(d.key))
    .transition().duration(DUR).attr("d", areaGen);
  areasG.selectAll("path").select("title").text((d) => meta.lang_names[d.key] || d.key);

  // axes (updated immediately; percent ticks in share mode)
  xAxisG.call(axisBottom(x).ticks(8).tickFormat((d) => String(d)));
  yAxisG.call(axisLeft(y).ticks(5).tickFormat(share ? fPctAxis : human));
  svg.selectAll(".axis path, .axis line").attr("stroke", "var(--line-soft)");
  svg.selectAll(".axis text").attr("fill", "var(--text-faint)")
    .style("font-family", "var(--mono)").style("font-size", "10px");

  // recent-year veil — only in share mode, where undercounting distorts proportions most
  const veilFrom = data[Math.max(0, data.length - 2)].year;
  veilG.selectAll("*").remove();
  if (share) {
    const vx = x(veilFrom);
    veilG.append("rect").attr("x", vx).attr("y", M.t)
      .attr("width", (W - M.r) - vx).attr("height", H - M.b - M.t)
      .attr("fill", "var(--bg)").attr("opacity", 0.58);
    veilG.append("line").attr("x1", vx).attr("x2", vx).attr("y1", M.t).attr("y2", H - M.b)
      .attr("stroke", "var(--accent)").attr("stroke-dasharray", "2 3").attr("opacity", 0.7);
    veilG.append("text").attr("x", (W - M.r) - 6).attr("y", M.t + 12).attr("text-anchor", "end")
      .attr("fill", "var(--accent)").style("font-family", "var(--mono)").style("font-size", "9px")
      .text("recent · undercounted");
  }
  // keep axes, guide and hover target above the veil so ticks stay crisp and hover still fires
  xAxisG.raise(); yAxisG.raise(); guide.raise(); hoverRect.raise();
  veilG.transition().duration(DUR).style("opacity", share ? 1 : 0);

  // hover
  const bis = bisector((d) => d.year).center;
  hoverRect
    .on("mousemove", (e) => {
      const [mx] = pointer(e, svg.node());
      const yr = Math.round(x.invert(mx));
      const row = data[bis(data, yr)];
      if (!row) return;
      guide.attr("x1", x(row.year)).attr("x2", x(row.year)).style("opacity", 1);
      const total = langs.reduce((a, l) => a + (row[l] || 0), 0) || 1;
      const items = langs.map((l) => [l, row[l] || 0]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      const rowsHtml = items.slice(0, 8).map(([l, v]) => {
        const val = share
          ? `<span class="num">${fPct(v / total)}</span> · ${commas(v)}`
          : `<span class="num">${commas(v)}</span>`;
        return `<div class="tt-row"><span class="dot" style="background:${colors.get(l)}"></span>${meta.lang_names[l] || l}: ${val}</div>`;
      }).join("");
      const partial = share && row.year >= veilFrom
        ? `<div class="tt-row" style="color:var(--accent)">recent year · undercounted, read with care</div>` : "";
      showTip(`<div class="tt-title">${row.year}</div>${rowsHtml}${partial}`, e);
      moveTip(e);
    })
    .on("mouseleave", () => { guide.style("opacity", 0); hideTip(); });

  // legend
  legendDiv.innerHTML = langs.map((l) =>
    `<span><span class="dot" style="background:${colors.get(l)}"></span>${meta.lang_names[l] || l}</span>`
  ).join("");

  // caption — deliberately different per mode
  const topN = block.langs.length - 1;
  const lastYear = data[data.length - 1].year;
  if (share) {
    caption.classList.add("ts-warn");
    caption.innerHTML =
      `<strong>Share of repositories per creation year</strong> — each year normalised to 100% across the ` +
      `${topN} top languages + “other”. This tells a different story from the counts, and is easier to misread. ` +
      `<strong>A falling share is not a decline:</strong> a language can keep growing in absolute numbers yet lose ` +
      `share when others grow faster — switch to <em>Repositories</em> to check the raw counts. And this view is ` +
      `<strong>more exposed to recent-year undercounting</strong> than the counts: issue and PR coverage thins over ` +
      `time and at <em>different rates per language</em> (the same README→issue coverage fall, 7.5% → 1.4%, noted in ` +
      `the method), so the shaded final years (${veilFrom}–${lastYear}) can show proportion shifts that are ` +
      `classification-density artefacts, not real change. Don’t read the shaded years.`;
  } else {
    caption.classList.remove("ts-warn");
    caption.innerHTML =
      `Repositories by creation year · ${topN} top languages + “other”. ` +
      `The <strong>${lastYear}</strong> column is a partial snapshot (${meta.snapshot_day}) and ` +
      `recent years are undercounted — a young repository has fewer issues and PRs to classify, so it is easier ` +
      `to see in READMEs than in conversation. Read the shape, not the last step down. ` +
      `Switch to <em>Share of year</em> to see how the proportions shift.`;
  }
}

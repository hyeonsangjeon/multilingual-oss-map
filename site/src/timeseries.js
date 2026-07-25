import {
  select, scaleLinear, stack, area, curveMonotoneX, max as d3max, bisector,
  schemeTableau10, axisBottom, axisLeft, pointer,
} from "d3";
import { getState, subscribe } from "./store.js";
import { timeseries, meta } from "./data.js";
import { human, commas } from "./format.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

const W = 920, H = 420, M = { t: 14, r: 16, b: 34, l: 52 };
const OTHER_C = "#55606f";
let holder, caption;

export function mountTimeseries() {
  holder = document.getElementById("ts-holder");
  caption = document.getElementById("ts-caption");
  render(getState());
  subscribe(render);
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => render(getState()), 180); });
}

function palette(langs) {
  const m = new Map();
  let i = 0;
  langs.forEach((l) => {
    if (l === "OTHER") m.set(l, OTHER_C);
    else m.set(l, schemeTableau10[i++ % 10]);
  });
  return m;
}

function render(s) {
  const block = timeseries[s.source]?.[String(s.strictness)];
  holder.innerHTML = "";
  if (!block || !block.data.length) { holder.innerHTML = `<div class="empty">No time series for this view.</div>`; return; }
  const { langs, data } = block;
  const colors = palette(langs);

  const series = stack().keys(langs)(data);
  const x = scaleLinear().domain([data[0].year, data[data.length - 1].year]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, d3max(series[series.length - 1], (d) => d[1]) || 1]).nice().range([H - M.b, M.t]);

  const svg = select(holder).append("svg").attr("viewBox", `0 0 ${W} ${H}`);

  const areaGen = area().x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(curveMonotoneX);
  svg.append("g").selectAll("path").data(series).join("path")
    .attr("fill", (d) => colors.get(d.key)).attr("opacity", 0.86).attr("d", areaGen)
    .append("title").text((d) => meta.lang_names[d.key] || d.key);

  // axes
  const xa = axisBottom(x).ticks(8).tickFormat((d) => String(d));
  const ya = axisLeft(y).ticks(5).tickFormat(human);
  svg.append("g").attr("transform", `translate(0,${H - M.b})`).attr("class", "axis").call(xa);
  svg.append("g").attr("transform", `translate(${M.l},0)`).attr("class", "axis").call(ya);
  svg.selectAll(".axis path, .axis line").attr("stroke", "var(--line-soft)");
  svg.selectAll(".axis text").attr("fill", "var(--text-faint)").style("font-family", "var(--mono)").style("font-size", "10px");

  // hover guide
  const guide = svg.append("line").attr("y1", M.t).attr("y2", H - M.b).attr("stroke", "var(--text-faint)").attr("stroke-dasharray", "3 3").style("opacity", 0);
  const bis = bisector((d) => d.year).center;
  svg.append("rect").attr("x", M.l).attr("y", M.t).attr("width", W - M.r - M.l).attr("height", H - M.b - M.t)
    .attr("fill", "transparent")
    .on("mousemove", (e) => {
      const [mx] = pointer(e, svg.node());
      const yr = Math.round(x.invert(mx));
      const row = data[bis(data, yr)];
      if (!row) return;
      guide.attr("x1", x(row.year)).attr("x2", x(row.year)).style("opacity", 1);
      const items = langs.map((l) => [l, row[l] || 0]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      showTip(
        `<div class="tt-title">${row.year}</div>` +
        items.slice(0, 8).map(([l, v]) =>
          `<div class="tt-row"><span class="dot" style="background:${colors.get(l)}"></span>${meta.lang_names[l] || l}: <span class="num">${commas(v)}</span></div>`
        ).join(""), e);
      moveTip(e);
    })
    .on("mouseleave", () => { guide.style("opacity", 0); hideTip(); });

  // legend
  const legend = document.createElement("div");
  legend.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:.8rem;color:var(--text-dim)";
  legend.innerHTML = langs.map((l) =>
    `<span><span class="dot" style="background:${colors.get(l)}"></span>${meta.lang_names[l] || l}</span>`
  ).join("");
  holder.appendChild(legend);

  caption.innerHTML =
    `Repositories by creation year · ${block.langs.length - 1} top languages + “other”. ` +
    `The <strong>${data[data.length - 1].year}</strong> column is a partial snapshot (${meta.snapshot_day}) and ` +
    `recent years are undercounted — a young repository has fewer issues and PRs to classify, so it is easier ` +
    `to see in READMEs than in conversation. Read the shape, not the last step down.`;
}

import {
  select, geoNaturalEarth1, geoPath, geoGraticule10,
  scaleSequentialLog, interpolateViridis, scaleLinear,
} from "d3";
import { getState, setState, subscribe } from "./store.js";
import {
  countries, countryValues, countriesForLang, totalsFor, lookupTotal, langName, langRegions,
} from "./data.js";
import { commas, human, ordinal, SOURCE_LABEL } from "./format.js";
import { showTip, moveTip, hideTip } from "./tooltip.js";

const W = 960, H = 500;
const MOBILE_BP = 640;

let holder, legend, caption, pathGen, colorScale;
let scLo = 1, scHi = 2;
let mapBuilt = false, barsBox = null, narrow = false;

export function mountMap() {
  holder = document.getElementById("map-holder");
  legend = document.getElementById("map-legend");
  caption = document.getElementById("map-caption");

  const proj = geoNaturalEarth1().fitSize([W, H], { type: "Sphere" });
  pathGen = geoPath(proj);

  render(getState());
  subscribe(render);

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => render(getState()), 180);
  });
}

function wantBars() {
  return (holder.clientWidth || window.innerWidth) < MOBILE_BP;
}

function computeScale(values) {
  const counts = [...values.values()].map((v) => v.count).filter((c) => c > 0);
  scHi = Math.max(2, ...counts);
  const rawLo = counts.length ? Math.min(...counts) : 1;
  // Keep the ramp readable: cap the span so a single tiny outlier can't wash the map out.
  scLo = Math.max(1, rawLo, Math.floor(scHi / 6000));
  if (scLo >= scHi) scLo = Math.max(1, Math.floor(scHi / 2));
  colorScale = scaleSequentialLog(interpolateViridis).domain([scLo, scHi]).clamp(true);
}

function render(s) {
  const values = countryValues(s.source, s.strictness);
  computeScale(values);
  narrow = wantBars();
  if (!mapBuilt) buildMap();
  holder.classList.toggle("static", narrow); // non-interactive overview on small screens
  if (narrow) hideTip();
  updateMap(s, values);
  if (narrow) { ensureBars(); updateBars(s); }
  else if (barsBox) { barsBox.remove(); barsBox = null; }
  renderLegend(s);
  renderCaption(s, values);
}

/* ---------------- MAP ---------------- */
function buildMap() {
  const svg = select(holder).append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr("aria-label", "World choropleth of non-English repository language");
  svg.append("path").attr("class", "sphere").attr("d", pathGen({ type: "Sphere" }));
  svg.append("path").attr("class", "graticule").attr("d", pathGen(geoGraticule10()));
  svg.append("g").attr("class", "countries")
    .selectAll("path")
    .data(countries, (d) => d.id)
    .join("path")
    .attr("class", "country")
    .attr("d", pathGen)
    .on("mousemove", onHover)
    .on("mouseleave", hideTip)
    .on("click", onClick);
  mapBuilt = true;
}

function onHover(event, d) {
  const s = getState();
  const values = countryValues(s.source, s.strictness);
  const v = values.get(d.id);
  const cname = d.properties.name;
  if (!v) {
    showTip(`<div class="tt-title">${cname}</div><div class="tt-row">No mapped non-English language</div>`, event);
    return;
  }
  const ranks = SOURCES().map((src) => {
    const t = lookupTotal(src, s.strictness, v.lang);
    return `<div class="tt-row">${SOURCE_LABEL[src]}: ${t ? `<span class="num">${ordinal(t.rank)}</span> · ${commas(t.count)}` : "\u2014"}</div>`;
  }).join("");
  showTip(
    `<div class="tt-title">${v.name} <span class="num" style="color:var(--text-faint)">in ${cname}</span></div>` +
    `<div class="tt-row" style="color:var(--accent2)">Region shaded by its top language</div>` + ranks,
    event
  );
  moveTip(event);
}

function onClick(event, d) {
  const s = getState();
  const v = countryValues(s.source, s.strictness).get(d.id);
  if (v) {
    setState({ selectedLang: v.lang, mapInteracted: true });
    document.getElementById("detail-section").scrollIntoView({ behavior: "smooth" });
  }
}

function updateMap(s, values) {
  const sel = s.selectedLang;
  // Only dim to a selection once the user has clicked the map — keep it whole on load.
  const selSet = s.mapInteracted && sel ? countriesForLang(sel) : null;
  select(holder).selectAll("path.country")
    .attr("fill", (d) => {
      const v = values.get(d.id);
      return v ? colorScale(v.count) : "#172032";
    })
    .classed("nodata", (d) => !values.get(d.id))
    .classed("dim", (d) => (selSet ? !selSet.has(d.id) : false))
    .classed("hl", (d) => (selSet ? selSet.has(d.id) : false));
  // lift the highlighted regions above their neighbours so the outline isn't clipped
  if (selSet) select(holder).selectAll("path.country.hl").raise();
}

/* ---------------- BARS (shown below the map on narrow screens) ---------------- */
function ensureBars() {
  if (barsBox) return;
  barsBox = select(holder).append("div").attr("class", "map-bars");
  barsBox.append("div").attr("class", "bars-hint")
    .text("Regions above are coloured by their top language. Tap a bar to spotlight it on the map \u2191");
  barsBox.append("div").attr("class", "bars");
}
function updateBars(s) {
  const list = topMappable(s.source, s.strictness, 15);
  const max = Math.max(1, ...list.map((d) => d.count));
  const x = scaleLinear().domain([0, max]).range([0, 100]);
  const box = barsBox.select(".bars");
  box.selectAll(".bar-row")
    .data(list, (d) => d.lang)
    .join((enter) => {
      const r = enter.append("div").attr("class", "bar-row");
      r.append("div").attr("class", "bl");
      r.append("div").append("div").attr("class", "bt");
      r.append("div").attr("class", "bv");
      r.on("click", (e, d) => {
        // display-only map above reacts to the tap; detail panel (below) updates too
        setState({ selectedLang: d.lang, mapInteracted: true });
      });
      return r;
    })
    .classed("active", (d) => d.lang === s.selectedLang)
    .each(function (d) {
      const row = select(this);
      row.select(".bl").text(d.name);
      row.select(".bt").style("width", x(d.count) + "%").style("background", colorScale(d.count));
      row.select(".bv").text(human(d.count));
    });
}

function topMappable(source, strictness, n) {
  return totalsFor(source, strictness).filter((r) => langRegions.regions[r.lang]).slice(0, n);
}

/* ---------------- legend & caption ---------------- */
function renderLegend(s) {
  const stops = [];
  for (let i = 0; i <= 10; i++) stops.push(interpolateViridis(i / 10));
  const mid = Math.round(Math.sqrt(scLo * scHi));
  legend.innerHTML =
    `<div><div class="legend-bar" style="background:linear-gradient(90deg,${stops.join(",")})"></div>` +
    `<div class="legend-ticks"><span>${human(scLo)}</span><span>${human(mid)}</span><span>${human(scHi)}</span></div></div>` +
    `<div class="legend-note">Repositories classified in the ${SOURCE_LABEL[s.source]} (log scale). ` +
    `Colour marks where a language is spoken — <strong>not</strong> where repositories are located.</div>`;
}

function renderCaption(s, values) {
  const top = totalsFor(s.source, s.strictness).filter((r) => langRegions.regions[r.lang])[0];
  const shaded = values.size;
  caption.innerHTML =
    `${SOURCE_LABEL[s.source]} · strictness ${s.strictness}. ${shaded} countries shaded; ` +
    `${top ? `<strong>${top.name}</strong> leads with ${commas(top.count)} repositories.` : ""} ` +
    `Switch the source tabs above — the distribution shifts because documentation and conversation ` +
    `happen in different languages. Broad languages (Spanish, Arabic, French) span many countries; see ` +
    `<a href="#methodology">method &amp; limitations</a>.`;
}

function SOURCES() {
  return ["readme", "issue", "pull_request"];
}

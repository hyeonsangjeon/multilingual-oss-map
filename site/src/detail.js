import { getState, setState, subscribe } from "./store.js";
import { langDetail, lookupTotal, totalsFor, langRegions, meta } from "./data.js";
import { commas, human, ordinal, pct, SOURCE_LABEL } from "./format.js";

const AGREE_C = ["#9db8d0", "#57a9d8", "#1f9fdd"]; // exactly 1 / 2 / all 3
const SOURCES = ["readme", "issue", "pull_request"];

let picker, panel;

export function mountDetail() {
  picker = document.getElementById("detail-picker");
  panel = document.getElementById("detail-panel");
  render(getState());
  subscribe(render);
}

function pickerLangs(s) {
  const set = new Set();
  SOURCES.forEach((src) => totalsFor(src, s.strictness).slice(0, 8).forEach((r) => set.add(r.lang)));
  ["KO", "PT", "JA"].forEach((l) => set.add(l));
  // order by readme rank then name
  const rank = new Map(totalsFor("readme", s.strictness).map((r) => [r.lang, r.rank]));
  return [...set].sort((a, b) => (rank.get(a) || 999) - (rank.get(b) || 999));
}

function render(s) {
  renderPicker(s);
  if (!s.selectedLang) {
    panel.innerHTML =
      `<div class="empty">Select a language above, click a region on the map, or pick a line in the ` +
      `asymmetry chart to see how it is documented, discussed, and reviewed.</div>`;
    return;
  }
  renderPanel(s);
}

function renderPicker(s) {
  picker.innerHTML = "";
  pickerLangs(s).forEach((lang) => {
    const name = meta.lang_names[lang] || lang;
    const b = document.createElement("button");
    b.className = "chip" + (lang === s.selectedLang ? " active" : "");
    b.type = "button";
    b.textContent = name;
    b.addEventListener("click", () =>
      setState({ selectedLang: s.selectedLang === lang ? null : lang })
    );
    picker.appendChild(b);
  });
}

function renderPanel(s) {
  const lang = s.selectedLang;
  const name = meta.lang_names[lang] || lang;
  const region = langRegions.regions[lang];
  const det = langDetail[lang] || {};

  const rows = SOURCES.map((src) => ({ src, t: lookupTotal(src, s.strictness, lang) }));
  const maxCount = Math.max(1, ...rows.map((r) => (r.t ? r.t.count : 0)));

  const rm = lookupTotal("readme", s.strictness, lang);
  const iss = lookupTotal("issue", s.strictness, lang);
  let movement = "";
  if (rm && iss) {
    const d = rm.rank - iss.rank;
    movement =
      d > 0
        ? `<span class="badge" style="border-color:#2f5a3f;color:var(--pos)">discussed more than documented (+${d} in issues)</span>`
        : d < 0
        ? `<span class="badge" style="border-color:#5a2f3f;color:var(--neg)">documented more than discussed (${d} in issues)</span>`
        : "";
  }

  const dsrc = det[s.source] || {};
  const agree = dsrc.agree || null;
  const pl = dsrc.pl_top5 || [];
  const plMax = Math.max(1, ...pl.map((p) => p.count));

  panel.innerHTML = `
    <div class="detail-title">
      <span class="dt-name">${name}</span>
      <span class="dt-code num">${lang}</span>
      ${region ? `<span class="badge">${region.broad ? "spoken across many countries" : region.regional ? "regional language" : "national language"}</span>` : ""}
      ${movement}
    </div>
    <p class="detail-guide">Showing <strong>${name}</strong> — pick another language from the chips above, or click a region on the map.</p>
    <div class="detail-grid">
      <div class="card">
        <h3>Across text sources · strictness ${s.strictness}</h3>
        <div class="src-rows">
          ${rows
            .map(
              ({ src, t }) => `
            <div class="src-row">
              <div class="sname">${SOURCE_LABEL[src]}</div>
              <div class="sbar" style="width:${t ? Math.max(4, (t.count / maxCount) * 100) : 0}%;${
                src === s.source ? "" : "opacity:.55"
              }"></div>
              <div class="sval">${t ? commas(t.count) : "\u2014"}<span class="srank"> · ${
                t ? ordinal(t.rank) : "\u2014"
              }</span></div>
            </div>`
            )
            .join("")}
        </div>
        <p class="caption" style="margin-top:14px;border:0;padding:0">${crossSourceNote(name, rm, iss)}</p>
      </div>

      <div class="card">
        <h3>Classifier agreement · ${SOURCE_LABEL[s.source]}</h3>
        ${agree ? agreeMarkup(agree) : `<div class="empty" style="padding:20px 0">No ${SOURCE_LABEL[s.source]} for this language.</div>`}
      </div>

      <div class="card">
        <h3>Repositories · ${SOURCE_LABEL[s.source]}</h3>
        ${
          pl.length
            ? `<div class="pl-list">${pl
                .map(
                  (p) => `
          <div class="pl-row">
            <div class="pln">${p.name}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="pl-bar" style="width:${Math.max(10, (p.count / plMax) * 90)}px"></div>
              <span class="num" style="color:var(--text-dim);font-size:.82rem">${human(p.count)}</span>
            </div>
          </div>`
                )
                .join("")}</div>`
            : `<div class="empty" style="padding:10px 0">\u2014</div>`
        }
        ${starMarkup(dsrc)}
      </div>
    </div>`;
}

function agreeMarkup(agree) {
  const a1 = agree["1"] || 0, a2 = agree["2"] || 0, a3 = agree["3"] || 0;
  const tot = a1 + a2 + a3 || 1;
  const seg = (v, i, lbl) =>
    `<div class="agree-seg" style="width:${(v / tot) * 100}%;background:${AGREE_C[i]}" title="${lbl}: ${commas(v)}">${
      v / tot > 0.07 ? pct(v / tot) : ""
    }</div>`;
  return `
    <div class="agree-bars">
      ${seg(a1, 0, "exactly 1 classifier")}${seg(a2, 1, "exactly 2 classifiers")}${seg(a3, 2, "all 3 classifiers")}
    </div>
    <div class="agree-legend">
      <span><span class="dot" style="background:${AGREE_C[0]}"></span>1 classifier</span>
      <span><span class="dot" style="background:${AGREE_C[1]}"></span>2 agree</span>
      <span><span class="dot" style="background:${AGREE_C[2]}"></span>all 3 agree</span>
    </div>
    <p class="caption" style="margin-top:12px;border:0;padding:0">
      The strictness dial cuts from the left: <strong>≥2</strong> drops the single-classifier block,
      <strong>all 3</strong> keeps only the darkest. ${commas(a2 + a3)} repos survive at 2-of-3.
    </p>`;
}

function starMarkup(d) {
  if (d.stars_median == null) return "";
  const note =
    d.stars_median === 0
      ? `<p class="caption" style="margin-top:10px;border:0;padding:0">At least half of these repositories have 0 stars — open source is a long tail.</p>`
      : "";
  return `
    <div class="stat-inline" style="margin-top:14px">
      <div class="si"><div class="k">median ★</div><div class="v">${commas(d.stars_median)}</div></div>
      <div class="si"><div class="k">p90 ★</div><div class="v">${commas(d.stars_p90)}</div></div>
      <div class="si"><div class="k">p99 ★</div><div class="v">${commas(d.stars_p99)}</div></div>
      <div class="si"><div class="k">median forks</div><div class="v">${commas(d.forks_median)}</div></div>
    </div>${note}`;
}

function crossSourceNote(name, rm, iss) {
  if (!rm || !iss) return `${name} does not appear in every text source at this strictness.`;
  if (iss.rank < rm.rank)
    return `${name} ranks <strong>${ordinal(iss.rank)}</strong> in issue conversation but only ${ordinal(
      rm.rank
    )} in READMEs — a mother-tongue signal in discussion.`;
  if (rm.rank < iss.rank)
    return `${name} ranks <strong>${ordinal(rm.rank)}</strong> in READMEs, ahead of its ${ordinal(
      iss.rank
    )} in issues — strong in written documentation.`;
  return `${name} ranks ${ordinal(rm.rank)} in both READMEs and issues.`;
}

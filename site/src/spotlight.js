// Compact description card shown in the map area when a language is selected.
// Mirrors the map's spotlight: appears only once the map is focused on a language
// (mapInteracted && selectedLang), and reads out that language's cross-source ranks
// so the highlight on the map above is explained without scrolling to the detail panel.
import { getState, setState, subscribe } from "./store.js";
import { meta, langName, lookupTotal, langRegions } from "./data.js";
import { hueForLang } from "./palette.js";
import { human, ordinal, commas, SOURCE_LABEL } from "./format.js";
import { buildShareControl } from "./share.js";

let el;

export function mountSpotlight() {
  el = document.getElementById("map-spotlight");
  render(getState());
  subscribe(render);
}

function regionDesc(region) {
  if (!region) return "";
  if (region.broad) return "spoken across many countries";
  if (region.regional) return "a regional language";
  return "a national language";
}

function rankCell(src, t, current) {
  return (
    `<div class="sl-rank${current ? " cur" : ""}">` +
    `<div class="sl-src">${SOURCE_LABEL[src]}</div>` +
    `<div class="sl-ord">${t ? ordinal(t.rank) : "\u2014"}</div>` +
    `<div class="sl-cnt">${t ? human(t.count) : "no data"}</div>` +
    `</div>`
  );
}

function takeaway(name, rm, iss) {
  if (!rm || !iss) return `${name} does not appear in every text source at this strictness.`;
  if (iss.rank < rm.rank)
    return `<strong>${ordinal(iss.rank)}</strong> in issue conversation, but ${ordinal(
      rm.rank
    )} in READMEs — a mother-tongue signal in discussion.`;
  if (rm.rank < iss.rank)
    return `<strong>${ordinal(rm.rank)}</strong> in READMEs, ahead of ${ordinal(
      iss.rank
    )} in issues — strongest in written docs.`;
  return `${ordinal(rm.rank)} in both READMEs and issues.`;
}

function render(s) {
  if (!el) return;
  if (!s.mapInteracted || !s.selectedLang) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }

  const lang = s.selectedLang;
  const name = meta.lang_names[lang] || langName(lang);
  const hue = hueForLang(lang);
  const region = langRegions.regions[lang];
  const n = region ? region.countries.length : 0;
  const desc = regionDesc(region);

  const rm = lookupTotal("readme", s.strictness, lang);
  const iss = lookupTotal("issue", s.strictness, lang);
  const pr = lookupTotal("pull_request", s.strictness, lang);

  el.hidden = false;
  el.style.borderLeftColor = hue;
  el.innerHTML =
    `<div class="sl-head">` +
    `<span class="sl-swatch" style="background:${hue}"></span>` +
    `<span class="sl-name">${name}</span>` +
    `<span class="sl-code num">${lang}</span>` +
    (desc ? `<span class="sl-badge">${desc}</span>` : "") +
    `<button class="sl-clear" type="button" aria-label="Clear map highlight" title="Clear map highlight">\u00d7</button>` +
    `</div>` +
    `<div class="sl-ranks">` +
    rankCell("readme", rm, s.source === "readme") +
    rankCell("issue", iss, s.source === "issue") +
    rankCell("pull_request", pr, s.source === "pull_request") +
    `</div>` +
    `<p class="sl-take">${takeaway(name, rm, iss)}</p>` +
    `<p class="sl-hint">Highlighted on the map above · ${commas(n)} ${
      n === 1 ? "region" : "regions"
    }. Pick another region, bar, or legend chip to compare.</p>`;

  el.querySelector(".sl-clear").addEventListener("click", () =>
    setState({ mapInteracted: false })
  );
  el.appendChild(buildShareControl(lang));
}

// Central data module: bundles the aggregate JSON + world topology at build time
// (small enough — ~0.4 MB total — and avoids fetch/base-path issues on GitHub Pages).
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";

import meta from "../data/meta.json";
import langTotals from "../data/lang-totals.json";
import langDetail from "../data/lang-detail.json";
import timeseries from "../data/timeseries.json";
import langStack from "../data/lang-stack.json";
import mechanism from "../data/asymmetry-mechanism.json";
import langRegions from "../data/lang-regions.json";
import isoCountries from "../data/iso-countries.json";

export { meta, langTotals, langDetail, timeseries, langStack, mechanism, langRegions, isoCountries };

// World country features (ids are ISO 3166-1 numeric strings, e.g. "076").
export const countries = feature(worldTopo, worldTopo.objects.countries).features;

export const langName = (code) => meta.lang_names[code] || (langRegions.regions[code]?.name) || code;

// alpha-3 -> zero-padded numeric string used by the TopoJSON feature ids
export const numericOf = (alpha3) => isoCountries[alpha3]?.numeric || null;

// Ranked language list for the current source + strictness: [{lang,name,count,rank}]
export function totalsFor(source, strictness) {
  return langTotals[source]?.[String(strictness)] || [];
}

export function lookupTotal(source, strictness, lang) {
  return totalsFor(source, strictness).find((r) => r.lang === lang) || null;
}

// Build country(numeric) -> {lang, count, rank, name} for the OVERVIEW map.
// Each country is shaded by the mapped language with the largest count (documented
// in docs/language-region-mapping.md). English is never included.
export function countryValues(source, strictness) {
  const totals = totalsFor(source, strictness);
  const countByLang = new Map(totals.map((r) => [r.lang, r]));
  const out = new Map(); // numeric -> {lang, count, rank}
  for (const [lang, region] of Object.entries(langRegions.regions)) {
    const rec = countByLang.get(lang);
    if (!rec || !rec.count) continue;
    for (const a3 of region.countries) {
      const num = numericOf(a3);
      if (!num) continue;
      const prev = out.get(num);
      if (!prev || rec.count > prev.count) {
        out.set(num, { lang, name: rec.name, count: rec.count, rank: rec.rank });
      }
    }
  }
  return out;
}

// Countries (numeric set) that belong to a single language's region.
export function countriesForLang(lang) {
  const region = langRegions.regions[lang];
  if (!region) return new Set();
  const s = new Set();
  for (const a3 of region.countries) {
    const num = numericOf(a3);
    if (num) s.add(num);
  }
  return s;
}

export const isMappable = (lang) => !!langRegions.regions[lang];

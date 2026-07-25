// Map colour encoding — two variables kept separate:
//   HUE       = language identity  (categorical, fixed globally)
//   LIGHTNESS = repository volume   (discrete quantile bins)
//
// Hues are based on the Okabe–Ito colour-blind-safe palette. Six of its hues are
// used as-is; Okabe–Ito's reddish-purple was dropped because it collapses onto the
// neutral "Other" grey under deuteranopia, so the two lowest-ranked, geographically
// isolated languages use a magenta + red instead (both verified against their map
// neighbours with a deuteranopia/protanopia simulation). See docs/decisions.md D11.
import { hcl } from "d3";
import { langTotals, langRegions, langName } from "./data.js";

const HUES = [
  "#E69F00", // 1 orange
  "#56B4E9", // 2 sky blue
  "#009E73", // 3 bluish green
  "#F0E442", // 4 yellow
  "#0072B2", // 5 blue
  "#D55E00", // 6 vermillion
  "#E7298A", // 7 magenta
  "#CC3311", // 8 red
];
export const OTHER_HUE = "#8A94A6"; // neutral slate — languages outside the top 8
export const NODATA = "#172032";    // regions with no mapped non-English language

// The top-8 mappable languages by all-3 README count, computed once and FIXED so a
// language keeps its colour across every source tab and strictness level (the key
// comparability rule — switching tabs must move the distribution, not the mapping).
function computeTop8() {
  const mappable = new Set(Object.keys(langRegions.regions));
  return (langTotals.readme?.["3"] || [])
    .filter((r) => mappable.has(r.lang))
    .slice(0, 8)
    .map((r) => r.lang);
}
export const TOP8 = computeTop8();
const HUE_OF = new Map(TOP8.map((lang, i) => [lang, HUES[i]]));

export const isTop8 = (lang) => HUE_OF.has(lang);
export const hueForLang = (lang) => HUE_OF.get(lang) || OTHER_HUE;

// Discrete lightness steps (dark = low volume, light = high volume). All four stay
// clearly visible on the dark map. Applied in HCL so each hue keeps its identity.
export const BIN_L = [56, 67, 78, 88];
export const BINS = BIN_L.length;

export function shadeHex(hue, bin) {
  const c = hcl(hue);
  const L = BIN_L[Math.max(0, Math.min(BINS - 1, bin | 0))];
  return hcl(c.h, c.c, L).formatHex();
}

// Legend model: the eight identity chips (in fixed rank order) plus Other.
export function legendChips() {
  const chips = TOP8.map((lang) => ({ lang, name: langName(lang), hue: HUE_OF.get(lang) }));
  chips.push({ lang: null, name: "Other", hue: OTHER_HUE });
  return chips;
}

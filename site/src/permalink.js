// Deep-link support. A URL like ?lang=KO (optionally &src=issue&strict=2) selects
// and spotlights a language on load, and the address bar is kept in sync with map
// focus so any view is shareable. This pairs with the static per-language stubs
// under /l/<code>/ that carry the social-unfurl OG cards (a static host can't set
// per-language meta at runtime). See scripts/gen_share_cards.py + docs/decisions.md D22.
import { getState, setState, subscribe } from "./store.js";
import { meta } from "./data.js";

const SRC_ALIASES = {
  readme: "readme",
  readmes: "readme",
  issue: "issue",
  issues: "issue",
  pr: "pull_request",
  prs: "pull_request",
  pull_request: "pull_request",
  pullrequest: "pull_request",
  pull_requests: "pull_request",
};
const SRC_OUT = { readme: "readme", issue: "issue", pull_request: "pr" };

function parse() {
  const p = new URLSearchParams(location.search);
  const patch = {};
  const lang = (p.get("lang") || "").trim().toUpperCase();
  if (lang && meta.lang_names[lang]) {
    patch.selectedLang = lang;
    patch.mapInteracted = true;
  }
  const src = SRC_ALIASES[(p.get("src") || p.get("source") || "").trim().toLowerCase()];
  if (src) patch.source = src;
  const st = parseInt(p.get("strict") || p.get("strictness") || "", 10);
  if (st === 1 || st === 2 || st === 3) patch.strictness = st;
  return patch;
}

// Apply URL params to the store BEFORE components mount so the first render is
// already correct. Returns the patch so the caller can react (e.g. scroll).
export function applyInitialParams() {
  const patch = parse();
  if (Object.keys(patch).length) setState(patch);
  return patch;
}

// After mount: if the visitor arrived on a language deep link, bring the map (and
// its spotlight) into view so the highlighted regions are the first thing they see.
export function scrollToDeepLink(patch) {
  if (!patch || !patch.selectedLang) return;
  requestAnimationFrame(() => {
    document.getElementById("map-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

// Keep the address bar in sync with meaningful state so it is always shareable.
// lang is reflected only once the map is focused (mapInteracted) to keep the bare
// landing URL clean; src/strict appear only when non-default.
export function initUrlSync() {
  subscribe((s) => {
    const p = new URLSearchParams();
    if (s.selectedLang && s.mapInteracted) p.set("lang", s.selectedLang);
    if (s.source && s.source !== "readme") p.set("src", SRC_OUT[s.source]);
    if (s.strictness && s.strictness !== 3) p.set("strict", String(s.strictness));
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  });
}

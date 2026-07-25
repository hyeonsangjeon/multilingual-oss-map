// Tiny global state store with pub/sub. State: { strictness, source, selectedLang }.
const state = {
  strictness: 3, // default = all-3 agree (matches GitHub's published tables; see docs/decisions.md D9)
  source: "readme",
  selectedLang: null,
};

const listeners = new Set();

export function getState() {
  return { ...state };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  let changed = false;
  for (const k of Object.keys(patch)) {
    if (state[k] !== patch[k]) {
      state[k] = patch[k];
      changed = true;
    }
  }
  if (changed) {
    for (const fn of listeners) fn(getState());
  }
}

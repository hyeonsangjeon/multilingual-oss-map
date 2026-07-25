import { getState, setState, subscribe } from "./store.js";
import { meta } from "./data.js";
import { SOURCE_LABEL } from "./format.js";

const STRICT = [1, 2, 3];
const STRICT_SHORT = { 1: "≥1", 2: "2-of-3", 3: "all 3" };

// Full strictness control with description (hero). Also mounts a compact clone in the topbar.
export function mountStrictness(container, { compact = false } = {}) {
  const wrap = document.createElement("div");
  if (!compact) {
    const label = document.createElement("div");
    label.className = "control-label";
    label.textContent = "Classifier strictness — the honesty dial";
    wrap.appendChild(label);
  }
  const seg = document.createElement("div");
  seg.className = "segmented" + (compact ? " compact" : "");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Classifier strictness");
  STRICT.forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.k = k;
    b.textContent = compact ? STRICT_SHORT[k] : `${STRICT_SHORT[k]}`;
    b.title = meta.strictness.labels[k];
    b.addEventListener("click", () => setState({ strictness: k }));
    seg.appendChild(b);
  });
  wrap.appendChild(seg);
  let desc;
  if (!compact) {
    desc = document.createElement("div");
    desc.className = "desc";
    wrap.appendChild(desc);
  }
  container.appendChild(wrap);

  const sync = (s) => {
    seg.querySelectorAll("button").forEach((b) => {
      const on = Number(b.dataset.k) === s.strictness;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (desc) desc.textContent = meta.strictness.labels[s.strictness];
  };
  sync(getState());
  subscribe(sync);
}

export function mountSourceTabs(container) {
  container.innerHTML = "";
  meta.sources.forEach((src) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.src = src;
    b.setAttribute("role", "tab");
    b.textContent = SOURCE_LABEL[src];
    b.addEventListener("click", () => setState({ source: src }));
    container.appendChild(b);
  });
  const sync = (s) => {
    container.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.src === s.source;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  };
  sync(getState());
  subscribe(sync);
}

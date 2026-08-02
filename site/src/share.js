// Per-language social share control (Copy link / X / LinkedIn). It targets the
// static stub URL (…/l/<code>/) — not the SPA deep link — because only the stub
// carries the per-language OG card a crawler can read on a static host. Humans who
// open the stub are redirected straight into the app deep link. See permalink.js
// and scripts/gen_share_cards.py.
import { meta } from "./data.js";

// Absolute URL of a language's share stub, derived from where the app is served so
// it works on GitHub Pages under /multilingual-oss-map/ and locally at /.
export function shareUrlFor(code) {
  const dir = location.pathname.replace(/[^/]*$/, ""); // strip filename, keep trailing dir
  return location.origin + dir + "l/" + code.toLowerCase() + "/";
}

export function buildShareControl(code) {
  const name = meta.lang_names[code] || code;
  const url = shareUrlFor(code);
  const text = `${name} in open source — how it ranks in READMEs vs issues vs pull requests`;
  const x =
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(text) +
    "&url=" +
    encodeURIComponent(url);
  const li =
    "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url);

  const wrap = document.createElement("div");
  wrap.className = "share";
  wrap.innerHTML =
    `<span class="share-label">Share ${name}</span>` +
    `<button class="share-btn" type="button" data-act="copy" title="Copy shareable link">Copy link</button>` +
    `<a class="share-btn" href="${x}" target="_blank" rel="noopener noreferrer">X</a>` +
    `<a class="share-btn" href="${li}" target="_blank" rel="noopener noreferrer">LinkedIn</a>`;

  const copy = wrap.querySelector('[data-act="copy"]');
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* no-op */
      }
      ta.remove();
    }
    const prev = copy.textContent;
    copy.textContent = "Copied \u2713";
    copy.classList.add("ok");
    setTimeout(() => {
      copy.textContent = prev;
      copy.classList.remove("ok");
    }, 1600);
  });
  return wrap;
}

const el = document.getElementById("tooltip");
let raf = null;

export function showTip(html, event) {
  el.innerHTML = html;
  el.classList.add("show");
  moveTip(event);
}

export function moveTip(event) {
  if (!event) return;
  const x = event.clientX;
  const y = event.clientY;
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    let left = x + 14;
    let top = y + 16;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 16;
    el.style.left = Math.max(8, left) + "px";
    el.style.top = Math.max(8, top) + "px";
  });
}

export function hideTip() {
  el.classList.remove("show");
}

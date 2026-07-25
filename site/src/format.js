import { format } from "d3";

const fInt = format(",");
const fPct = format(".0%");
const fPct1 = format(".1%");

export const commas = (n) => (n == null ? "\u2014" : fInt(Math.round(n)));
export const pct = (x) => (x == null ? "\u2014" : fPct(x));
export const pct1 = (x) => (x == null ? "\u2014" : fPct1(x));

// Compact human number: 3.0M, 128K, 940
export function human(n) {
  if (n == null) return "\u2014";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

export function ordinal(n) {
  if (n == null) return "\u2014";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const SOURCE_LABEL = {
  readme: "README",
  issue: "Issues",
  pull_request: "Pull Requests",
};

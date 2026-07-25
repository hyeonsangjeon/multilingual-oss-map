import { getState, setState, subscribe } from "./store.js";
import { meta, totalsFor, langName } from "./data.js";
import { mountStrictness } from "./controls.js";
import { human, commas, ordinal, SOURCE_LABEL } from "./format.js";

function topLang(source, strictness) {
  const t = totalsFor(source, strictness);
  return t.length ? t[0] : null;
}

export function mountHero() {
  const sub = document.getElementById("hero-sub");
  const cards = document.getElementById("stat-cards");
  const hint = document.getElementById("hero-hint");
  mountStrictness(document.getElementById("strictness-block"));

  const total = meta.totals.distinct_repositories;
  sub.innerHTML =
    `Across <span class="num">${commas(total)}</span> public repositories, the ` +
    `<a href="${meta.dataset.url}">GitHub Multilingual Repositories Dataset</a> classified the ` +
    `language of README, issue, and pull-request text. This non-English language map shows what it found.`;

  function render(s) {
    const rm = topLang("readme", s.strictness);
    const iss = topLang("issue", s.strictness);
    cards.innerHTML = "";
    card(cards, "Public repositories", human(total), `${commas(total)} classified in the dataset`);
    card(cards, `#1 non-English README (${label(s)})`, rm ? rm.name : "\u2014",
      rm ? `${commas(rm.count)} repositories` : "");
    const story = card(cards, `#1 non-English issues (${label(s)})`, iss ? iss.name : "\u2014",
      iss ? `${commas(iss.count)} repositories` : "");
    story.classList.add("story");

    // Is Korean's issue rank far better than its README rank? Surface the asymmetry.
    const koIssue = totalsFor("issue", s.strictness).find((r) => r.lang === "KO");
    const koReadme = totalsFor("readme", s.strictness).find((r) => r.lang === "KO");
    if (koIssue && koReadme) {
      hint.innerHTML =
        `Right now Korean sits ${ordinal(koReadme.rank)} in READMEs but ${ordinal(koIssue.rank)} in issues. ` +
        `<button class="chip" id="sharp-btn">Show the sharpest example →</button>`;
      document.getElementById("sharp-btn").addEventListener("click", () => {
        setState({ strictness: 3, source: "issue", selectedLang: "KO" });
        document.getElementById("detail-section").scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  render(getState());
  subscribe(render);
}

function label(s) {
  return meta.strictness.labels[s.strictness].split(" (")[0];
}

function card(parent, labelText, value, sub) {
  const d = document.createElement("div");
  d.className = "stat-card";
  d.innerHTML =
    `<div class="label">${labelText}</div>` +
    `<div class="value">${value}</div>` +
    `<div class="sub">${sub}</div>`;
  parent.appendChild(d);
  return d;
}

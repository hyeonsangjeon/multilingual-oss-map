import "./styles.css";
import { meta } from "./data.js";
import { mountStrictness, mountSourceTabs } from "./controls.js";
import { mountHero } from "./hero.js";
import { mountMap } from "./map.js";
import { mountSpotlight } from "./spotlight.js";
import { mountSlope } from "./slope.js";
import { mountDetail } from "./detail.js";
import { mountTimeseries } from "./timeseries.js";
import { mountStack } from "./stack.js";
import { mountMethodology } from "./methodology.js";

mountStrictness(document.getElementById("topbar-controls"), { compact: true });
mountHero();
mountSourceTabs(document.getElementById("source-tabs"));
mountMap();
mountSpotlight();
mountSlope();
mountDetail();
mountTimeseries();
mountStack();
mountMethodology();
mountFooter();

function mountFooter() {
  const f = document.getElementById("footer");
  const d = meta.dataset;
  f.innerHTML =
    `<p><strong>multilingual-oss-map</strong> — an interactive language map of multilingual open source, ` +
    `built from the <a href="${d.url}">${d.name}</a> (<span class="num">${d.license}</span>). ` +
    `This project is a discovery and visualisation tool, not an official product of the dataset's authors.</p>` +
    `<p style="margin-top:8px">Snapshot ${meta.snapshot_day} · pipeline ${meta.pipeline_version} · ` +
    `English excluded · language ≠ country · counts are “repositories classified as”, never ground truth. ` +
    `Method &amp; source: <a href="#methodology">see limitations</a>.</p>`;
}

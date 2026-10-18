// Research-area illustrations (founder, 2026-10-18: imagery matters; after scale.com's technical line art). One
// isometric scene per research area, white hairlines on black with one accent from the brand spectrum. 2400 x 1500.
// They replace the stock photographs that stood in for all four areas on the research and application pages.
// Usage: node scripts/research-art.mjs <outDir> (needs Playwright); then export to public/site/art as WebP.
import { createRequire } from "module";
const require = createRequire(process.cwd() + "/noop.js");
const { chromium } = require("playwright");
const out = process.argv[2];

const W = 2400, H = 1500;

// Isometric projection around an origin on the canvas. x to the right-down, y to the left-down, z up.
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const iso = (ox, oy, s) => (x, y, z = 0) => [ox + (x - y) * C30 * s, oy + (x + y) * S30 * s - z * s];
const pts = (P, list) => list.map(([x, y, z]) => P(x, y, z).map((v) => v.toFixed(1)).join(",")).join(" ");
const poly = (P, list, { fill = "none", stroke = "#fff", o = 1, w = 1.6, dash = "" } = {}) =>
  `<polygon points="${pts(P, list)}" fill="${fill}" stroke="${stroke}" stroke-opacity="${o}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linejoin="round"/>`;
const pl = (P, list, { stroke = "#fff", o = 1, w = 1.6, dash = "" } = {}) =>
  `<polyline points="${pts(P, list)}" fill="none" stroke="${stroke}" stroke-opacity="${o}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
/** A flat plane of size a x b at height z, with an optional inner grid. */
const plane = (P, x, y, z, a, b, { o = .9, grid = 0, gridO = .16, fill = "rgba(255,255,255,.025)", stroke = "#fff", w = 1.8 } = {}) => {
  let s = poly(P, [[x, y, z], [x + a, y, z], [x + a, y + b, z], [x, y + b, z]], { fill, stroke, o, w });
  for (let i = 1; i < grid; i++) {
    s += pl(P, [[x + (a * i) / grid, y, z], [x + (a * i) / grid, y + b, z]], { o: gridO, w: 1 });
    s += pl(P, [[x, y + (b * i) / grid, z], [x + a, y + (b * i) / grid, z]], { o: gridO, w: 1 });
  }
  return s;
};
/** A box: top face plus the two visible sides. */
const box = (P, x, y, z, a, b, h, { o = .95, stroke = "#fff", top = "rgba(255,255,255,.06)", side = "rgba(255,255,255,.02)", w = 1.8 } = {}) =>
  poly(P, [[x + a, y, z], [x + a, y + b, z], [x + a, y + b, z + h], [x + a, y, z + h]], { fill: side, stroke, o: o * .8, w }) +
  poly(P, [[x, y + b, z], [x + a, y + b, z], [x + a, y + b, z + h], [x, y + b, z + h]], { fill: side, stroke, o: o * .8, w }) +
  poly(P, [[x, y, z + h], [x + a, y, z + h], [x + a, y + b, z + h], [x, y + b, z + h]], { fill: top, stroke, o, w });
/** Circuit-like traces on a plane: right-angle runs between seeded points. */
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const traces = (P, x, y, z, a, b, n, seed, { o = .55, stroke = "#fff", w = 1.4 } = {}) => {
  const r = rng(seed); let s = "";
  for (let i = 0; i < n; i++) {
    const x0 = x + r() * a, y0 = y + r() * b, x1 = x + r() * a, y1 = y + r() * b;
    s += pl(P, [[x0, y0, z], [x1, y0, z], [x1, y1, z]], { o: o * (.4 + r() * .6), stroke, w });
  }
  return s;
};

const SCENES = {
  // Two identical model stacks, approved and running, joined at the top: the model that runs is the one approved.
  "model-integrity": (A) => {
    const P = iso(1200, 640, 25); let s = plane(P, -22, -14, 0, 44, 28, { o: .35, grid: 11, gridO: .07, fill: "none" });
    for (const [x, hue] of [[-17, A], [5, "#fff"]]) {
      for (let k = 0; k < 5; k++) s += box(P, x, -6, k * 2.6, 12, 12, 1.6, { stroke: k === 4 ? hue : "#fff", o: k === 4 ? 1 : .7, top: k === 4 && hue === A ? "rgba(90,180,255,.10)" : "rgba(255,255,255,.04)" });
      s += traces(P, x + 1, -5, 12, 10, 10, 3, x + 40, { stroke: hue, o: .8 });
    }
    s += pl(P, [[-11, 0, 13.6], [-11, 0, 20], [11, 0, 20], [11, 0, 13.6]], { stroke: A, o: .95, w: 2.4, dash: "8 8" });
    return s;
  },
  // A pipeline of planes, inputs to update to supply path, with one foreign piece entering it: adversarial threats.
  "adversarial-threats": (A) => {
    const P = iso(1200, 620, 24); let s = "";
    [-30, -8, 14].forEach((x, i) => { s += plane(P, x, -8, i * -4, 16, 16, { grid: 4, o: .9 }); s += traces(P, x + 1, -7, i * -4, 14, 14, 4, 60 + i, { o: .5 }); });
    s += pl(P, [[-14, 0, 0], [-8, 0, -4]], { o: .8, w: 2 }) + pl(P, [[8, 0, -4], [14, 0, -8]], { o: .8, w: 2 });
    s += box(P, -2, -2, 12, 4, 4, 4, { stroke: A, o: 1, top: "rgba(255,106,43,.14)" });
    s += pl(P, [[0, 0, 12], [0, 0, -4]], { stroke: A, o: 1, w: 2.6, dash: "7 7" });
    s += plane(P, -3, -3, -4, 6, 6, { stroke: A, o: 1, fill: "rgba(255,106,43,.10)" });
    return s;
  },
  // Nested boundaries with a gate where one identity crosses inward: machine trust.
  "machine-trust": (A) => {
    const P = iso(1200, 700, 24); let s = "";
    for (const [r, o] of [[20, .3], [14, .55], [8, .95]]) s += plane(P, -r, -r, 0, r * 2, r * 2, { o, fill: r === 8 ? "rgba(61,214,140,.05)" : "none", stroke: r === 8 ? A : "#fff", grid: r === 20 ? 10 : 0, gridO: .06 });
    for (const [x, y] of [[-14, -2], [-14, 2], [-8, -2], [-8, 2]]) s += box(P, x - .4, y - .4, 0, .8, .8, 3.2, { o: .8 });
    s += pl(P, [[-26, 0, .3], [-1, 0, .3]], { stroke: A, o: 1, w: 3 });
    s += box(P, -24, -1.4, 0, 2.8, 2.8, 2.4, { stroke: A, o: 1, top: "rgba(61,214,140,.16)" });
    s += box(P, -3, -3, 0, 6, 6, 4, { o: 1 });
    return s;
  },
  // Records in order along a line, one gap kept as an outline, the newest lit: security evidence.
  "security-evidence": (A) => {
    const P = iso(1180, 640, 24); let s = pl(P, [[-26, 6, 0], [26, 6, 0]], { o: .4, w: 1.4 });
    for (let i = 0; i < 9; i++) {
      const x = -24 + i * 6;
      s += pl(P, [[x + 1.5, 6, 0], [x + 1.5, 6.8, 0]], { o: .5, w: 1.2 });
      if (i === 5) { s += poly(P, [[x, -6, 0], [x + 3, -6, 0], [x + 3, 4, 0], [x, 4, 0]], { stroke: A, o: 1, w: 2.2, dash: "7 6" }); continue; }
      s += box(P, x, -6, 0, 3, 10, 6 + (i % 3), { stroke: i === 8 ? A : "#fff", o: i === 8 ? 1 : .65, top: i === 8 ? "rgba(242,183,90,.14)" : "rgba(255,255,255,.04)" });
    }
    return s;
  },
};

const ACCENT = { "model-integrity": "#5AB4FF", "adversarial-threats": "#FF6A2B", "machine-trust": "#3DD68C", "security-evidence": "#F2B75A" };

const svg = (name) => {
  const A = ACCENT[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="light" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="${A}" stop-opacity=".09"/><stop offset=".45" stop-color="#16171b" stop-opacity=".9"/><stop offset="1" stop-color="#050506" stop-opacity="1"/></radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .06 0"/></filter>
    <filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#050506" stop-opacity="0"/><stop offset="1" stop-color="#050506" stop-opacity=".85"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#050506"/>
  <rect width="${W}" height="${H}" fill="url(#light)"/>
  <g id="art" filter="url(#glow)">${SCENES[name](A)}</g>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const name of Object.keys(SCENES)) {
  await p.setContent(`<html><body style="margin:0;background:#000">${svg(name)}</body></html>`);
  // Fit each scene: centre its drawn bounds and scale it to at most 62% of the width and 68% of the height.
  await p.evaluate(([W, H]) => {
    const g = document.getElementById("art"); const b = g.getBBox();
    const k = Math.min((W * .62) / b.width, (H * .68) / b.height, 1.35);
    g.setAttribute("transform", `translate(${W / 2 - (b.x + b.width / 2) * k} ${H * .5 - (b.y + b.height / 2) * k}) scale(${k})`);
  }, [W, H]);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name);
}
await b.close();

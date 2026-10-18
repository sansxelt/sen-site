// Original article covers for Vraelis News (founder, 2026-10-18: imagery matters; study scale.com and x.ai).
// Scale-style technical isometric line art on black: white hairlines, planes in depth, one accent from the brand
// spectrum per category (Product blue, Research teal, Perspective amber, Company ember). 2400 x 1500, no text.
// Usage: node scripts/news-covers.mjs <outDir> (needs Playwright); then export to public/site/news as WebP.
import { createRequire } from "module";
const require = createRequire(process.cwd() + "/noop.js");
const { chromium } = require("playwright");
const out = process.argv[2];

const W = 2400, H = 1500;
const HUE = { Product: "#5AB4FF", Research: "#2DD4BF", Perspective: "#F2B75A", Company: "#FF6A2B" };

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
  // A cluster plane of pods, one control box, and a link up to an evidence plane: the Kubernetes collector.
  collector: (A) => {
    const P = iso(1240, 560, 26); let s = plane(P, -14, -14, 0, 28, 28, { grid: 7 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (!(i === 1 && j === 1) && !(i === 2 && j === 2) && !(i === 1 && j === 2) && !(i === 2 && j === 1)) s += box(P, -12 + i * 6.5, -12 + j * 6.5, 0, 3.4, 3.4, 2 + ((i + j) % 3), { o: .85 });
    s += box(P, -3, -3, 0, 6, 6, 6, { stroke: A, o: 1, top: "rgba(90,180,255,.10)" });
    s += pl(P, [[0, 0, 6], [0, 0, 20]], { stroke: A, o: .9, w: 2.2, dash: "6 8" });
    s += plane(P, -8, -8, 20, 16, 16, { stroke: A, o: .9, grid: 4, fill: "rgba(90,180,255,.05)" });
    s += traces(P, -7, -7, 20, 14, 14, 7, 11, { stroke: A, o: .8 });
    return s;
  },
  // Two planes, approval and runtime, joined by five parallel links; one link breaks away: five failures.
  "five-ways": (A) => {
    const P = iso(1200, 760, 24); let s = plane(P, -30, -10, 10, 16, 20, { grid: 4 }) + plane(P, 14, -10, 0, 16, 20, { grid: 4 });
    s += traces(P, -29, -9, 10, 14, 18, 6, 5) + traces(P, 15, -9, 0, 14, 18, 6, 9);
    for (let i = 0; i < 5; i++) {
      const y = -8 + i * 4;
      if (i === 3) s += pl(P, [[-14, y, 10], [-2, y, 10], [4, y + 6, 4], [8, y + 14, -6]], { stroke: A, o: 1, w: 3 });
      else s += pl(P, [[-14, y, 10], [14, y, 0]], { o: .75, w: 2 });
    }
    return s;
  },
  // A runtime box beaming its report to a plane; a ghost of the plane sits offset beside it: report and reality.
  "self-report": (A) => {
    const P = iso(1180, 640, 26); let s = plane(P, -16, -16, 0, 32, 32, { grid: 8, gridO: .1 });
    s += box(P, -3, -3, 0, 6, 6, 5, { o: 1 });
    s += pl(P, [[0, 0, 5], [0, 0, 18]], { stroke: A, o: 1, w: 2.4 });
    s += plane(P, -7, -7, 18, 14, 14, { stroke: A, o: 1, grid: 3, fill: "rgba(45,212,191,.06)" });
    s += plane(P, -4, -10, 21, 14, 14, { o: .32, grid: 3, gridO: .08, fill: "none" });
    s += traces(P, -6, -6, 18, 12, 12, 5, 21, { stroke: A, o: .85 });
    return s;
  },
  // A field of tiles with one tile lifted out and left as an outline: evidence unavailable is still recorded.
  unavailable: (A) => {
    const P = iso(1200, 470, 25); let s = "";
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      if (i === 4 && j === 3) { s += poly(P, [[-16 + i * 4, -16 + j * 4, 0], [-12.6 + i * 4, -16 + j * 4, 0], [-12.6 + i * 4, -12.6 + j * 4, 0], [-16 + i * 4, -12.6 + j * 4, 0]], { stroke: A, o: 1, w: 2.4, dash: "8 7" }); continue; }
      s += box(P, -16 + i * 4, -16 + j * 4, 0, 3.4, 3.4, .6 + ((i * 7 + j * 3) % 4) * .3, { o: .55 });
    }
    s += poly(P, [[0, -4, 9], [3.4, -4, 9], [3.4, -0.6, 9], [0, -0.6, 9]], { stroke: A, o: .7, w: 1.6, dash: "5 6" });
    s += pl(P, [[1.7, -2.3, 0.2], [1.7, -2.3, 9]], { stroke: A, o: .55, w: 1.4, dash: "4 7" });
    return s;
  },
  // Terrain lines with a machine on it and its route behind: release integrity in the field.
  field: (A) => {
    const P = iso(1200, 520, 24); let s = "";
    for (let j = 0; j <= 16; j++) { const row = []; for (let i = 0; i <= 32; i++) { const x = -16 + i, y = -16 + j * 2; row.push([x, y, Math.sin(i * .45) * 1.2 + Math.cos(j * .7 + i * .2) * 1.4]); } s += pl(P, row, { o: .22 + (j % 4 === 0 ? .2 : 0), w: 1.2 }); }
    const h = (x, y) => Math.sin((x + 16) * .45) * 1.2 + Math.cos(((y + 16) / 2) * .7 + (x + 16) * .2) * 1.4;
    const route = []; for (let t = 0; t <= 20; t++) { const x = -12 + t * 1.1, y = 10 - t * 1.05; route.push([x, y, h(x, y) + .3]); }
    s += pl(P, route, { stroke: A, o: 1, w: 3 });
    const [ex, ey] = [route[20][0], route[20][1]];
    s += box(P, ex - 1.6, ey - 1.2, h(ex, ey), 3.2, 2.4, 1.6, { stroke: A, o: 1, top: "rgba(45,212,191,.12)" });
    s += pl(P, [[ex, ey, h(ex, ey) + 1.6], [ex, ey, 14]], { stroke: A, o: .6, w: 1.6, dash: "5 8" });
    s += plane(P, ex - 4, ey - 4, 14, 8, 8, { stroke: A, o: .7, grid: 2, fill: "rgba(45,212,191,.04)" });
    return s;
  },
  // Terraced contour layers rising to one peak: Vraelis Contour.
  contour: (A) => {
    const P = iso(1200, 700, 24); let s = "";
    for (let k = 0; k < 9; k++) {
      const r = 15 - k * 1.6, z = k * 1.6, ring = [];
      for (let t = 0; t <= 64; t++) { const a = (t / 64) * Math.PI * 2; ring.push([Math.cos(a) * r * (1 + .12 * Math.sin(a * 3 + k)), Math.sin(a) * r * (1 + .1 * Math.cos(a * 2 + k)), z]); }
      s += pl(P, ring, { stroke: k === 5 ? A : "#fff", o: k === 5 ? 1 : .35 + k * .07, w: k === 5 ? 2.8 : 1.6 });
    }
    s += plane(P, -18, -18, 0, 36, 36, { o: .25, grid: 9, gridO: .07, fill: "none" });
    return s;
  },
  // Translucent panes stacked in depth, the front one with ruled rows: a read-only evidence app.
  "evidence-app": (A) => {
    const P = iso(1200, 560, 25); let s = "";
    for (let k = 4; k >= 0; k--) {
      const z = k * 5; s += plane(P, -12, -9, z, 24, 18, { o: k === 0 ? 1 : .35 + (4 - k) * .1, fill: k === 0 ? "rgba(90,180,255,.05)" : "rgba(255,255,255,.015)", stroke: k === 0 ? A : "#fff" });
      if (k === 0) for (let r = 0; r < 5; r++) s += pl(P, [[-10, -6 + r * 3, z], [r === 1 ? 2 : 9, -6 + r * 3, z]], { stroke: r === 1 ? A : "#fff", o: .7, w: 2 });
      else s += traces(P, -11, -8, z, 22, 16, 4, 30 + k, { o: .35 });
    }
    return s;
  },
  // Three lattice planes stacked and linked: AI security as layered structure.
  "ai-security": (A) => {
    const P = iso(1200, 620, 24); let s = "";
    for (let k = 0; k < 3; k++) {
      const z = k * 8; s += plane(P, -12, -12, z, 24, 24, { o: k === 2 ? 1 : .55, stroke: k === 2 ? A : "#fff", grid: 6, gridO: .12, fill: k === 2 ? "rgba(255,106,43,.05)" : "rgba(255,255,255,.015)" });
      for (let i = 0; i < 6; i++) s += pl(P, [[-12 + i * 4, -12, z], [-12 + i * 4 + 4, -8, z], [-12 + i * 4 + 8, -12, z]].filter(([x]) => x <= 12), { o: .3, w: 1.2 });
    }
    for (const [x, y] of [[-12, -12], [12, -12], [12, 12], [-12, 12]]) s += pl(P, [[x, y, 0], [x, y, 16]], { o: .4, w: 1.2, dash: "4 6" });
    s += traces(P, -11, -11, 16, 22, 22, 6, 41, { stroke: A, o: .9 });
    return s;
  },
};

const KIND = { collector: "Product", "five-ways": "Perspective", "self-report": "Research", unavailable: "Perspective", field: "Research", contour: "Product", "evidence-app": "Product", "ai-security": "Company" };

const svg = (name) => {
  const A = HUE[KIND[name]];
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

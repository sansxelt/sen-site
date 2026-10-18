// Page illustrations for About and Security (founder, 2026-10-18: imagery matters; after scale.com's line art).
// Wide isometric scenes, white hairlines on black with one brand accent. 2400 x 1000, for banners under page heroes.
// Usage: node scripts/page-art.mjs <outDir> (needs Playwright); then export to public/site/art as WebP.
import { createRequire } from "module";
const require = createRequire(process.cwd() + "/noop.js");
const { chromium } = require("playwright");
const out = process.argv[2];

const W = 2400, H = 1000;

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
  // One terrain with the settings Vraelis works for: a lattice tower and its lines, a wind turbine, a server rack, a
  // robot arm and a drone, joined by thin accent links (model updates travelling between systems). About.
  "physical-world": (A) => {
    const P = iso(1200, 560, 22); let s = plane(P, -34, -15, 0, 66, 30, { o: .3, grid: 11, gridO: .07, fill: "none" });
    const tower = (x, y, h) => {
      let t = ""; const b = 2.6, top = .8;
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) t += pl(P, [[x + dx * b, y + dy * b, 0], [x + dx * top, y + dy * top, h]], { o: .9, w: 1.8 });
      for (let k = 1; k < 7; k++) { const z = (h * k) / 7, w = b - ((b - top) * k) / 7; t += poly(P, [[x - w, y - w, z], [x + w, y - w, z], [x + w, y + w, z], [x - w, y + w, z]], { o: .4, w: 1.1 }); }
      t += pl(P, [[x - 5.5, y, h * .84], [x + 5.5, y, h * .84]], { o: .9, w: 1.8 }) + pl(P, [[x - 4, y, h * .66], [x + 4, y, h * .66]], { o: .75, w: 1.5 });
      return t;
    };
    s += tower(-29, -6, 18) + tower(-27, 8, 18);
    for (const dx of [-5.5, 5.5]) s += pl(P, [[-29 + dx, -6, 15.1], [-28 + dx, 1, 12.6], [-27 + dx, 8, 15.1]], { o: .5, w: 1.3 });
    s += pl(P, [[-16, -10, 0], [-16, -10, 24]], { o: .95, w: 2.4 }) + box(P, -16.8, -10.8, 23.2, 1.6, 1.6, 1.6, { o: .9 });
    for (let k = 0; k < 3; k++) { const ang = (k / 3) * Math.PI * 2 + .5; s += pl(P, [[-16, -10, 24], [-16 + Math.cos(ang) * 9, -10, 24 + Math.sin(ang) * 9]], { o: .95, w: 2.2 }); }
    for (let k = 0; k < 4; k++) { const y = 2 + k * 3; s += poly(P, [[-14, y, 2.4], [-6, y, 2.4], [-6, y + 2.4, 1], [-14, y + 2.4, 1]], { o: .8, w: 1.5, fill: "rgba(255,255,255,.04)" }); for (let c = 1; c < 4; c++) s += pl(P, [[-14 + c * 2, y, 2.4], [-14 + c * 2, y + 2.4, 1]], { o: .3, w: 1 }); }
    s += box(P, -1, -11, 0, 5, 7, 12, { o: .95 }) + box(P, 5, -11, 0, 5, 7, 12, { o: .8 });
    for (let k = 1; k < 8; k++) s += pl(P, [[4, -10.4, k * 1.5], [4, -4.6, k * 1.5]], { o: .45, w: 1.1 }) + pl(P, [[10, -10.4, k * 1.5], [10, -4.6, k * 1.5]], { o: .35, w: 1.1 });
    s += box(P, 8, 4, 0, 5, 5, 2.6, { o: .95 }) + pl(P, [[10.5, 6.5, 2.6], [10.5, 6.5, 10], [17.5, 6.5, 14], [21, 6.5, 10]], { o: 1, w: 3 });
    s += box(P, 9.8, 5.8, 9.3, 1.4, 1.4, 1.4, { o: .9 }) + box(P, 16.8, 5.8, 13.3, 1.4, 1.4, 1.4, { o: .9 }) + pl(P, [[21, 5.5, 10], [21, 7.5, 9]], { o: .9, w: 2 });
    const dz = 17, dx0 = 24, dy0 = -8;
    s += box(P, dx0 - 1.5, dy0 - 1.5, dz, 3, 3, 1, { o: 1 });
    for (const [ax, ay] of [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6]]) {
      s += pl(P, [[dx0, dy0, dz + .5], [dx0 + ax, dy0 + ay, dz + .7]], { o: .95, w: 1.6 });
      const ring = []; for (let k = 0; k <= 28; k++) { const ang = (k / 28) * Math.PI * 2; ring.push([dx0 + ax + Math.cos(ang) * 1.9, dy0 + ay + Math.sin(ang) * 1.9, dz + .9]); }
      s += pl(P, ring, { o: .75, w: 1.3 });
    }
    s += pl(P, [[-27, 1, .2], [-16, -10, .2], [-10, 2, .2], [1.5, -7.5, .2], [10.5, 6.5, .2], [24, -8, .2]], { stroke: A, o: .95, w: 2.6, dash: "11 9" });
    s += pl(P, [[24, -8, .2], [24, -8, dz]], { stroke: A, o: .55, w: 1.5, dash: "5 8" });
    return s;
  },
  // A sealed inner boundary with one reporting channel running in from outside: responsible disclosure. Security.
  disclosure: (A) => {
    const P = iso(1200, 600, 24); let s = "";
    for (const [r, o] of [[22, .25], [15, .45]]) s += plane(P, -r, -r * .6, 0, r * 2, r * 1.2, { o, fill: "none", grid: r === 22 ? 11 : 0, gridO: .06 });
    s += box(P, -6, -5, 0, 12, 10, 7, { o: 1, top: "rgba(90,180,255,.06)" });
    s += box(P, -4.5, -3.5, 7, 9, 7, 1.2, { o: .8, stroke: A, top: "rgba(90,180,255,.10)" });
    s += pl(P, [[-34, 0, .3], [-6, 0, .3]], { stroke: A, o: 1, w: 3 });
    s += box(P, -27, -1.2, 0, 3.4, 2.4, 1.6, { stroke: A, o: 1, top: "rgba(90,180,255,.18)" });
    s += pl(P, [[-27, -1.2, 1.6], [-25.3, 0, 2.4], [-23.6, -1.2, 1.6]], { stroke: A, o: .9, w: 1.4 });
    s += poly(P, [[-6, -1.2, 1.5], [-6, 1.2, 1.5], [-6, 1.2, 3], [-6, -1.2, 3]], { stroke: A, o: 1, w: 2, fill: "rgba(90,180,255,.12)" });
    return s;
  },
};

const ACCENT = { "physical-world": "#FF6A2B", disclosure: "#5AB4FF" };

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
    const k = Math.min((W * .78) / b.width, (H * .78) / b.height, 1.35);
    g.setAttribute("transform", `translate(${W / 2 - (b.x + b.width / 2) * k} ${H * .5 - (b.y + b.height / 2) * k}) scale(${k})`);
  }, [W, H]);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name);
}
await b.close();

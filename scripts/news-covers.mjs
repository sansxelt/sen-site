// Original article covers for Vraelis News: dark grain, one silver light, one motif per article. 2400 x 1500.
// Usage: node covers.mjs <outDir>
import { createRequire } from "module";
const require = createRequire(process.cwd() + "/noop.js");
const { chromium } = require("playwright");
const out = process.argv[2];

const W = 2400, H = 1500;
const line = (x1, y1, x2, y2, o = 1, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#silver)" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const MOTIFS = {
  // A cluster: one control node, eight workers around it, each with a thin link. Kubernetes collector.
  "collector": () => {
    const cx = 1500, cy = 760, R = 420; let s = "";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      s += line(cx, cy, x, y, .35, 2);
      s += `<rect x="${x - 44}" y="${y - 44}" width="88" height="88" rx="18" fill="#0d0d0f" stroke="url(#silver)" stroke-width="2.5" stroke-opacity=".9"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${R + 120}" fill="none" stroke="url(#silver)" stroke-opacity=".12" stroke-width="2"/>`;
    s += `<rect x="${cx - 80}" y="${cy - 80}" width="160" height="160" rx="30" fill="#111114" stroke="url(#silver)" stroke-width="4"/>`;
    return s;
  },
  // Five parallel paths from approval to runtime; four arrive, one bends away. Five ways an update goes wrong.
  "five-ways": () => {
    let s = "";
    for (let i = 0; i < 5; i++) {
      const y = 430 + i * 160;
      if (i === 2) s += `<path d="M 300 ${y} L 1350 ${y} C 1650 ${y} 1750 ${y + 260} 2100 ${y + 330}" fill="none" stroke="url(#silver)" stroke-width="6" stroke-linecap="round"/>`;
      else s += line(300, y, 2100, y, .55, 3);
      
    }
    return s;
  },
  // A signal and its reflection: what the worker says beside what is there. A self-report is not proof.
  "self-report": () => {
    let s = "";
    for (let i = 1; i <= 7; i++) s += `<path d="M ${1200 - i * 110} 700 A ${i * 110} ${i * 110} 0 0 1 ${1200 + i * 110} 700" fill="none" stroke="url(#silver)" stroke-opacity="${1 - i * .11}" stroke-width="3"/>`;
    for (let i = 1; i <= 7; i++) s += `<path d="M ${1200 - i * 110} 820 A ${i * 110} ${i * 110} 0 0 0 ${1200 + i * 110} 820" fill="none" stroke="url(#silver)" stroke-opacity="${(1 - i * .11) * .28}" stroke-width="3" stroke-dasharray="14 18"/>`;
    s += `<rect x="1170" y="730" width="60" height="60" rx="12" fill="#f0f0f2"/>`;
    return s;
  },
  // A ruled field with one cell missing, outlined: evidence unavailable is still a record.
  "unavailable": () => {
    let s = ""; const x0 = 520, y0 = 300, c = 150, n = 9, m = 6;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      if (i === 5 && j === 2) continue;
      s += `<rect x="${x0 + i * (c + 14)}" y="${y0 + j * (c + 14)}" width="${c}" height="${c}" rx="14" fill="#141417" stroke="#2a2a2f" stroke-width="2"/>`;
    }
    s += `<rect x="${x0 + 5 * (c + 14)}" y="${y0 + 2 * (c + 14)}" width="${c}" height="${c}" rx="14" fill="none" stroke="url(#silver)" stroke-width="4" stroke-dasharray="16 14"/>`;
    return s;
  },
  // A horizon and a machine's trail across it: models shipped to machines in the field.
  "field": () => {
    let s = line(0, 1020, W, 1020, .5, 2); const r = rng(7);
    for (let i = 0; i < 26; i++) { const x = 200 + i * 80; s += line(x, 1020, x - 260 + i * 6, 1500, .08 + r() * .08, 2); }
    s += `<path d="M 260 980 C 800 900 1300 760 2050 520" fill="none" stroke="url(#silver)" stroke-width="5" stroke-linecap="round"/>`;
    s += `<rect x="2010" y="480" width="80" height="80" rx="16" fill="#f0f0f2" transform="rotate(-18 2050 520)"/>`;
    return s;
  },
  // Contour lines around one peak: Vraelis Contour.
  "contour": () => {
    let s = "";
    for (let i = 1; i <= 12; i++) {
      const rx = i * 85, ry = i * 52, k = Math.sin(i) * 30;
      s += `<ellipse cx="${1300 + k}" cy="${760 - i * 6}" rx="${rx}" ry="${ry}" fill="none" stroke="url(#silver)" stroke-opacity="${1.05 - i * .075}" stroke-width="${i === 4 ? 5 : 2.5}" transform="rotate(${-8 + i} 1300 760)"/>`;
    }
    return s;
  },
  // Stacked panes, slightly offset: a read-only evidence app over a recorded trace.
  "evidence-app": () => {
    let s = "";
    for (let i = 4; i >= 0; i--) s += `<rect x="${640 + i * 70}" y="${330 + i * 70}" width="1120" height="680" rx="34" fill="#${i === 0 ? "131316" : "0e0e10"}" stroke="url(#silver)" stroke-opacity="${1 - i * .18}" stroke-width="3"/>`;
    for (let k = 0; k < 4; k++) s += line(720, 470 + k * 90, k === 1 ? 1300 : 1600, 470 + k * 90, .55, 4);
    return s;
  },
  // A lattice under a single light: AI security as structure.
  "ai-security": () => {
    let s = ""; const r = rng(3); const pts = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) pts.push([420 + i * 200 + (j % 2) * 100, 330 + j * 200]);
    for (const [x, y] of pts) for (const [u, v] of pts) { const d = Math.hypot(x - u, y - v); if (d > 0 && d < 230 && x < u) s += line(x, y, u, v, .18 + r() * .25, 2); }
    return s;
  },
};

const svg = (motif) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="silver" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#d4d6dc"/><stop offset="1" stop-color="#8a8e99"/></linearGradient>
    <radialGradient id="light" cx=".62" cy=".38" r=".75"><stop offset="0" stop-color="#3a3d45" stop-opacity=".9"/><stop offset=".55" stop-color="#15161a" stop-opacity=".6"/><stop offset="1" stop-color="#060607" stop-opacity="0"/></radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#08080a"/>
  <rect width="${W}" height="${H}" fill="url(#light)"/>
  <g filter="url(#glow)">${MOTIFS[motif]()}</g>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const name of Object.keys(MOTIFS)) {
  await p.setContent(`<html><body style="margin:0;background:#000">${svg(name)}</body></html>`);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name);
}
await b.close();

// A SIMULATED MISSION CONSOLE for an armed drone: the high-stakes fixture Vraelis demonstrates on.
//
// Served at /api/fixtures/strike?mode=broken|fixed (app/api/fixtures/strike/route.ts). There is no aircraft,
// no weapon and no data: four simulated contacts whose state lives in the visitor's own browser storage, and
// the page says so on every screen. Vraelis does not make this kind of software; it shows what checking it
// looks like (the founder, 2026-10-01: "not that we supply the software but the verification software").
//
// THE RULE IT IS ABOUT, and the one bug it carries. Only a contact classified Hostile AND confirmed by the
// operator may show "Cleared to engage". Friendly and civilian contacts always show "Do not engage"; unknown
// ones hold. In broken mode, confirming T-1 clears every contact in T-1's grid square, B3, and the civilian
// bus T-3 is parked in B3, so T-3 also turns "Cleared to engage". The confirmation, the log and T-1 itself
// all look right; only checking what T-3 shows afterwards finds the failure. Fixed mode clears T-1 alone.
//
// THE CONTRACT A PLAN RELIES ON, kept stable across any redesign: contacts are selected by pressing their
// row, named by their id (T-1 to T-4); the selected contact's fields are labelled Contact, Type,
// Classification, Sector and Engagement; the buttons are named Confirm target, Withdraw confirmation and
// Reset simulation. Engagement values are exactly "Hold", "Cleared to engage" and "Do not engage".
//
// The first paint is server-rendered with the starting state, because Vraelis plans from a plain HTTP read
// of the page before any browser runs.
export type StrikeMode = "broken" | "fixed";

export type StrikeContact = { id: string; type: string; cls: "Hostile" | "Friendly" | "Civilian" | "Unknown"; sector: string; x: number; y: number };
type Contact = StrikeContact;
// Exported with the map's geometry below so the homepage can draw the same picture the console shows
// (_system/strike-map.tsx). One source, so the two can never disagree about where anything is.
export const STRIKE_CONTACTS: Contact[] = [
  { id: "T-1", type: "Armoured vehicle", cls: "Hostile", sector: "B3", x: 196, y: 258 },
  { id: "T-2", type: "Patrol, 4 people", cls: "Friendly", sector: "D2", x: 500, y: 166 },
  { id: "T-3", type: "Bus, civilian", cls: "Civilian", sector: "B3", x: 238, y: 296 },
  { id: "T-4", type: "Vehicle, unidentified", cls: "Unknown", sector: "E3", x: 612, y: 282 },
];
const CONTACTS = STRIKE_CONTACTS;
export const STRIKE_ENGAGE0: Record<string, string> = { "T-1": "Hold", "T-2": "Do not engage", "T-3": "Do not engage", "T-4": "Hold" };
const ENGAGE0 = STRIKE_ENGAGE0;

/** The live picture's terrain, in the map's own coordinates (viewBox 36 6 690 414). */
export const STRIKE_MAP = {
  viewBox: "36 6 690 414",
  contours: [
    "M-10 360 C 110 320, 230 380, 360 340 S 610 280, 850 320", "M-10 320 C 120 280, 240 340, 370 300 S 620 240, 850 280",
    "M-10 270 C 130 230, 250 290, 380 250 S 630 190, 850 230", "M-10 210 C 140 170, 260 230, 390 190 S 640 130, 850 170",
    "M-10 150 C 150 110, 270 170, 400 130 S 650 70, 850 110", "M-10 95 C 160 55, 280 115, 410 75 S 660 15, 850 55",
  ],
  river: "M-10 230 C 90 220, 160 260, 250 250 S 420 300, 520 330 S 720 360, 850 350",
  road: "M60 420 L 300 280 L 470 250 L 620 170 L 850 120",
  fov: "M96 92 L 330 250 L 150 360 Z",
  aircraft: { id: "LARK-3", x: 96, y: 92, alt: "ALT 1,200 m" },
  cols: ["A", "B", "C", "D", "E", "F"], rows: [1, 2, 3, 4], cell: { w: 140, h: 100, top: 20 },
};
const M = STRIKE_MAP;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function symbol(cls: Contact["cls"], size = 22): string {
  // The standard battlefield convention, so the colour carries meaning: hostile red diamond, friendly blue
  // rectangle, neutral green square, unknown yellow quatrefoil.
  const s = size, h = s / 2;
  if (cls === "Hostile") return `<svg width="${s}" height="${s}" viewBox="0 0 22 22"><path d="M11 1.5L20.5 11 11 20.5 1.5 11z" fill="rgba(255,90,90,.18)" stroke="#8a8a8a" stroke-width="1.6"/></svg>`;
  if (cls === "Friendly") return `<svg width="${s + 6}" height="${s}" viewBox="0 0 28 22"><rect x="1.5" y="3.5" width="25" height="15" rx="1" fill="rgba(110,170,255,.18)" stroke="#a2a2a2" stroke-width="1.6"/></svg>`;
  if (cls === "Civilian") return `<svg width="${s}" height="${s}" viewBox="0 0 22 22"><rect x="2.5" y="2.5" width="17" height="17" fill="rgba(80,210,140,.16)" stroke="#b1b1b1" stroke-width="1.6"/></svg>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 22 22"><path d="M11 2a4.5 4.5 0 014.2 2.9A4.5 4.5 0 0119.1 11a4.5 4.5 0 01-3.9 6.1A4.5 4.5 0 0111 20a4.5 4.5 0 01-4.2-2.9A4.5 4.5 0 012.9 11a4.5 4.5 0 013.9-6.1A4.5 4.5 0 0111 2z" fill="rgba(240,200,80,.16)" stroke="#c8c8c8" stroke-width="1.5"/></svg>`;
  void h;
}

export function strikeConsoleHtml(mode: StrikeMode): string {
  const rows = CONTACTS.map((c) => `<li><button type="button" class="row${c.id === "T-1" ? " sel" : ""}" data-id="${c.id}"><span class="sym">${symbol(c.cls, 18)}</span><span class="who"><b>${c.id}</b><small>${esc(c.type)}</small></span><span class="eng e-${ENGAGE0[c.id].replace(/ /g, "-")}" data-eng="${c.id}">${ENGAGE0[c.id]}</span></button></li>`).join("");
  const marks = CONTACTS.map((c) => `<g class="mk" data-mk="${c.id}" transform="translate(${c.x} ${c.y})"><g transform="translate(-11 -11)">${symbol(c.cls)}</g><text x="16" y="-10" class="mlab">${c.id}</text></g>`).join("");
  const cols = ["A", "B", "C", "D", "E", "F"], rowsN = [1, 2, 3, 4];
  const grid = cols.map((cc, i) => `<text x="${i * 140 + 70}" y="16" class="gl">${cc}</text>`).join("") + rowsN.map((r, i) => `<text x="46" y="${i * 100 + 62}" class="gl">${r}</text>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Larkspur Mission Console</title>
<style>
  :root { --bg:#171717; --p:#272727; --line:#3f3f3f; --fg:#eeeeee; --muted:#ababab; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.45 Arial,Helvetica,sans-serif; }
  button,input { font:inherit; }
  button { cursor:pointer; }
  button:focus-visible,summary:focus-visible,a:focus-visible { outline:2px solid #d2d2d2; outline-offset:3px; }
  .top { height:64px; display:flex; align-items:center; gap:24px; padding:0 24px; border-bottom:1px solid var(--line); }
  .brand { font-size:20px; font-weight:600; letter-spacing:-.5px; }
  .meta { color:var(--muted); font-size:14px; }
  .sim { margin-left:auto; color:var(--muted); font-size:12px; }
  .wrap { display:grid; grid-template-columns:minmax(0,1fr) 340px; grid-template-rows:375px minmax(360px,1fr); height:calc(100svh - 64px); min-height:700px; }
  .card { min-width:0; min-height:0; }
  .wrap>.card:first-child { grid-column:2; grid-row:1; border-left:1px solid var(--line); }
  .wrap>.card:nth-child(2) { grid-column:1; grid-row:1/3; display:flex; flex-direction:column; }
  .wrap>.card:nth-child(3) { grid-column:2; grid-row:2; border-left:1px solid var(--line); border-top:1px solid var(--line); overflow:auto; }
  .hd { display:flex; justify-content:space-between; padding:18px 20px 12px; color:var(--muted); font-size:13px; }
  .list { list-style:none; margin:0; padding:0 12px; }
  .row { display:grid; grid-template-columns:1fr auto; align-items:center; gap:12px; width:100%; padding:13px 10px; border:0; border-bottom:1px solid var(--line); background:transparent; color:var(--fg); text-align:left; border-radius:0; }
  .row.sel { background:var(--p); box-shadow:inset 2px 0 #cccccc; }.row:hover { background:var(--p); }
  .sym { display:none; }.who b { display:block; font-size:14px; font-weight:500; }.who small { color:var(--muted); font-size:12px; }
  .eng { font-size:11px; color:var(--muted); white-space:nowrap; }.e-Cleared-to-engage { color:#c0c0c0; }
  .rule { margin:14px 22px; font-size:11px; color:var(--muted); }
  .rule summary, .history summary { cursor:pointer; }.rule p { margin-bottom:0; }
  .map-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; height:64px; padding:12px 20px; border-bottom:1px solid var(--line); }
  .map-toolbar h1 { font-size:17px; letter-spacing:-.3px; font-weight:500; margin:0; }
  .view-controls { display:flex; align-items:center; gap:16px; }.view-switch { display:flex; padding:3px; background:#242424; border:1px solid var(--line); border-radius:5px; }
  .view-switch button { background:transparent; border:0; color:var(--muted); padding:6px 12px; border-radius:3px; font-size:12px; }
  .view-switch button[aria-pressed=true] { color:#1f1f1f; background:#e7e7e7; }
  .layers { position:relative; }.layers summary { cursor:pointer; font-size:12px; list-style:none; }.layers summary::-webkit-details-marker { display:none; }
  .layer-panel { position:absolute; z-index:10; top:32px; right:0; width:210px; padding:18px; background:var(--bg); border:1px solid var(--line); box-shadow:0 10px 25px #0004; }
  .layer-panel label { display:flex; justify-content:space-between; align-items:center; gap:10px; margin:0 0 14px; font-size:13px; }.layer-panel label:last-child { margin-bottom:0; }.layer-panel input { accent-color:#cacaca; }
  .layer-panel .height-control { display:block; }.height-control input { width:100%; margin-top:12px; }
  .motion-control { border:0; padding:8px 0; background:transparent; color:var(--muted); font-size:12px; min-width:76px; }
  .map { position:relative; flex:1; min-height:440px; background:#1c1c1c; overflow:hidden; }
  /* The legacy 2D view is an explicit failure fallback, never a loading frame. */
  .map>svg { display:none; position:absolute; inset:0; width:100%; height:100%; background:#1e1e1e; }.map[data-ready=fallback]>svg { display:block; }
  .map canvas { display:block; touch-action:none; visibility:hidden; }.map[data-ready=true] canvas { visibility:visible; }
  .scene-status { position:absolute; inset:0; display:grid; place-items:center; z-index:4; background:#111; color:#aaa; font-size:13px; pointer-events:none; }.map[data-ready=true] .scene-status { display:none; }
  .map[data-ready=fallback] .scene-status { inset:auto 12px 12px; display:block; padding:8px 12px; background:#111d; }
  .object-label { position:absolute; z-index:3; transform:translate(-50%,-50%); padding:4px 7px; border:1px solid #868686; border-radius:3px; background:#212121e8; color:#eeeeee; font-size:11px; box-shadow:0 2px 8px #0004; }.object-label.selected { background:#dfdfdf; border-color:#dfdfdf; color:#1e1e1e; }.object-leader { position:absolute; height:1px; background:#c1c1c1aa; transform-origin:0 50%; pointer-events:none; }.object-leader[hidden] { display:none; }
  .camera-controls[hidden],.motion-control[hidden],.layers[hidden] { display:none!important; }
  .camera-controls { position:absolute; right:18px; bottom:18px; display:flex; gap:1px; box-shadow:0 4px 20px #21212118; }.camera-controls button { border:1px solid #737373; background:#242424e8; color:#efefef; padding:10px 13px; font-size:13px; min-height:38px; }.camera-controls button:first-child { border-radius:4px 0 0 4px; }.camera-controls button:last-child { border-radius:0 4px 4px 0; }
  .mlab { fill:#e3e3e3; font:12px Arial; }.gl { fill:#727272; font:11px Arial; }
  .fields { display:grid; grid-template-columns:1fr 1fr; gap:20px; padding:16px 22px 22px; }.f.wide { grid-column:1/-1; }.f span { display:block; color:var(--muted); font-size:12px; margin-bottom:5px; }.f strong { font-size:16px; font-weight:500; }
  .actions { display:grid; gap:8px; padding:0 22px 16px; }.act { border:1px solid #525252; background:transparent; color:var(--fg); font-size:13px; padding:12px; border-radius:3px; }.act.primary { background:#e8e8e8; color:#1e1e1e; border-color:#e8e8e8; }.act:disabled { opacity:.4; cursor:default; }
  .toast { margin:0 22px 16px; min-height:16px; color:var(--muted); font-size:12px; }.history { margin:0 22px 22px; color:var(--muted); font-size:12px; }.log { list-style:none; padding:0; line-height:1.6; }.log li { margin:8px 0; }.log time { margin-right:10px; }
  .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
  @media(max-width:900px) {
    .top { padding:0 16px; gap:16px; }.meta { display:none; }.brand { font-size:18px; }
    .wrap { height:auto; min-height:0; grid-template-columns:1fr; grid-template-rows:500px auto auto; }
    .wrap>.card:nth-child(2) { grid-column:1; grid-row:1; }.wrap>.card:first-child { grid-column:1; grid-row:2; border:0; }.wrap>.card:nth-child(3) { grid-column:1; grid-row:3; border:0; border-top:1px solid var(--line); }
    .map-toolbar { height:60px; padding:10px 16px; gap:8px; }.view-controls { gap:12px; }.map-toolbar h1 { font-size:14px; }.motion-control { min-width:0; font-size:11px; }.view-switch button { padding:6px 9px; }.map { min-height:0; }
    .row { padding:14px 10px; }.eng { font-size:12px; }.who small { font-size:13px; }
  }
  @media(max-width:380px) { .map-toolbar h1 { display:none; }.map-toolbar { justify-content:flex-end; } }
  .geography-active .wrap>.card:first-child,.geography-active .wrap>.card:nth-child(3){display:none}
  .geography-active .wrap>.card:nth-child(2){grid-column:1/-1;grid-row:1/-1}
  #workspace-fullscreen { min-width:28px; width:28px; font-size:20px; padding:4px 0; }
  @media(max-width:380px){#scene-motion{display:none}}
  #map-source { background:#242424; color:var(--fg); border:1px solid var(--line); border-radius:4px; padding:6px; font-size:12px; max-width:110px; }
  #geography-map { position:absolute; inset:0; z-index:5; background:#1c1c1c; }
  #geography-map[hidden] { display:none; }
  .geography-status { position:absolute; z-index:8; top:12px; left:12px; padding:6px 9px; background:#171717e8; font-size:12px; max-width:calc(100% - 24px); }
  .geography-status:empty { display:none; }
  .map[data-geography=true] .camera-controls { z-index:7; bottom:44px; }
  .maplibregl-ctrl-attrib { font:10px/16px Arial,sans-serif!important; }
  @media(max-width:540px) { #map-source { max-width:90px; } .map-toolbar h1 { display:none; } .view-controls { gap:8px; } }
</style>
</head>
<body>
<div class="top">
  <span class="brand">Vraelis</span><span class="meta">Larkspur</span>
  <span class="sim" title="Software simulation. No real aircraft or weapons are connected.">Simulation</span>
</div>
<div class="wrap">
  <aside class="card" aria-labelledby="c-h">
    <div class="hd"><span id="c-h">Contacts</span><span>4 tracked</span></div>
    <ul class="list" id="list">${rows}</ul>
    <details class="rule"><summary>Confirmation rule</summary><p>Only a contact classified Hostile and confirmed by the operator can be cleared to engage. Friendly and civilian contacts are never engaged.</p></details>
  </aside>
  <section class="card" aria-labelledby="m-h">
    <div class="map-toolbar">
      <h1 id="m-h">North Ridge</h1>
      <select id="map-source" aria-label="Map source"><option value="simulation">Simulation</option><option value="geography">Geography</option></select>
      <div class="view-controls">
        <div class="view-switch" aria-label="Map view">
          <button type="button" id="view-2d" data-view="2d" aria-pressed="false">2D</button>
          <button type="button" id="view-3d" data-view="3d" aria-pressed="true">3D</button>
        </div>
        <details class="layers"><summary>Layers</summary><div class="layer-panel">
          <label>Terrain <input id="layer-terrain" type="checkbox" checked></label>
          <label>Structures <input id="layer-structures" type="checkbox" checked></label>
          <label>Flight path <input id="layer-routes" type="checkbox" checked></label>
          <label class="height-control">Terrain height <input id="relief" type="range" min="0" max="2" step="0.1" value="1"></label>
        </div></details>
        <button type="button" id="scene-motion" class="motion-control">Pause motion</button>
        <button type="button" id="workspace-fullscreen" class="motion-control" aria-label="Full screen workspace">⛶</button>
      </div>
    </div>
    <div class="map" id="spatial-scene" data-ready="loading">
      <div class="scene-status" role="status">Loading terrain</div>
      <svg viewBox="36 6 690 414" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <pattern id="g" width="140" height="100" patternUnits="userSpaceOnUse" x="0" y="20"><path d="M140 0H0V100" fill="none" stroke="#1b1b1b" stroke-width="1"/></pattern>
          <radialGradient id="fov" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(96 92) rotate(55) scale(300 170)"><stop offset="0" stop-color="rgba(160,190,220,.14)"/><stop offset="1" stop-color="rgba(160,190,220,0)"/></radialGradient>
        </defs>
        <rect width="840" height="420" fill="#0e0e0e"/>
        <g fill="none" stroke="#1b1b1b" stroke-width="1.2">
          ${M.contours.slice(0, 2).map((d) => `<path d="${d}"/>`).join("")}
          ${M.contours.slice(2, 4).map((d) => `<path d="${d}"/>`).join("")}
          ${M.contours.slice(4).map((d) => `<path d="${d}"/>`).join("")}
        </g>
        <path d="${M.river}" fill="none" stroke="#2b2b2b" stroke-width="7" opacity=".9"/>
        <path d="${M.road}" fill="none" stroke="#313131" stroke-width="3"/>
        <rect width="840" height="400" y="20" fill="url(#g)"/>
        ${grid}
        <rect x="140" y="220" width="140" height="100" fill="rgba(255,255,255,.025)" stroke="#343434" stroke-dasharray="4 5"/>
        <text x="148" y="236" class="gl">B3</text>
        <path d="M96 92 L 330 250 L 150 360 Z" fill="url(#fov)"/>
        <g transform="translate(96 92)"><circle r="16" fill="none" stroke="#b0b0b0" stroke-opacity=".35"/><path d="M0 -9 L7 6 L0 3 L-7 6 Z" fill="#e6e6e6"/><text x="20" y="-8" class="mlab">LARK-3</text><text x="20" y="7" class="gl">ALT 1,200 m</text></g>
        ${marks}
      </svg>
      <div id="geography-map" hidden aria-label="Real geography map"></div>
      <div class="camera-controls" aria-label="Camera controls">
        <button type="button" id="camera-reset">Recenter</button>
        <button type="button" id="zoom-out" aria-label="Zoom out">−</button>
        <button type="button" id="zoom-in" aria-label="Zoom in">+</button>
      </div>
    </div>
  </section>
  <section class="card" aria-labelledby="s-h">
    <div class="hd"><span id="s-h">Selected contact</span><span id="selid">T-1</span></div>
    <div class="fields">
      <div class="f"><span>Contact</span> <strong id="f-id">T-1</strong></div>
      <div class="f"><span>Sector</span> <strong id="f-sector">B3</strong></div>
      <div class="f wide"><span>Type</span> <strong id="f-type">Armoured vehicle</strong></div>
      <div class="f"><span>Classification</span> <strong id="f-cls">Hostile</strong></div>
      <div class="f"><span>Engagement</span> <strong id="f-eng">Hold</strong></div>
    </div>
    <div class="actions">
      <button type="button" class="act primary" id="confirm">Confirm target</button>
      <button type="button" class="act" id="withdraw">Withdraw confirmation</button>
      <button type="button" class="act" id="reset">Reset simulation</button>
    </div>
    <p class="toast" id="toast" role="status"></p>
    <details class="history"><summary>Activity</summary><ol class="log" id="log"><li><time>06:12</time>Mission North Ridge started. 4 contacts tracked.</li></ol></details>
  </section>
</div>
<p class="sr-only">Software simulation. No real aircraft or weapons are connected.</p>
<script>
(function () {
  var MODE = ${JSON.stringify(mode)};
  var KEY = "larkspur-mission-" + MODE;
  var C = ${JSON.stringify(CONTACTS)};
  var E0 = ${JSON.stringify(ENGAGE0)};
  function start() { return { eng: JSON.parse(JSON.stringify(E0)), sel: "T-1", log: [["06:12", "Mission North Ridge started. 4 contacts tracked."]] }; }
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY)); return v && v.eng ? v : start(); } catch (e) { return start(); } }
  var s = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  var $ = function (id) { return document.getElementById(id); };
  function byId(id) { for (var i = 0; i < C.length; i++) if (C[i].id === id) return C[i]; return null; }
  function clock() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function cls(v) { return "e-" + v.replace(/ /g, "-"); }
  function render() {
    var c = byId(s.sel);
    $("selid").textContent = c.id; $("f-id").textContent = c.id; $("f-sector").textContent = c.sector; $("f-type").textContent = c.type;
    $("f-cls").textContent = c.cls; $("f-eng").textContent = s.eng[c.id]; $("f-eng").className = cls(s.eng[c.id]);
    $("confirm").disabled = c.cls !== "Hostile" || s.eng[c.id] === "Cleared to engage";
    $("withdraw").disabled = s.eng[c.id] !== "Cleared to engage";
    document.querySelectorAll(".row").forEach(function (r) { r.classList.toggle("sel", r.getAttribute("data-id") === s.sel); });
    document.querySelectorAll("[data-eng]").forEach(function (e) { var id = e.getAttribute("data-eng"); e.textContent = s.eng[id]; e.className = "eng " + cls(s.eng[id]); });
    var log = $("log"); log.textContent = "";
    s.log.slice(-8).forEach(function (l) { var li = document.createElement("li"); var t = document.createElement("time"); t.textContent = l[0]; li.appendChild(t); li.appendChild(document.createTextNode(l[1])); log.appendChild(li); });
  }
  function note(line) { s.log.push([clock(), line]); }
  document.querySelectorAll(".row").forEach(function (r) { r.onclick = function () { s.sel = r.getAttribute("data-id"); save(); render(); }; });
  // The engagement rule. In broken mode the clearance is applied to the confirmed contact's whole grid square,
  // so a civilian contact in the same square is cleared too. The operator log reports only what was asked.
  $("confirm").onclick = function () {
    var c = byId(s.sel); if (!c || c.cls !== "Hostile") return;
    C.forEach(function (o) { if (MODE === "broken" ? o.sector === c.sector : o.id === c.id) s.eng[o.id] = "Cleared to engage"; });
    note(c.id + " confirmed by operator. Cleared to engage."); $("toast").textContent = c.id + " confirmed as a target"; save(); render();
  };
  $("withdraw").onclick = function () {
    var c = byId(s.sel); if (!c) return;
    C.forEach(function (o) { if (MODE === "broken" ? o.sector === c.sector : o.id === c.id) s.eng[o.id] = E0[o.id]; });
    note(c.id + " confirmation withdrawn."); $("toast").textContent = c.id + " back to hold"; save(); render();
  };
  $("reset").onclick = function () { s = start(); save(); render(); $("toast").textContent = "Simulation reset"; };
  $("workspace-fullscreen").onclick = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(function () {});
  };
  document.addEventListener("fullscreenchange", function () {
    $("workspace-fullscreen").setAttribute("aria-label", document.fullscreenElement ? "Exit full screen" : "Full screen workspace");
  });
  render();
})();
</script>
<script>
window.LARKSPUR_DATA = { contacts: ${JSON.stringify(CONTACTS)} };
window.LARKSPUR_SCENE_UNAVAILABLE = function () {
  var host = document.getElementById('spatial-scene');
  if (host.dataset.ready === 'true') return;
  host.dataset.ready = 'fallback';
  host.querySelector('.scene-status').textContent = '3D unavailable. Showing the 2D view.';
  document.getElementById('view-3d').disabled = true;
  document.getElementById('view-3d').setAttribute('aria-pressed', 'false');
  document.getElementById('view-2d').setAttribute('aria-pressed', 'true');
  for (var selector of ['.layers', '.camera-controls', '#scene-motion']) document.querySelector(selector).hidden = true;
};
</script>
<script type="module" src="/home/spatial/scene.js?v=controls-20261005" onerror="window.LARKSPUR_SCENE_UNAVAILABLE()"></script>
<script type="module" src="/home/geography/geography.js"></script>
</body>
</html>`;
}

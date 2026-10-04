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
  if (cls === "Hostile") return `<svg width="${s}" height="${s}" viewBox="0 0 22 22"><path d="M11 1.5L20.5 11 11 20.5 1.5 11z" fill="rgba(255,90,90,.18)" stroke="#ff6b6b" stroke-width="1.6"/></svg>`;
  if (cls === "Friendly") return `<svg width="${s + 6}" height="${s}" viewBox="0 0 28 22"><rect x="1.5" y="3.5" width="25" height="15" rx="1" fill="rgba(110,170,255,.18)" stroke="#6ea8ff" stroke-width="1.6"/></svg>`;
  if (cls === "Civilian") return `<svg width="${s}" height="${s}" viewBox="0 0 22 22"><rect x="2.5" y="2.5" width="17" height="17" fill="rgba(80,210,140,.16)" stroke="#4fd28a" stroke-width="1.6"/></svg>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 22 22"><path d="M11 2a4.5 4.5 0 014.2 2.9A4.5 4.5 0 0119.1 11a4.5 4.5 0 01-3.9 6.1A4.5 4.5 0 0111 20a4.5 4.5 0 01-4.2-2.9A4.5 4.5 0 012.9 11a4.5 4.5 0 013.9-6.1A4.5 4.5 0 0111 2z" fill="rgba(240,200,80,.16)" stroke="#f0c850" stroke-width="1.5"/></svg>`;
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
  :root { --bg:#07090c; --p:#0e1217; --p2:#131820; --line:#1f2731; --line2:#2b3542; --fg:#e8ecf1; --fg2:#a9b2bf; --fg3:#6f7a88;
    --hostile:#ff6b6b; --friend:#6ea8ff; --civ:#4fd28a; --unk:#f0c850; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; min-height: 100vh; }
  .top { display: flex; align-items: center; gap: 18px; height: 46px; padding: 0 18px; border-bottom: 1px solid var(--line); background: #0a0d11; }
  .brand { font-weight: 700; letter-spacing: .14em; font-size: 12px; }
  .meta { display: flex; gap: 16px; color: var(--fg3); font: 11.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .meta b { color: var(--fg2); font-weight: 500; }
  .sim { margin-left: auto; font-size: 11.5px; color: var(--fg2); border: 1px solid var(--line2); padding: 5px 10px; border-radius: 6px; white-space: nowrap; }
  .wrap { display: grid; grid-template-columns: 250px minmax(0, 1fr) 300px; gap: 10px; padding: 10px; height: calc(100vh - 46px - 30px); min-height: 560px; }
  @media (max-width: 1100px) { .wrap { grid-template-columns: 1fr; height: auto; } }
  .card { background: var(--p); border: 1px solid var(--line); border-radius: 8px; display: flex; flex-direction: column; min-height: 0; }
  .hd { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--fg3); }
  .list { list-style: none; margin: 0; padding: 6px; display: grid; gap: 4px; }
  .row { width: 100%; display: grid; grid-template-columns: 30px minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 9px 8px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .row:hover { background: var(--p2); }
  .row.sel { background: var(--p2); border-color: var(--line2); }
  .sym { display: grid; place-items: center; }
  .who b { display: block; font-size: 13px; } .who small { color: var(--fg3); font-size: 11.5px; }
  .eng { font-size: 11px; font-weight: 600; white-space: nowrap; color: var(--fg2); }
  .e-Cleared-to-engage { color: var(--hostile); }
  .rule { margin: auto 10px 10px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; color: var(--fg2); font-size: 12px; }
  .map { position: relative; flex: 1; min-height: 420px; background: #0a0e13; overflow: hidden; }
  .map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .gl { fill: #3b4654; font: 11px ui-monospace, Menlo, monospace; }
  .mlab { fill: #c9d1db; font: 600 11px ui-sans-serif, system-ui, sans-serif; }
  .mk.sel .ring { opacity: 1; }
  .foot { display: flex; gap: 18px; padding: 8px 12px; border-top: 1px solid var(--line); color: var(--fg3); font-size: 11.5px; }
  .foot span { display: inline-flex; align-items: center; gap: 6px; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; }
  .f { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; background: #0b0f14; }
  .f.wide { grid-column: 1 / -1; }
  .f span { display: block; color: var(--fg3); font-size: 11px; }
  .f strong { font-size: 15px; font-weight: 600; }
  .f strong.e-Cleared-to-engage { color: var(--hostile); }
  .actions { display: grid; gap: 8px; padding: 0 12px 12px; }
  button.act { font: 600 13px/1 inherit; padding: 11px 12px; border-radius: 6px; border: 1px solid var(--line2); background: var(--p2); color: var(--fg); cursor: pointer; }
  button.act.primary { background: var(--fg); color: #07090c; border-color: var(--fg); }
  button.act:disabled { opacity: .4; cursor: default; }
  .toast { min-height: 18px; margin: 0 12px 10px; color: var(--fg2); font-size: 12px; }
  .log { list-style: none; margin: 0; padding: 8px 12px 12px; font: 11.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg2); overflow: auto; }
  .log li { padding: 4px 0; border-bottom: 1px solid #141a22; } .log time { color: var(--fg3); margin-right: 8px; }
  footer { height: 30px; display: grid; place-items: center; color: var(--fg3); font-size: 11.5px; }

  /* A map and a single inspector rail; no nested dashboard cards. */
  :root { --bg:#111518; --p:#171b1e; --p2:#21272b; --line:#343b40; --line2:#596267; --fg:#f2f1ed; --fg2:#b6bcbf; --fg3:#8b959a; }
  body { font-size:14px; }
  .top { height:60px; background:var(--bg); border-bottom:1px solid var(--line); padding:0 24px; }
  .brand { letter-spacing:.06em; font-size:14px; }
  .meta { font:12px/1.3 ui-sans-serif,system-ui; }
  .sim { border:0; border-radius:0; color:var(--fg3); padding:0; }
  .wrap { grid-template-columns:minmax(0,1fr) 340px; grid-template-rows:340px minmax(0,1fr); height:calc(100vh - 90px); min-height:760px; padding:0; gap:0; }
  .card { border:0; border-radius:0; background:var(--bg); }
  .wrap>.card:first-child { grid-column:2; grid-row:1; border-left:1px solid var(--line); }
  .wrap>.card:nth-child(2) { grid-column:1; grid-row:1 / 3; }
  .wrap>.card:nth-child(3) { grid-column:2; grid-row:2; border-left:1px solid var(--line); border-top:1px solid var(--line); overflow:auto; }
  .hd { padding:16px 20px; color:var(--fg3); font-size:11px; letter-spacing:.06em; }
  .list { padding:0 12px; gap:0; }
  .row { border-radius:0; grid-template-columns:24px minmax(0,1fr) auto; border:0; border-bottom:1px solid var(--line); padding:14px 8px; }
  .row.sel { border-color:var(--line); background:var(--p2); box-shadow:inset 2px 0 #d8dedf; }
  .who b { font-weight:500; }.who small { font-size:12px; }.eng { font-size:11px; font-weight:500; }
  .rule { border:0; margin:8px 12px; padding:8px; font-size:11px; line-height:1.45; }
  .map { min-height:0; background:#181e22; }
  .map svg { opacity:.95; }
  .foot { border:0; padding:16px 20px; background:var(--bg); gap:16px; font-size:11px; }
  .fields { padding:16px 20px; gap:14px 20px; }
  .f { padding:0; border:0; border-radius:0; background:transparent; }
  .f span { margin-bottom:5px; }.f strong { font-size:16px; font-weight:500; }
  .actions { padding:4px 20px 16px; gap:8px; }
  button.act { border-radius:2px; font:500 13px/1.3 ui-sans-serif,system-ui; padding:12px; background:transparent; }
  button.act.primary { background:#e4e7e6; }.toast { margin:0 20px 16px; }
  .log { padding:0 20px 20px; font:12px/1.5 ui-sans-serif,system-ui; }.log li { border:0; }
  footer { font-size:11px; height:30px; background:var(--bg); }
  @media(max-width:900px) {
    .top { padding:0 16px; }.meta { display:none; }.sim { max-width:55%; font-size:10px; text-align:right; }
    .wrap { grid-template-columns:1fr; grid-template-rows:360px auto auto; min-height:0; height:auto; }
    .wrap>.card:nth-child(2) { grid-column:1; grid-row:1; }
    .wrap>.card:first-child { grid-column:1; grid-row:2; border:0; border-top:1px solid var(--line); }
    .wrap>.card:nth-child(3) { grid-column:1; grid-row:3; border:0; border-top:1px solid var(--line); }
    .foot { flex-wrap:wrap; gap:8px 16px; }.rule { margin-bottom:16px; }
    footer { height:auto; min-height:44px; text-align:center; padding:10px 16px; }
  }

</style>
</head>
<body>
<div class="top">
  <span class="brand">LARKSPUR</span>
  <span class="meta"><span>MISSION <b>NORTH RIDGE</b></span><span>AIRCRAFT <b>LARK-3</b></span><span>LINK <b>OK</b></span></span>
  <span class="sim">Simulated mission. A Vraelis demo fixture, ${mode} mode.</span>
</div>
<div class="wrap">
  <aside class="card" aria-labelledby="c-h">
    <div class="hd"><span id="c-h">Contacts</span><span>4 tracked</span></div>
    <ul class="list" id="list">${rows}</ul>
    <p class="rule">Only a contact classified Hostile and confirmed by the operator can be cleared to engage. Friendly and civilian contacts are never engaged.</p>
  </aside>
  <section class="card" aria-labelledby="m-h">
    <div class="hd"><span id="m-h">Area of operations, North Ridge</span><span>Live picture</span></div>
    <div class="map">
      <svg viewBox="36 6 690 414" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <pattern id="g" width="140" height="100" patternUnits="userSpaceOnUse" x="0" y="20"><path d="M140 0H0V100" fill="none" stroke="#151c25" stroke-width="1"/></pattern>
          <radialGradient id="fov" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(96 92) rotate(55) scale(300 170)"><stop offset="0" stop-color="rgba(160,190,220,.14)"/><stop offset="1" stop-color="rgba(160,190,220,0)"/></radialGradient>
        </defs>
        <rect width="840" height="420" fill="#0a0e13"/>
        <g fill="none" stroke="#141c25" stroke-width="1.2">
          ${M.contours.slice(0, 2).map((d) => `<path d="${d}"/>`).join("")}
          ${M.contours.slice(2, 4).map((d) => `<path d="${d}"/>`).join("")}
          ${M.contours.slice(4).map((d) => `<path d="${d}"/>`).join("")}
        </g>
        <path d="${M.river}" fill="none" stroke="#12304a" stroke-width="7" opacity=".9"/>
        <path d="${M.road}" fill="none" stroke="#2a323d" stroke-width="3"/>
        <rect width="840" height="400" y="20" fill="url(#g)"/>
        ${grid}
        <rect x="140" y="220" width="140" height="100" fill="rgba(255,255,255,.025)" stroke="#2b3542" stroke-dasharray="4 5"/>
        <text x="148" y="236" class="gl">B3</text>
        <path d="M96 92 L 330 250 L 150 360 Z" fill="url(#fov)"/>
        <g transform="translate(96 92)"><circle r="16" fill="none" stroke="#9fb3c8" stroke-opacity=".35"/><path d="M0 -9 L7 6 L0 3 L-7 6 Z" fill="#dfe7ef"/><text x="20" y="-8" class="mlab">LARK-3</text><text x="20" y="7" class="gl">ALT 1,200 m</text></g>
        ${marks}
      </svg>
    </div>
    <div class="foot"><span>${symbol("Hostile", 12)} Hostile</span><span>${symbol("Friendly", 12)} Friendly</span><span>${symbol("Civilian", 12)} Civilian</span><span>${symbol("Unknown", 12)} Unknown</span><span>Shaded: sensor field of view</span></div>
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
    <div class="hd" style="border-top:1px solid var(--line)">Operator log</div>
    <ol class="log" id="log"><li><time>06:12</time>Mission North Ridge started. 4 contacts tracked.</li></ol>
  </section>
</div>
<footer>Nothing here controls real hardware. The aircraft, the contacts and this log exist only in your browser.</footer>
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
  render();
})();
</script>
</body>
</html>`;
}

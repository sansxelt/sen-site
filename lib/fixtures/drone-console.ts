// A SIMULATED DRONE CONSOLE, the connected-device fixture Vraelis demonstrates on.
//
// Served at /api/fixtures/drone?mode=broken|fixed (app/api/fixtures/drone/route.ts). There is no drone and
// no data: a small simulated fleet whose state lives in the visitor's own browser storage, labelled as a
// demo fixture on the page itself.
//
// It exists to have ONE bug, the one connected-device software ships with most: the command is
// ACKNOWLEDGED but not EXECUTED by the aircraft it was meant for. In broken mode, pressing Return home for
// SKY-01 shows "Return home sent to SKY-01" and logs it, but the command is addressed to SKY-10, so SKY-10
// flies home and SKY-01 keeps flying. Every request is fine and the confirmation is on screen; only checking
// what SKY-01 reports afterwards shows the failure. Fixed mode addresses it correctly: SKY-01 goes
// Returning, Landing, then Landed at Pad A, well inside the six seconds a Vraelis assertion waits, and it
// stays Landed after a reload.
//
// THE CONTRACT A PLAN RELIES ON, kept stable across any redesign: the selected aircraft's fields are
// labelled Status, Altitude, Battery and Location (each label beside its value in one small container), the
// buttons are named Return home, Take off, Emergency stop and Reset simulation, and the word "status" appears
// nowhere else as visible text, because a Vraelis assertion finds its target by that text.
//
// The first paint is server-rendered with the starting state, because Vraelis plans from a plain HTTP read
// of the page before any browser runs; a console that painted nothing until JavaScript ran would give the
// planner nothing to plan from.
export type DroneMode = "broken" | "fixed";

export function droneConsoleHtml(mode: DroneMode): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Fieldline Fleet Console</title>
<style>
  :root {
    --bg:#0b0e13; --bg2:#10141b; --panel:#141922; --panel2:#181e28; --line:#232b37; --line2:#2e3846;
    --fg:#eef1f5; --fg2:#aeb6c2; --fg3:#7d8694; --go:#3fcf8e; --warn:#f0b34e; --stop:#ff7056; --blue:#62a8ff; --cyan:#46d1d8;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: radial-gradient(1200px 500px at 70% -10%, #16202e 0%, var(--bg) 60%); color: var(--fg);
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; min-height: 100vh; }
  .top { display: flex; align-items: center; gap: 22px; padding: 12px 22px; border-bottom: 1px solid var(--line); background: rgba(11,14,19,.7); }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 700; letter-spacing: .01em; }
  .brand svg { color: var(--cyan); }
  .nav { display: flex; gap: 4px; }
  .nav a { color: var(--fg3); text-decoration: none; padding: 6px 10px; border-radius: 8px; font-size: 13px; }
  .nav a.on { color: var(--fg); background: var(--panel2); }
  .badge { margin-left: auto; font-size: 11.5px; color: var(--warn); border: 1px solid rgba(240,179,78,.35); border-radius: 999px; padding: 4px 10px; white-space: nowrap; }
  .wrap { display: grid; grid-template-columns: 230px minmax(0,1fr) 300px; gap: 14px; padding: 16px 22px 10px; max-width: 1400px; margin: 0 auto; }
  @media (max-width: 1080px) { .wrap { grid-template-columns: 1fr; } }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; }
  .hd { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--line); font-size: 11.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--fg3); }
  .fleet { list-style: none; margin: 0; padding: 6px; }
  .fleet li { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px; border-radius: 10px; }
  .fleet li.sel { background: var(--panel2); outline: 1px solid var(--line2); }
  .fleet .id { font-weight: 650; } .fleet .sub { display: block; font-size: 12px; color: var(--fg3); }
  .pill { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: #1c2430; }
  .s-Flying { color: var(--blue); } .s-Returning, .s-Landing { color: var(--warn); } .s-Landed, .s-Docked { color: var(--go); } .s-Stopped { color: var(--stop); }
  .ico { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: #1a2230; color: var(--fg2); }
  .mapcard { overflow: hidden; }
  .map { position: relative; height: 460px; background: #0d131b; }
  .map > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .craft svg { display: block; filter: drop-shadow(0 0 8px currentColor); }
  .craft { position: absolute; transform: translate(-50%,-50%); transition: left 1.3s cubic-bezier(.4,0,.2,1), top 1.3s cubic-bezier(.4,0,.2,1); }
  .craft .lab { position: absolute; left: 22px; top: -6px; font-size: 11px; font-weight: 650; background: rgba(13,19,27,.85); border: 1px solid var(--line2); padding: 2px 6px; border-radius: 6px; white-space: nowrap; }
  .legend { display: flex; gap: 16px; padding: 10px 14px; border-top: 1px solid var(--line); font-size: 12px; color: var(--fg3); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px; }
  .field { background: var(--bg2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
  .field span { display: block; font-size: 11.5px; color: var(--fg3); }
  .field strong { font-size: 19px; font-weight: 650; letter-spacing: -.01em; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 14px 14px; }
  button { font: 600 13.5px/1 inherit; border-radius: 10px; padding: 11px 12px; cursor: pointer; border: 1px solid var(--line2); background: var(--panel2); color: var(--fg); }
  button:hover { border-color: var(--fg3); }
  button.primary { background: var(--fg); color: #0b0e13; border-color: var(--fg); }
  button.stop { color: var(--stop); border-color: rgba(255,112,86,.45); }
  .toast { margin: 0 14px 14px; min-height: 20px; font-size: 12.5px; color: var(--go); }
  .log { list-style: none; margin: 0; padding: 10px 14px 14px; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg2); }
  .log li { padding: 5px 0; border-bottom: 1px dashed var(--line); } .log li:last-child { border-bottom: 0; }
  .log time { color: var(--fg3); margin-right: 8px; }
  footer { text-align: center; color: var(--fg3); font-size: 12px; padding: 8px 0 22px; }
</style>
</head>
<body>
<div class="top">
  <div class="brand"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7 7l3.5 3.5M17 7l-3.5 3.5M7 17l3.5-3.5M17 17l-3.5-3.5"/><rect x="10" y="10" width="4" height="4" rx="1"/></svg>Fieldline</div>
  <nav class="nav" aria-label="Console"><a class="on" href="#">Fleet</a><a href="#">Missions</a><a href="#">Maintenance</a></nav>
  <span class="badge">Simulated fleet. A Vraelis demo fixture, ${mode} mode.</span>
</div>
<div class="wrap">
  <aside class="card" aria-labelledby="fleet-h">
    <div class="hd" id="fleet-h">Fleet <span>3 aircraft</span></div>
    <ul class="fleet" id="fleet"></ul>
  </aside>
  <section class="card mapcard" aria-labelledby="map-h">
    <div class="hd"><span id="map-h">Survey area, Field 3</span><span>Live map</span></div>
    <div class="map" id="map">
      <svg viewBox="0 0 800 380" preserveAspectRatio="none" aria-hidden="true">
        <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#18222e" stroke-width="1"/></pattern></defs>
        <rect width="800" height="460" fill="url(#g)"/>
        <g fill="none" stroke="#1e2c3b" stroke-width="1.4">
          <path d="M-20 300 C 120 250, 220 330, 380 280 S 640 200, 820 240"/><path d="M-20 250 C 140 200, 240 280, 400 230 S 650 150, 820 190"/>
          <path d="M-20 200 C 150 150, 260 230, 420 180 S 660 100, 820 140"/><path d="M-20 150 C 160 100, 280 180, 440 130 S 670 50, 820 90"/>
        </g>
        <rect x="430" y="60" width="300" height="170" rx="10" fill="rgba(98,168,255,.05)" stroke="rgba(98,168,255,.35)" stroke-dasharray="6 6"/>
        <text x="442" y="80" fill="#62a8ff" font-size="12" font-family="system-ui">Field 3</text>
        <path d="M605 130 C 480 170, 260 250, 118 312" fill="none" stroke="rgba(70,209,216,.55)" stroke-width="2" stroke-dasharray="4 7"/>
        <circle cx="110" cy="318" r="26" fill="rgba(63,207,142,.08)" stroke="rgba(63,207,142,.55)"/>
        <text x="103" y="323" fill="#3fcf8e" font-size="14" font-weight="700" font-family="system-ui">H</text>
        <text x="80" y="362" fill="#7d8694" font-size="12" font-family="system-ui">Pad A</text>
        <circle cx="690" cy="318" r="22" fill="rgba(63,207,142,.06)" stroke="rgba(63,207,142,.35)"/>
        <text x="683" y="323" fill="#3fcf8e" font-size="13" font-weight="700" font-family="system-ui">H</text>
        <text x="664" y="362" fill="#7d8694" font-size="12" font-family="system-ui">Pad B</text>
      </svg>
      <div id="crafts"></div>
    </div>
    <div class="legend"><span>Dashed line: planned route home</span><span>H: landing pad</span></div>
  </section>
  <section class="card" aria-labelledby="craft-h">
    <div class="hd"><span id="craft-h">SKY-01, survey drone</span><span>Selected</span></div>
    <div class="grid">
      <div class="field"><span>Status</span> <strong id="status" class="s-Flying">Flying</strong></div>
      <div class="field"><span>Altitude</span> <strong id="altitude">42 m</strong></div>
      <div class="field"><span>Battery</span> <strong id="battery">76%</strong></div>
      <div class="field"><span>Location</span> <strong id="location">Field 3</strong></div>
    </div>
    <div class="actions">
      <button type="button" class="primary" id="home">Return home</button>
      <button type="button" id="takeoff">Take off</button>
      <button type="button" class="stop" id="estop">Emergency stop</button>
      <button type="button" id="reset">Reset simulation</button>
    </div>
    <p class="toast" id="toast" role="status"></p>
    <div class="hd" style="border-top:1px solid var(--line)">Command log</div>
    <ol class="log" id="log"><li><time>09:41</time>SKY-01 airborne over Field 3</li></ol>
  </section>
</div>
<footer>Nothing here controls real hardware. The aircraft, their state and this log exist only in your browser.</footer>
<script>
(function () {
  var MODE = ${JSON.stringify(mode)};
  var KEY = "fieldline-fleet-" + MODE;
  var POS = { "Field 3": [76, 34], "Pad A": [14, 84], "Pad B": [86, 84], "En route to Pad A": [40, 62], "En route to Pad B": [86, 58], "Field 1": [60, 22] };
  function start() {
    return {
      craft: {
        "SKY-01": { status: "Flying", altitude: 42, battery: 76, location: "Field 3", home: "Pad A", role: "Survey" },
        "SKY-04": { status: "Docked", altitude: 0, battery: 100, location: "Pad B", home: "Pad B", role: "Mapping" },
        "SKY-10": { status: "Flying", altitude: 55, battery: 64, location: "Field 1", home: "Pad B", role: "Inspection" },
      },
      log: [["09:41", "SKY-01 airborne over Field 3"]],
    };
  }
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY)); return v && v.craft ? v : start(); } catch (e) { return start(); } }
  var s = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  var $ = function (id) { return document.getElementById(id); };
  function clock() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var QUAD = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="5" r="2.6"/><circle cx="19" cy="5" r="2.6"/><circle cx="5" cy="19" r="2.6"/><circle cx="19" cy="19" r="2.6"/><path d="M7 7l3.5 3.5M17 7l-3.5 3.5M7 17l3.5-3.5M17 17l-3.5-3.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor"/></svg>';
  var COLOR = { Flying: "var(--blue)", Returning: "var(--warn)", Landing: "var(--warn)", Landed: "var(--go)", Docked: "var(--go)", Stopped: "var(--stop)" };

  function render() {
    var me = s.craft["SKY-01"];
    $("status").textContent = me.status; $("status").className = "s-" + me.status;
    $("altitude").textContent = me.altitude + " m";
    $("battery").textContent = me.battery + "%";
    $("location").textContent = me.location;

    var fleet = $("fleet"); fleet.textContent = "";
    Object.keys(s.craft).forEach(function (id) {
      var c = s.craft[id], li = el("li", id === "SKY-01" ? "sel" : "");
      var ico = el("span", "ico"); ico.innerHTML = QUAD.replace('width="30" height="30"', 'width="16" height="16"');
      var name = el("span"); name.appendChild(el("span", "id", id)); name.appendChild(el("span", "sub", c.role + ", " + c.location));
      li.appendChild(ico); li.appendChild(name); li.appendChild(el("span", "pill s-" + c.status, c.status));
      fleet.appendChild(li);
    });

    var crafts = $("crafts"); crafts.textContent = "";
    Object.keys(s.craft).forEach(function (id) {
      var c = s.craft[id], p = POS[c.location] || [50, 50];
      var d = el("div", "craft"); d.style.left = p[0] + "%"; d.style.top = p[1] + "%"; d.style.color = COLOR[c.status] || "var(--fg2)";
      d.innerHTML = QUAD; d.appendChild(el("span", "lab", id));
      crafts.appendChild(d);
    });

    var log = $("log"); log.textContent = "";
    s.log.slice(-7).forEach(function (l) { var li = el("li"); li.appendChild(el("time", null, l[0])); li.appendChild(document.createTextNode(l[1])); log.appendChild(li); });
  }
  function note(line) { s.log.push([clock(), line]); }
  function set(id, patch, line) { var c = s.craft[id]; for (var k in patch) c[k] = patch[k]; if (line) note(line); save(); render(); }

  // The aircraft. Each acts only on commands addressed to its own id.
  function deliver(id, cmd) {
    var c = s.craft[id]; if (!c) return;
    if (cmd === "home" && c.status !== "Landed" && c.status !== "Docked") {
      set(id, { status: "Returning", location: "En route to " + c.home }, id + " returning to " + c.home);
      setTimeout(function () { set(id, { status: "Landing", altitude: 8, location: c.home }, id + " landing at " + c.home); }, 700);
      setTimeout(function () { set(id, { status: "Landed", altitude: 0, battery: Math.max(0, c.battery - 2) }, id + " landed at " + c.home); }, 1500);
    }
    if (cmd === "takeoff" && (c.status === "Landed" || c.status === "Docked")) set(id, { status: "Flying", altitude: 40, location: "Field 3" }, id + " airborne over Field 3");
    if (cmd === "estop") set(id, { status: "Stopped" }, id + " motors stopped");
  }

  // The operator's side. In broken mode the Return home command is addressed to SKY-10: the console confirms
  // it for SKY-01, the log records it, and SKY-10 is the aircraft that flies home.
  function send(cmd, label) {
    var to = (MODE === "broken" && cmd === "home") ? "SKY-10" : "SKY-01";
    note(label + " sent to SKY-01"); save(); render();
    $("toast").textContent = label + " sent to SKY-01";
    setTimeout(function () { deliver(to, cmd); }, 150);
  }
  $("home").onclick = function () { send("home", "Return home"); };
  $("takeoff").onclick = function () { send("takeoff", "Take off"); };
  $("estop").onclick = function () { send("estop", "Emergency stop"); };
  $("reset").onclick = function () { s = start(); save(); render(); $("toast").textContent = "Simulation reset"; };
  render();
})();
</script>
</body>
</html>`;
}

// The Vraelis check card: what ChatGPT and claude.ai draw in the conversation when one of the hosted MCP
// tools answers, instead of only a paragraph of text.
//
// MCP Apps (the io.modelcontextprotocol/ui extension, 2026-01-26): a tool names a ui:// resource in
// _meta.ui.resourceUri, the host fetches it with resources/read, renders it in a sandboxed iframe, and
// hands it the tool's structuredContent over a JSON-RPC postMessage bridge. ChatGPT also reads the older
// _meta["openai/outputTemplate"] and exposes window.openai.toolOutput, so the card listens both ways.
//
// SELF-CONTAINED ON PURPOSE. No script, style or font is loaded from anywhere: the host's default CSP allows
// none, and a card that depends on a CDN is a card that renders blank the day that CDN is slow. The text the
// model reads is unchanged; the card is the same facts for the person.
export const WIDGET_URI = "ui://vraelis/check-v1.html";
export const WIDGET_MIME = "text/html;profile=mcp-app";

export const WIDGET_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vraelis check</title>
<style>
  /* The console's palette (design 07, 2026-09-30): zinc neutrals, one cobalt accent for the action, and green,
     amber and red for results only. The button used to be the Verified green, so "Review and approve" looked
     like a pass before anything had run. */
  :root {
    --bg: #f7f7f8; --panel: #ffffff; --fg: #0a0a0b; --fg2: #3f3f46; --fg3: #6b6b74; --line: #e4e4e7;
    --go: #067647; --go-bg: #ecfdf3; --stop: #b42318; --stop-bg: #fef3f2; --stop-line: #fecdca; --hold: #9a5b00; --hold-bg: #fef7e6;
    --wait: #3f3f46; --wait-bg: #f4f4f5; --accent: #3e63dd; --on-accent: #ffffff;
  }
  :root[data-theme="dark"] {
    --bg: #0e0f11; --panel: #16171a; --fg: #f4f4f5; --fg2: #d4d4d8; --fg3: #a1a1aa; --line: #2a2b30;
    --go: #4ade9c; --go-bg: #10261c; --stop: #ff8a80; --stop-bg: #2c1614; --stop-line: #4a2320; --hold: #f2b75a; --hold-bg: #2a220f;
    --wait: #d4d4d8; --wait-bg: #1f2024; --accent: #9eb1ff; --on-accent: #0a0a0b;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; color: var(--fg); font: 14px/1.5 "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
  .top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .mark { width: 18px; height: 18px; flex: none; }
  .brand { font-weight: 600; letter-spacing: 0.01em; }
  .pill { margin-left: auto; font-size: 12.5px; font-weight: 600; line-height: 1; padding: 5px 9px; border-radius: 6px; }
  .pill[data-s="verified"] { color: var(--go); background: var(--go-bg); }
  .pill[data-s="failed"], .pill[data-s="error"] { color: var(--stop); background: var(--stop-bg); }
  .pill[data-s="blocked"] { color: var(--hold); background: var(--hold-bg); }
  .pill[data-s="waiting_for_approval"], .pill[data-s="preparing"], .pill[data-s="running"], .pill[data-s="starting"] { color: var(--wait); background: var(--wait-bg); }
  .claim { margin: 12px 0 2px; font-size: 15px; font-weight: 600; }
  .url { color: var(--fg3); font-size: 12.5px; word-break: break-all; }
  .note { margin: 10px 0 0; color: var(--fg2); }
  h3 { margin: 14px 0 6px; font-size: 12.5px; font-weight: 600; line-height: 1.3; color: var(--fg3); }
  ol, ul { margin: 0; padding-left: 20px; }
  li { margin: 3px 0; color: var(--fg2); }
  .fail { background: var(--stop-bg); border: 1px solid var(--stop-line); border-radius: 8px; padding: 8px 10px; margin: 8px 0; }
  .fail b { color: var(--fg); }
  .kv { font-size: 12.5px; color: var(--fg2); }
  .kv span { color: var(--fg3); }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; align-items: center; }
  .btn { appearance: none; border: 0; cursor: pointer; background: var(--accent); color: var(--on-accent); font: 600 13.5px/1 inherit; padding: 10px 14px; border-radius: 8px; text-decoration: none; }
  .link { color: var(--fg2); font-size: 13px; }
  .muted { color: var(--fg3); font-size: 12px; margin-top: 10px; }
  .spin { display: inline-block; width: 10px; height: 10px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: s 0.9s linear infinite; vertical-align: -1px; margin-right: 6px; }
  @keyframes s { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
</head>
<body>
<div class="card" id="root" aria-live="polite"><div class="top"><span class="brand">Vraelis</span></div><p class="note">Waiting for the check.</p></div>
<script>
(function () {
  var root = document.getElementById("root");
  var LABEL = { verified: "Verified", failed: "Failed", blocked: "Blocked", waiting_for_approval: "Needs your approval", preparing: "Writing the plan", running: "Checking", starting: "Starting", error: "Not checked" };
  var host = window.parent;
  var nextId = 1, pending = {};

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeHref(u) { return /^https:\\/\\//.test(String(u || "")) ? esc(u) : ""; }

  function openLink(url) {
    if (window.openai && typeof window.openai.openExternal === "function") { window.openai.openExternal({ href: url }); return; }
    request("ui/open-link", { url: url }).catch(function () { window.open(url, "_blank", "noopener"); });
  }
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      host.postMessage({ jsonrpc: "2.0", id: id, method: method, params: params || {} }, "*");
      setTimeout(function () { if (pending[id]) { delete pending[id]; reject(new Error("timeout")); } }, 4000);
    });
  }
  function notify(method, params) { host.postMessage({ jsonrpc: "2.0", method: method, params: params || {} }, "*"); }

  function mark() {
    return '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-dasharray="46 8" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>';
  }

  function render(d) {
    if (!d || typeof d !== "object" || !d.state) return;
    var s = d.state, h = [];
    var busy = s === "preparing" || s === "running" || s === "starting";
    h.push('<div class="top">' + mark() + '<span class="brand">Vraelis</span><span class="pill" data-s="' + esc(s) + '">' + (busy ? '<span class="spin"></span>' : "") + esc(LABEL[s] || s) + "</span></div>");
    if (d.claim) h.push('<p class="claim">' + esc(d.claim) + "</p>");
    if (d.url) h.push('<div class="url">' + esc(d.url) + "</div>");
    if (s === "waiting_for_approval") h.push('<p class="note">Vraelis wrote this plan from the claim. It runs only after you approve it. Your assistant cannot approve it for you.</p>');
    if (s === "preparing") h.push('<p class="note">Reading the site and writing a check plan. This usually takes under two minutes.</p>');
    if (s === "running") h.push('<p class="note">A real browser is checking the live app.</p>');
    if (s === "verified") h.push('<p class="note">Checked on the live app in a real browser. No failures observed.</p>');
    if (s === "blocked") h.push('<p class="note">Vraelis could not reach a decision. This is not a pass.</p>');
    if (s === "error" && d.message) h.push('<p class="note">' + esc(d.message) + "</p>");
    if (d.failures && d.failures.length) {
      h.push("<h3>What broke</h3>");
      d.failures.forEach(function (f) {
        h.push('<div class="fail"><b>' + esc(f.title || "Issue") + "</b>" +
          (f.expected ? '<div class="kv"><span>expected </span>' + esc(f.expected) + "</div>" : "") +
          (f.observed ? '<div class="kv"><span>observed </span>' + esc(f.observed) + "</div>" : "") + "</div>");
      });
    }
    if (d.requirements && d.requirements.length) {
      h.push("<h3>" + (s === "waiting_for_approval" ? "It will check" : "Requirements") + "</h3><ol>");
      d.requirements.forEach(function (r) { h.push("<li>" + esc(r) + "</li>"); });
      h.push("</ol>");
    }
    if (d.flows && d.flows.length) {
      h.push("<h3>What the browser will do</h3><ul>");
      d.flows.forEach(function (f) { h.push("<li>" + esc(f.name || "Journey") + (f.goal ? ": " + esc(f.goal) : "") + "</li>"); });
      h.push("</ul>");
    }
    var actions = [];
    if (s === "waiting_for_approval" && safeHref(d.approve_url)) actions.push('<a class="btn" data-open="' + safeHref(d.approve_url) + '" href="' + safeHref(d.approve_url) + '" target="_blank" rel="noopener">Review and approve</a>');
    if (safeHref(d.record_url)) actions.push('<a class="link" data-open="' + safeHref(d.record_url) + '" href="' + safeHref(d.record_url) + '" target="_blank" rel="noopener">Open the record</a>');
    if (actions.length) h.push('<div class="row">' + actions.join("") + "</div>");
    if (d.verification_id) h.push('<div class="muted">' + esc(d.verification_id) + "</div>");
    root.innerHTML = h.join("");
    size();
  }

  root.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-open]");
    if (!a) return;
    e.preventDefault();
    openLink(a.getAttribute("data-open"));
  });

  function theme(t) { if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t); }
  function size() { notify("ui/notifications/size-changed", { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }); }

  // The MCP Apps bridge.
  window.addEventListener("message", function (ev) {
    if (ev.source !== host) return;
    var m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id != null && pending[m.id]) { var p = pending[m.id]; delete pending[m.id]; if (m.error) p.reject(m.error); else p.resolve(m.result); return; }
    if (m.method === "ui/notifications/tool-result" && m.params) render(m.params.structuredContent);
    if (m.method === "ui/notifications/host-context-changed" && m.params) theme(m.params.theme);
  });
  request("ui/initialize", { protocolVersion: "2026-01-26", appInfo: { name: "Vraelis", version: "1" }, appCapabilities: {} })
    .then(function (r) { if (r && r.hostContext) theme(r.hostContext.theme); notify("ui/notifications/initialized", {}); })
    .catch(function () {});

  // ChatGPT's window.openai globals, for hosts that deliver the result that way.
  function fromOpenAI() { if (window.openai) { theme(window.openai.theme); render(window.openai.toolOutput); } }
  window.addEventListener("openai:set_globals", fromOpenAI);
  fromOpenAI();
  if (window.ResizeObserver) new ResizeObserver(size).observe(document.body);
})();
</script>
</body>
</html>`;

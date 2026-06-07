/* Vraelis embeddable lead chat widget.
 * Usage on any site:
 *   <script src="https://vraelis.com/widget.js" data-vraelis-key="vk_..."></script>
 * Self-contained vanilla JS — no dependencies, inline styles so it doesn't
 * rely on the host page's CSS. Talks to the same (CORS-enabled) intake +
 * continue endpoints the hosted form uses. */
(function () {
  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  var KEY = script.getAttribute("data-vraelis-key") || script.getAttribute("data-key");
  if (!KEY) return;
  var BASE;
  try { BASE = new URL(script.src).origin; } catch (e) { BASE = "https://vraelis.com"; }

  var ACCENT = "#0E9E6C", DEEP = "#0B7E55", INK = "#1B1A16", MUT = "#6E695F", LINE = "#E7E3DA", PAPER = "#FFFFFF";
  var leadId = null, busy = false, open = false;

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.setAttribute("style", css);
    if (text != null) e.textContent = text;
    return e;
  }
  function font() { return "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"; }

  // ── Launcher button ───────────────────────────────────────────────
  var btn = el(
    "button",
    "position:fixed;bottom:20px;right:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:" +
      ACCENT +
      ";color:#fff;box-shadow:0 10px 30px -8px rgba(14,158,108,0.6);font-family:" +
      font() +
      ";font-size:24px;line-height:1;"
  );
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = "&#128172;"; // speech balloon

  // ── Panel ─────────────────────────────────────────────────────────
  var panel = el(
    "div",
    "position:fixed;bottom:88px;right:20px;z-index:2147483000;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:" +
      PAPER +
      ";border:1px solid " + LINE +
      ";border-radius:16px;box-shadow:0 30px 70px -20px rgba(0,0,0,0.35);display:none;flex-direction:column;overflow:hidden;font-family:" +
      font() + ";"
  );

  var header = el(
    "div",
    "padding:14px 16px;background:" + ACCENT + ";color:#fff;font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:space-between;"
  );
  header.appendChild(el("span", null, "Chat with us"));
  var closeBtn = el("button", "background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:0;", "×");
  header.appendChild(closeBtn);
  panel.appendChild(header);

  var bodyWrap = el("div", "flex:1;display:flex;flex-direction:column;min-height:0;");
  panel.appendChild(bodyWrap);

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  function toggle(o) {
    open = o == null ? !open : o;
    panel.style.display = open ? "flex" : "none";
    if (open && !bodyWrap.firstChild) renderForm();
  }
  btn.addEventListener("click", function () { toggle(); });
  closeBtn.addEventListener("click", function () { toggle(false); });

  function inputStyle() {
    return "width:100%;box-sizing:border-box;border:1px solid " + LINE + ";border-radius:8px;padding:11px 13px;font-size:14px;color:" + INK + ";outline:none;font-family:" + font() + ";margin-bottom:10px;";
  }
  function btnStyle() {
    return "width:100%;border:none;border-radius:999px;padding:12px;background:" + ACCENT + ";color:#fff;font-weight:600;font-size:15px;cursor:pointer;font-family:" + font() + ";";
  }

  // ── Intake form ───────────────────────────────────────────────────
  function renderForm() {
    bodyWrap.innerHTML = "";
    var wrap = el("div", "padding:18px;overflow-y:auto;");
    wrap.appendChild(el("div", "font-size:14px;color:" + MUT + ";line-height:1.5;margin-bottom:14px;", "Tell us what you need — you'll get an answer in seconds."));
    var form = el("form");
    var name = el("input", inputStyle()); name.placeholder = "Your name";
    var email = el("input", inputStyle()); email.placeholder = "Email"; email.type = "email";
    var phone = el("input", inputStyle()); phone.placeholder = "Phone (optional)";
    var msg = el("textarea", inputStyle() + "resize:vertical;min-height:84px;"); msg.placeholder = "What can we help with?"; msg.required = true;
    var send = el("button", btnStyle(), "Start chat"); send.type = "submit";
    [name, email, phone, msg, send].forEach(function (n) { form.appendChild(n); });
    wrap.appendChild(form);
    bodyWrap.appendChild(wrap);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy || !msg.value.trim()) return;
      busy = true; send.textContent = "Starting…"; send.disabled = true;
      post(BASE + "/api/vraelis/intake", {
        key: KEY, name: name.value, email: email.value, phone: phone.value, message: msg.value, source: "widget",
      }).then(function (j) {
        busy = false;
        if (!j || !j.ok || !j.leadId) { send.textContent = "Start chat"; send.disabled = false; return; }
        leadId = j.leadId;
        renderChat([{ role: "lead", text: msg.value }].concat(j.reply ? [{ role: "agent", text: j.reply }] : []));
      }).catch(function () { busy = false; send.textContent = "Start chat"; send.disabled = false; });
    });
  }

  // ── Chat thread ───────────────────────────────────────────────────
  var thread;
  function bubble(t) {
    var lead = t.role === "lead";
    var b = el(
      "div",
      "max-width:85%;align-self:" + (lead ? "flex-end" : "flex-start") +
        ";background:" + (lead ? ACCENT : "#F1EEE7") + ";color:" + (lead ? "#fff" : INK) +
        ";padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word;",
      t.text
    );
    return b;
  }
  function renderChat(turns) {
    bodyWrap.innerHTML = "";
    thread = el("div", "flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;");
    turns.forEach(function (t) { thread.appendChild(bubble(t)); });
    bodyWrap.appendChild(thread);
    var bar = el("form", "display:flex;gap:8px;padding:12px;border-top:1px solid " + LINE + ";");
    var inp = el("input", "flex:1;border:1px solid " + LINE + ";border-radius:8px;padding:10px 12px;font-size:14px;outline:none;font-family:" + font() + ";");
    inp.placeholder = "Type a message…";
    var s = el("button", "border:none;border-radius:999px;padding:0 16px;background:" + ACCENT + ";color:#fff;font-weight:600;cursor:pointer;font-family:" + font() + ";", "Send");
    s.type = "submit";
    bar.appendChild(inp); bar.appendChild(s);
    bodyWrap.appendChild(bar);
    thread.scrollTop = thread.scrollHeight;

    bar.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = inp.value.trim();
      if (!text || busy) return;
      inp.value = "";
      thread.appendChild(bubble({ role: "lead", text: text }));
      thread.scrollTop = thread.scrollHeight;
      busy = true;
      var typing = bubble({ role: "agent", text: "…" });
      thread.appendChild(typing); thread.scrollTop = thread.scrollHeight;
      post(BASE + "/api/vraelis/intake/continue", { key: KEY, leadId: leadId, message: text }).then(function (j) {
        busy = false;
        thread.removeChild(typing);
        thread.appendChild(bubble({ role: "agent", text: (j && j.reply) || "Sorry — something went wrong, please try again." }));
        thread.scrollTop = thread.scrollHeight;
      }).catch(function () {
        busy = false; thread.removeChild(typing);
        thread.appendChild(bubble({ role: "agent", text: "Sorry — something went wrong, please try again." }));
      });
    });
  }

  function post(url, data) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(function (r) { return r.json(); });
  }
})();

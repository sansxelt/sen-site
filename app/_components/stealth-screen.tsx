"use client";

// The stealth curtain. Shares the 404's calm paper field and restraint (app/not-found.tsx) but not its
// oversized numeral: here the headline IS the composition. An earlier version put a redacted line above it
// and the mark competed with the one sentence that carries the page, so it went.
//
// The unlock sequence lives ONLY on the server (see lib/stealth.ts). This file never contains it.
//
// This component is the ONLY thing the server renders while stealth is on, so nothing of the real site is
// in the HTML or the RSC payload until the cookie exists.

import { useEffect, useState } from "react";

export function StealthScreen() {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    // This listener does NOT know the unlock sequence, on purpose. It buffers the letters typed while
    // Ctrl+Shift+Alt is held and asks the server whether the buffer is right. Everything below is visible in
    // DevTools and none of it is the answer.
    //
    // Modifiers matter for a second reason: holding Alt keeps this off Chrome's Ctrl+Shift+I, which opens
    // DevTools at the browser level and cannot be prevented from a page.
    const MAX_LEN = 8;
    const RESET_MS = 4000;
    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;
    let cancelled = false;

    function reset() {
      buffer = "";
      if (timer) clearTimeout(timer);
    }

    async function check() {
      if (checking) return;
      checking = true;
      try {
        const res = await fetch("/api/stealth/unlock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ seq: buffer }),
        });
        const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        if (cancelled) return;
        if (j?.ok) {
          reset();
          setOpening(true);
          // Full reload, not a router refresh: the server must re-render the real layout from scratch now
          // that the signed cookie exists.
          location.reload();
        }
      } catch {
        // Offline or blocked: stay closed and silent. A failed check must never look like a hint.
      } finally {
        checking = false;
      }
    }

    function onKey(e: KeyboardEvent) {
      // Modifier keys fire their own keydown events. Ignore them, or pressing Shift mid-sequence would
      // discard a buffer that was going fine.
      if (e.key === "Control" || e.key === "Shift" || e.key === "Alt" || e.key === "Meta") return;
      if (!(e.ctrlKey && e.shiftKey && e.altKey)) { reset(); return; }

      // Prefer e.code: with Alt held, some layouts report a composed or dead character in e.key while the
      // physical key stays stable. Case never matters either way.
      const code = e.code.toLowerCase();
      const letter = code.startsWith("key") ? code.slice(3) : e.key.toLowerCase();
      if (letter.length !== 1 || letter < "a" || letter > "z") { reset(); return; }

      e.preventDefault();
      buffer = (buffer + letter).slice(-MAX_LEN);
      if (timer) clearTimeout(timer);
      timer = setTimeout(reset, RESET_MS);
      void check();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        isolation: "isolate",
        textAlign: "center",
        padding: "clamp(40px, 8vw, 96px) var(--gutter)",
        background: "radial-gradient(135% 100% at 50% 4%, var(--bg-1) 0%, var(--bg-0) 62%, var(--bg-2) 100%)",
      }}
    >
      <style>{ST_CSS}</style>

      <div className="gridbg" aria-hidden style={{ opacity: 0.4 }} />
      <div className="vst-bloom" aria-hidden />

      <div className="wrap vst-stack">
        <h1 className="vst-head vst-in vst-d1">
          Vraelis is in <span className="em">stealth</span>.
        </h1>

        <p className="vst-body vst-in vst-d2">
          {opening ? "Opening…" : "Not public yet. If you were meant to be here, you already know the way in."}
        </p>
      </div>
    </main>
  );
}

const ST_CSS = `
/* Type only, sat a little above true centre. Dead centre reads as content that fell there; a touch high
   reads as composed. */
.vst-stack{
  position:relative; z-index:1;
  display:flex; flex-direction:column; align-items:center;
  max-width:680px; margin:0 auto;
  transform:translateY(-6%);
}

.vst-head{
  font-family:var(--font-display);
  font-size:clamp(1.5rem, 3.4vw, 2.35rem);
  font-weight:600; letter-spacing:-.02em; line-height:1.12;
  color:var(--fg-1);
  margin:0; /* nothing above it now, so no top margin to clear */
}
.vst-body{
  font-size:clamp(1rem, 1.25vw, 1.12rem); line-height:1.55;
  color:var(--fg-2); max-width:440px; margin:13px auto 0; text-wrap:pretty;
}

.vst-bloom{
  position:absolute; z-index:0; pointer-events:none;
  top:44%; left:50%; width:min(880px, 122vw); height:min(880px, 122vw);
  transform:translate(-50%,-50%);
  background:radial-gradient(circle, var(--acc-glow) 0%, var(--acc-soft) 36%, transparent 68%);
  animation:vst-breathe 10s var(--ease-out) infinite;
}

.vst-in{ animation:vst-rise .6s var(--ease-out) both; }
.vst-d1{ animation-delay:120ms; }
.vst-d2{ animation-delay:200ms; }

@keyframes vst-rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
@keyframes vst-breathe{ 0%,100%{ opacity:.45; transform:translate(-50%,-50%) scale(1); } 50%{ opacity:.8; transform:translate(-50%,-50%) scale(1.07); } }

@media (prefers-reduced-motion: reduce){
  .vst-in, .vst-bloom{ animation:none !important; }
  .vst-in{ opacity:1; transform:none; }
}
`;

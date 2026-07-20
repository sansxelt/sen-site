"use client";

// The stealth curtain. Same visual language as the 404 (app/not-found.tsx): one oversized composition with
// the middle glyph in emerald, one headline, one honest line, calm paper field. Where the 404 shows 4-0-4,
// this shows three redaction bars, because the page is not missing, it is withheld.
//
// The unlock is Ctrl+Shift+I, chosen by the founder. See the note in stealth.ts about what this is and is
// not: a curtain, never access control.
//
// This component is the ONLY thing the server renders while stealth is on, so nothing of the real site is
// in the HTML or the RSC payload until the cookie exists.

import { useEffect, useState } from "react";
import { STEALTH_COOKIE, STEALTH_VALUE } from "@/lib/stealth";

export function StealthScreen() {
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl+Shift+I (the founder's pick) or Ctrl+Shift+U as a fallback, because on Chrome the first also
      // opens DevTools at the browser level and cannot be prevented from a page.
      const combo = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "U" || e.key === "u");
      if (!combo) return;
      e.preventDefault();
      // Session-length cookie: closing the browser re-arms the curtain, which is the behaviour you want for
      // a laptop that gets opened in front of other people.
      document.cookie = `${STEALTH_COOKIE}=${STEALTH_VALUE}; path=/; max-age=86400; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
      setOpening(true);
      // Full reload, not a router refresh: the server must re-render the real layout from scratch now that
      // the cookie exists.
      location.reload();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        <h1 className="display vst-bars" aria-label="Vraelis is in stealth">
          <span aria-hidden>&#9608;</span>
          <span aria-hidden className="em vst-mid">&#9608;</span>
          <span aria-hidden>&#9608;</span>
        </h1>

        <h2 className="vst-head vst-in vst-d1">
          Vraelis is in <span className="em">stealth</span>.
        </h2>

        <p className="vst-body vst-in vst-d2">
          {opening ? "Opening…" : "Not public yet. If you were meant to be here, you already know the way in."}
        </p>
      </div>
    </main>
  );
}

const ST_CSS = `
.vst-stack{ position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; max-width:680px; margin:0 auto; }

.vst-bars{
  font-family:var(--font-display);
  font-size:clamp(4rem, 17vw, 13rem);
  line-height:.82;
  letter-spacing:.02em;
  font-weight:600;
  color:var(--fg-1);
  margin:0;
  opacity:.92;
  animation:vst-fade .8s var(--ease-out) both, vst-float 8s var(--ease-out) 900ms infinite;
}
.vst-mid{ color:var(--acc-deep); display:inline-block; animation:vst-drift 8s var(--ease-out) infinite; }

.vst-head{
  font-family:var(--font-display);
  font-size:clamp(1.5rem, 3.4vw, 2.35rem);
  font-weight:600; letter-spacing:-.02em; line-height:1.12;
  color:var(--fg-1);
  margin:clamp(10px, 1.8vw, 18px) 0 0;
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
@keyframes vst-fade{ from{ opacity:0; } to{ opacity:.92; } }
@keyframes vst-float{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-10px); } }
@keyframes vst-drift{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-5px); } }
@keyframes vst-breathe{ 0%,100%{ opacity:.45; transform:translate(-50%,-50%) scale(1); } 50%{ opacity:.8; transform:translate(-50%,-50%) scale(1.07); } }

@media (prefers-reduced-motion: reduce){
  .vst-bars, .vst-mid, .vst-in, .vst-bloom{ animation:none !important; }
  .vst-in{ opacity:1; transform:none; }
  .vst-bars{ opacity:.92; }
}
`;

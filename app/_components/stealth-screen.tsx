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
        {/* A redacted line: the shape of a sentence with the words struck out. Real elements rather than
            block characters, so the proportions are controlled and nothing collides with the heading. */}
        <div className="vst-redact" aria-hidden>
          <i style={{ width: "20%", animationDelay: "0ms" }} />
          <i style={{ width: "29%", animationDelay: "70ms" }} className="vst-mid" />
          <i style={{ width: "11%", animationDelay: "140ms" }} />
          <i style={{ width: "21%", animationDelay: "210ms" }} />
        </div>

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
.vst-stack{ position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; max-width:680px; margin:0 auto; }

/* The redacted line. Bars are sized as a share of one measure so the composition holds at every width. */
/* nowrap on purpose: a redaction is ONE struck-out line. Let it wrap and it reads as a bar chart.
   Widths are percentages of the container and are kept well under 100% so the gaps always fit. */
.vst-redact{
  display:flex; align-items:center; justify-content:center; flex-wrap:nowrap;
  gap:clamp(7px, .9vw, 12px);
  width:min(430px, 78vw);
  margin:0 auto clamp(20px, 2.6vw, 30px);
}
.vst-redact i{
  display:block;
  height:clamp(17px, 2.1vw, 26px);
  border-radius:3px;
  background:var(--fg-1);
  opacity:.86;
  animation:vst-bar .55s var(--ease-out) both;
}
.vst-redact i.vst-mid{ background:var(--acc-deep); opacity:1; }

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
/* Bars wipe in from the left, the way a redaction is drawn over text. */
@keyframes vst-bar{ from{ opacity:0; transform:scaleX(.2); } to{ opacity:.86; transform:none; } }
/* The accent bar holds full opacity; the "both" fill mode would otherwise pin it to the .86 above. */
@keyframes vst-bar-em{ from{ opacity:0; transform:scaleX(.2); } to{ opacity:1; transform:none; } }
.vst-redact i.vst-mid{ animation-name:vst-bar-em; }
@keyframes vst-breathe{ 0%,100%{ opacity:.45; transform:translate(-50%,-50%) scale(1); } 50%{ opacity:.8; transform:translate(-50%,-50%) scale(1.07); } }

.vst-redact i{ transform-origin:left center; }

@media (prefers-reduced-motion: reduce){
  .vst-redact i, .vst-in, .vst-bloom{ animation:none !important; }
  .vst-in{ opacity:1; transform:none; }
  .vst-redact i{ opacity:.86; transform:none; }
  .vst-redact i.vst-mid{ opacity:1; }
}
`;

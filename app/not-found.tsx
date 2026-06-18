import Link from "next/link";

/**
 * Vraelis 404 — "Agent on the Case": an A24 title-card on cream with light
 * instrument chrome. Server Component, zero JS — all motion is pure CSS
 * @keyframes (below) with a full prefers-reduced-motion guard. It leans
 * entirely on the loaded vraelis light theme (/vraelis/tokens.css +
 * /vraelis/styles.css): warm paper, emerald phosphor, dark ink — so every
 * piece of real copy is high-contrast and readable (--fg-1/--fg-2 on paper),
 * never light-on-light. Decorative layers (grid, bloom, scan, ticks) carry no
 * information and are aria-hidden.
 */
export default function NotFound() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        isolation: "isolate",
        textAlign: "center",
        padding: "clamp(40px, 8vw, 96px) var(--gutter)",
        background:
          "radial-gradient(135% 100% at 50% 6%, var(--bg-1) 0%, var(--bg-0) 60%, var(--bg-2) 100%)",
      }}
    >
      <style>{NF_CSS}</style>

      {/* Atmosphere (decorative): hairline grid, one breathing emerald bloom,
          one slow scan line. */}
      <div className="gridbg" aria-hidden style={{ opacity: 0.5 }} />
      <div className="v404-bloom" aria-hidden />
      <div className="v404-scan" aria-hidden />

      {/* HUD corner ticks — instrument chrome */}
      <span className="inst v404-tick v404-tick--bl" aria-hidden>VRAELIS / MONITOR</span>
      <span className="inst v404-tick v404-tick--br" aria-hidden>BEACON: LOST</span>

      <div className="wrap v404-stack">
        <p className="eyebrow v404-in v404-d1" style={{ margin: 0 }}>
          Error 404 — lead not found
        </p>

        <h1 className="display v404-num v404-in v404-d2" aria-label="404 — page not found">
          <span aria-hidden>4</span>
          <span aria-hidden className="em v404-zero">0</span>
          <span aria-hidden>4</span>
        </h1>

        <h2 className="v404-head v404-in v404-d3">
          This page went <span className="em">cold</span>.
        </h2>

        <p className="v404-body v404-in v404-d4">
          The link you followed isn&rsquo;t here — moved, retired, or never on the
          map. But your agent never lets a thread go dark, so let&rsquo;s get you
          back on track.
        </p>

        <div className="v404-actions v404-in v404-d5">
          <Link href="/" className="btn btn--lg">Back home</Link>
          <Link href="/how" className="btn btn--ghost btn--lg">How it works</Link>
        </div>

        <div className="v404-readout v404-in v404-d6" aria-hidden>
          <span className="inst">STATUS</span>
          <span className="v404-readout-line" />
          <span className="inst v404-readout-val">404 · ROUTE NOT FOUND</span>
        </div>
      </div>
    </main>
  );
}

/* All custom classes are prefixed v404- so nothing leaks into the shared
   vraelis stylesheet. Colors reference only confirmed light-theme vars, so
   text stays dark ink on warm paper. Entrance staggers so the page "powers
   up" like an instrument; reduced-motion freezes everything to the still. */
const NF_CSS = `
.v404-stack{
  position:relative; z-index:1;
  display:flex; flex-direction:column; align-items:center;
  max-width:720px; margin:0 auto;
}

/* Title-card numerals — they dominate the viewport. */
.v404-num{
  font-family:var(--font-display);
  font-size:clamp(7rem, 26vw, 20rem);
  line-height:.82;
  letter-spacing:-.05em;
  font-weight:600;
  color:var(--fg-1);
  margin:0;
  animation:v404-fade .7s var(--ease-out) 100ms both,
            v404-float 7s var(--ease-out) 850ms infinite;
}
/* The center 0 = the brand's Instrument-Serif flourish, in AA-safe deep
   emerald (not the lighter --acc) so the colored glyph still reads on paper. */
.v404-zero{
  color:var(--acc-deep);
  display:inline-block;
  animation:v404-drift 7s var(--ease-out) infinite;
}

.v404-head{
  font-family:var(--font-display);
  font-size:clamp(1.55rem, 3.6vw, 2.5rem);
  font-weight:600;
  letter-spacing:-.02em;
  line-height:1.1;
  color:var(--fg-1);
  margin:clamp(8px, 1.6vw, 16px) 0 0;
}
.v404-body{
  font-size:clamp(1rem, 1.3vw, 1.16rem);
  line-height:1.55;
  color:var(--fg-2);
  max-width:520px;
  margin:14px auto 0;
  text-wrap:pretty;
}
.v404-actions{
  display:flex; flex-wrap:wrap; gap:14px; justify-content:center;
  margin-top:clamp(24px, 3.2vw, 36px);
}
.v404-readout{
  display:flex; align-items:center; gap:14px;
  width:min(440px, 100%);
  margin-top:clamp(28px, 3.6vw, 44px);
  padding-top:16px;
  border-top:1px solid var(--line-2);
  color:var(--fg-4);
}
.v404-readout-line{ flex:1; height:1px; background:var(--line-2); }
.v404-readout-val{ color:var(--fg-3); }

/* HUD corner ticks */
.v404-tick{ position:absolute; z-index:2; bottom:var(--gutter); }
.v404-tick--bl{ left:var(--gutter); color:var(--fg-4); }
.v404-tick--br{ right:var(--gutter); color:var(--money); }

/* Breathing emerald bloom behind the numerals */
.v404-bloom{
  position:absolute; z-index:0; pointer-events:none;
  top:42%; left:50%;
  width:min(960px, 130vw); height:min(960px, 130vw);
  transform:translate(-50%,-50%);
  background:radial-gradient(circle,
    var(--acc-glow) 0%, var(--acc-soft) 34%, transparent 68%);
  animation:v404-breathe 9s var(--ease-out) infinite;
}
/* One slow phosphor scan line drifting down the page */
.v404-scan{
  position:absolute; z-index:0; pointer-events:none;
  left:0; right:0; height:160px; opacity:.7;
  background:linear-gradient(to bottom, transparent, var(--acc-soft), transparent);
  animation:v404-scan 8s linear infinite;
}

/* Staggered "power-up" entrance */
.v404-in{ animation:v404-rise .6s var(--ease-out) both; }
.v404-d1{ animation-delay:40ms; }
.v404-d2{ animation-delay:0ms; }   /* numerals run their own fade+float */
.v404-d3{ animation-delay:160ms; }
.v404-d4{ animation-delay:220ms; }
.v404-d5{ animation-delay:280ms; }
.v404-d6{ animation-delay:340ms; }
/* the numerals opt out of v404-rise (they fade+float instead) */
.v404-num.v404-in{ animation:v404-fade .7s var(--ease-out) 100ms both,
                              v404-float 7s var(--ease-out) 850ms infinite; }

@keyframes v404-rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
@keyframes v404-fade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes v404-float{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-12px); } }
@keyframes v404-drift{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-6px); } }
@keyframes v404-breathe{ 0%,100%{ opacity:.5; transform:translate(-50%,-50%) scale(1); } 50%{ opacity:.9; transform:translate(-50%,-50%) scale(1.08); } }
@keyframes v404-scan{ 0%{ top:-20%; } 100%{ top:120%; } }

@media (max-width:560px){
  .v404-tick{ display:none; }
}

@media (prefers-reduced-motion: reduce){
  .v404-num, .v404-zero, .v404-in, .v404-bloom, .v404-scan{ animation:none !important; }
  .v404-in{ opacity:1; transform:none; }
}
`;

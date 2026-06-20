import Link from "next/link";

/**
 * Vraelis 404. Server Component, zero JS — motion is pure CSS with a
 * prefers-reduced-motion guard. Deliberately restrained: one oversized
 * numeral set with the Instrument-Serif "0" in deep emerald, a calm paper
 * field, one honest line. Text is dark ink on warm paper (readable).
 */
export default function NotFound() {
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
        background:
          "radial-gradient(135% 100% at 50% 4%, var(--bg-1) 0%, var(--bg-0) 62%, var(--bg-2) 100%)",
      }}
    >
      <style>{NF_CSS}</style>

      <div className="gridbg" aria-hidden style={{ opacity: 0.4 }} />
      <div className="v404-bloom" aria-hidden />

      <div className="wrap v404-stack">
        <h1 className="display v404-num" aria-label="404 — page not found">
          <span aria-hidden>4</span>
          <span aria-hidden className="em v404-zero">0</span>
          <span aria-hidden>4</span>
        </h1>

        <h2 className="v404-head v404-in v404-d1">
          This page doesn&rsquo;t <span className="em">exist</span>.
        </h2>

        <p className="v404-body v404-in v404-d2">
          The link you followed doesn&rsquo;t exist &mdash; or doesn&rsquo;t anymore.
        </p>

        <div className="v404-actions v404-in v404-d3">
          <Link href="/" className="btn btn--lg">Back home</Link>
          <Link href="/vote" className="v404-link">Vote &amp; earn credits</Link>
        </div>
      </div>
    </main>
  );
}

const NF_CSS = `
.v404-stack{ position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; max-width:680px; margin:0 auto; }

.v404-num{
  font-family:var(--font-display);
  font-size:clamp(7rem, 27vw, 21rem);
  line-height:.82;
  letter-spacing:-.05em;
  font-weight:600;
  color:var(--fg-1);
  margin:0;
  animation:v404-fade .8s var(--ease-out) both, v404-float 8s var(--ease-out) 900ms infinite;
}
.v404-zero{ color:var(--acc-deep); display:inline-block; animation:v404-drift 8s var(--ease-out) infinite; }

.v404-head{
  font-family:var(--font-display);
  font-size:clamp(1.5rem, 3.4vw, 2.35rem);
  font-weight:600; letter-spacing:-.02em; line-height:1.12;
  color:var(--fg-1);
  margin:clamp(10px, 1.8vw, 18px) 0 0;
}
.v404-body{
  font-size:clamp(1rem, 1.25vw, 1.12rem); line-height:1.55;
  color:var(--fg-2); max-width:440px; margin:13px auto 0; text-wrap:pretty;
}
.v404-actions{ display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:20px; margin-top:clamp(26px, 3.4vw, 40px); }
.v404-link{
  font-size:var(--fs-body-sm); color:var(--fg-3); text-decoration:none;
  border-bottom:1px solid var(--line-3); padding-bottom:2px;
  transition:color var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.v404-link:hover{ color:var(--acc); border-color:var(--acc); }

.v404-bloom{
  position:absolute; z-index:0; pointer-events:none;
  top:44%; left:50%; width:min(880px, 122vw); height:min(880px, 122vw);
  transform:translate(-50%,-50%);
  background:radial-gradient(circle, var(--acc-glow) 0%, var(--acc-soft) 36%, transparent 68%);
  animation:v404-breathe 10s var(--ease-out) infinite;
}

.v404-in{ animation:v404-rise .6s var(--ease-out) both; }
.v404-d1{ animation-delay:120ms; }
.v404-d2{ animation-delay:200ms; }
.v404-d3{ animation-delay:280ms; }

@keyframes v404-rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
@keyframes v404-fade{ from{ opacity:0; } to{ opacity:1; } }
@keyframes v404-float{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-10px); } }
@keyframes v404-drift{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-5px); } }
@keyframes v404-breathe{ 0%,100%{ opacity:.45; transform:translate(-50%,-50%) scale(1); } 50%{ opacity:.8; transform:translate(-50%,-50%) scale(1.07); } }

@media (prefers-reduced-motion: reduce){
  .v404-num, .v404-zero, .v404-in, .v404-bloom{ animation:none !important; }
  .v404-in{ opacity:1; transform:none; }
}
`;

"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ── Mini contact lens ─────────────────────────────────────────── */
function MiniLens({ size = 88 }: { size?: number }) {
  const h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <defs>
        <radialGradient id="hic_lensBody" cx="38%" cy="32%" r="62%">
          <stop offset="0%"   stopColor="rgba(190,230,255,0.18)" />
          <stop offset="100%" stopColor="rgba(100,180,255,0.03)" />
        </radialGradient>
        <filter id="hic_blur3" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="hic_blur1" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      <circle cx={h} cy={h} r={h * 0.89} fill="url(#hic_lensBody)" />
      <circle cx={h} cy={h} r={h * 0.89} stroke="rgba(190,235,255,0.34)" strokeWidth="1.2" />
      <path
        d={`M ${h - h*0.76} ${h - h*0.52} A ${h*0.87} ${h*0.87} 0 0 1 ${h + h*0.25} ${h - h*0.84}`}
        stroke="rgba(235,250,255,0.78)" strokeWidth="2.2" strokeLinecap="round"
      />
      <path
        d={`M ${h - h*0.72} ${h - h*0.56} A ${h*0.85} ${h*0.85} 0 0 1 ${h + h*0.20} ${h - h*0.82}`}
        stroke="rgba(200,240,255,0.22)" strokeWidth="4" strokeLinecap="round" filter="url(#hic_blur1)"
      />
      <circle cx={h} cy={h} r={h * 0.50} stroke="rgba(100,205,255,0.22)" strokeWidth="0.7" strokeDasharray="3 6" />
      <circle cx={h} cy={h} r={h * 0.28} stroke="rgba(110,210,255,0.38)" strokeWidth="0.9" />
      <circle cx={h} cy={h} r={h * 0.055} fill="rgba(130,215,255,0.60)" />
      <ellipse
        cx={h - h*0.30} cy={h - h*0.30}
        rx={h * 0.24} ry={h * 0.13}
        fill="rgba(255,255,255,0.22)"
        transform={`rotate(-28, ${h - h*0.30}, ${h - h*0.30})`}
        filter="url(#hic_blur3)"
      />
    </svg>
  );
}

/* ── Phone with mini Workshop UI ──────────────────────────────── */
function PhoneCard() {
  return (
    <div style={{
      width: 118,
      height: 210,
      borderRadius: 20,
      background: "linear-gradient(155deg, #1c1c2e 0%, #111120 100%)",
      border: "1px solid rgba(167,139,250,0.26)",
      overflow: "hidden",
      position: "relative",
      boxShadow: [
        "0 32px 70px rgba(0,0,0,0.85)",
        "0 0 0 0.5px rgba(255,255,255,0.04) inset",
        "0 1px 0 rgba(255,255,255,0.10) inset",
        "0 0 36px rgba(167,139,250,0.10)",
      ].join(","),
    }}>
      {/* Notch */}
      <div style={{ height: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 4, borderRadius: 4, background: "rgba(0,0,0,0.60)", border: "1px solid rgba(255,255,255,0.06)" }} />
      </div>
      {/* Titlebar */}
      <div style={{ height: 22, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 9px", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", gap: 3.5 }}>
          {["rgba(255,88,78,0.35)", "rgba(255,188,48,0.28)", "rgba(55,200,88,0.28)"].map((c, i) => (
            <div key={i} style={{ width: 6.5, height: 6.5, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{ height: 3.5, width: 52, borderRadius: 2, background: "rgba(167,139,250,0.25)" }} />
        <div style={{ width: 8 }} />
      </div>

      {/* Chat area */}
      <div style={{ padding: "8px 7px", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* User bubble */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ padding: "5px 8px", borderRadius: "8px 8px 2px 8px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.22)", maxWidth: "76%", display: "flex", flexDirection: "column", gap: 2.5 }}>
            <div style={{ height: 3.5, width: 54, borderRadius: 2, background: "rgba(167,139,250,0.55)" }} />
            <div style={{ height: 3.5, width: 38, borderRadius: 2, background: "rgba(167,139,250,0.32)" }} />
          </div>
        </div>
        {/* AI reply */}
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(167,139,250,0.22)", border: "1px solid rgba(167,139,250,0.30)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, padding: "5px 7px", borderRadius: "2px 8px 8px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", flexDirection: "column", gap: 2.5 }}>
            <div style={{ height: 3.5, width: "90%", borderRadius: 2, background: "rgba(255,255,255,0.32)" }} />
            <div style={{ height: 3.5, width: "76%", borderRadius: 2, background: "rgba(255,255,255,0.22)" }} />
            <div style={{ height: 3.5, width: "82%", borderRadius: 2, background: "rgba(255,255,255,0.26)" }} />
            <div style={{ height: 3.5, width: "52%", borderRadius: 2, background: "rgba(255,255,255,0.14)" }} />
          </div>
        </div>
        {/* Memory chip */}
        <div style={{ padding: "5px 7px", borderRadius: 7, background: "rgba(100,200,130,0.08)", border: "1px solid rgba(100,200,130,0.18)", display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(100,200,130,0.72)", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <div style={{ height: 3, width: 52, borderRadius: 2, background: "rgba(100,200,130,0.38)" }} />
            <div style={{ height: 3, width: 36, borderRadius: 2, background: "rgba(100,200,130,0.22)" }} />
          </div>
        </div>
        {/* Second user */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ padding: "5px 8px", borderRadius: "8px 8px 2px 8px", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.18)", maxWidth: "65%", display: "flex", flexDirection: "column", gap: 2.5 }}>
            <div style={{ height: 3.5, width: 40, borderRadius: 2, background: "rgba(167,139,250,0.45)" }} />
          </div>
        </div>
        {/* Second AI */}
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: "rgba(167,139,250,0.18)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, padding: "5px 7px", borderRadius: "2px 8px 8px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 2.5 }}>
            <div style={{ height: 3.5, width: "85%", borderRadius: 2, background: "rgba(255,255,255,0.28)" }} />
            <div style={{ height: 3.5, width: "62%", borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 7px 8px", background: "rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "5px 8px", borderRadius: 9, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ flex: 1, height: 3.5, borderRadius: 2, background: "rgba(255,255,255,0.10)" }} />
          <div style={{ width: 15, height: 15, borderRadius: 4, background: "rgba(167,139,250,0.24)", border: "1px solid rgba(167,139,250,0.34)", flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}

/* ── Mini earbuds pair ─────────────────────────────────────────── */
function MiniEarbuds() {
  const bud = (rotate: number, scale: number, opacity: number) => (
    <div style={{ transform: `rotate(${rotate}deg) scale(${scale})`, opacity, transformOrigin: "50% 80%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 32, height: 42,
        borderRadius: "50% 50% 44% 44% / 48% 48% 52% 52%",
        background: "radial-gradient(ellipse at 34% 27%, #2e2e3e 0%, #1c1c28 42%, #101018 100%)",
        position: "relative",
        boxShadow: ["0 10px 28px rgba(0,0,0,0.90)", "inset 0 1.5px 0 rgba(255,255,255,0.12)", "inset 2px 0 0 rgba(255,255,255,0.05)"].join(","),
      }}>
        <div style={{ position: "absolute", top: "9%", left: "17%", width: "32%", height: "23%", background: "radial-gradient(ellipse, rgba(255,255,255,0.24) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(2px)" }} />
        <div style={{ position: "absolute", top: "18%", right: 0, bottom: "18%", width: 2, background: "linear-gradient(to bottom, transparent, rgba(120,195,255,0.36) 38%, rgba(120,195,255,0.20) 68%, transparent)", borderRadius: 1 }} />
        <div style={{ position: "absolute", bottom: "18%", left: "50%", transform: "translateX(-50%)", width: 3.5, height: 3.5, borderRadius: "50%", background: "rgba(140,218,255,0.95)", boxShadow: "0 0 5px rgba(140,218,255,0.80), 0 0 10px rgba(140,218,255,0.35)" }} />
      </div>
      <div style={{ width: 10, height: 28, marginTop: -1, background: "linear-gradient(170deg, #222232 0%, #161622 55%, #111120 100%)", borderRadius: "0 0 6px 6px", boxShadow: "0 6px 18px rgba(0,0,0,0.70), inset 1px 0 0 rgba(255,255,255,0.06)" }} />
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.85))" }}>
      {bud(-8, 1, 1)}
      {bud(10, 0.88, 0.78)}
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────── */
export function HowItConnects() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef      = useRef<HTMLDivElement>(null);
  const phoneRef     = useRef<HTMLDivElement>(null);
  const earRef       = useRef<HTMLDivElement>(null);

  const inView  = useInView(containerRef, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();

  const [svg, setSvg] = useState({ l1: "", l2: "", w: 1, h: 1, ready: false });

  useEffect(() => {
    function measure() {
      if (!containerRef.current || !lensRef.current || !phoneRef.current || !earRef.current) return;
      const cr = containerRef.current.getBoundingClientRect();
      const lr = lensRef.current.getBoundingClientRect();
      const pr = phoneRef.current.getBoundingClientRect();
      const er = earRef.current.getBoundingClientRect();

      const rx = (r: DOMRect, edge: "cx"|"left"|"right") =>
        (edge === "left" ? r.left : edge === "right" ? r.right : (r.left + r.right) / 2) - cr.left;
      const ry = (r: DOMRect) => (r.top + r.bottom) / 2 - cr.top;

      const lx = rx(lr, "right");
      const ly = ry(lr);
      const pxl = rx(pr, "left");
      const pxr = rx(pr, "right");
      const py  = ry(pr);
      const ex  = rx(er, "left");
      const ey  = ry(er);

      const mid1 = (lx + pxl) / 2;
      const mid2 = (pxr + ex) / 2;

      setSvg({
        l1: `M ${lx} ${ly} C ${mid1} ${ly}, ${mid1} ${py}, ${pxl} ${py}`,
        l2: `M ${pxr} ${py} C ${mid2} ${py}, ${mid2} ${ey}, ${ex} ${ey}`,
        w: cr.width,
        h: cr.height,
        ready: true,
      });
    }

    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); };
  }, []);

  const nodeProps = (delay: number) => ({
    initial: { opacity: 0, scale: 0 },
    animate: inView ? { opacity: 1, scale: 1 } : {},
    transition: { delay, duration: 0.28, ease: EASE },
  });

  return (
    <section style={{ background: "#050507" }}>
      <div className="landing-divider" />
      <div className="landing-section" style={{ maxWidth: 900 }}>

        {/* Headline */}
        <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto 52px" }}>
          <div className="landing-kicker">how it connects</div>
          <h2 className="landing-h2 landing-gradient-text">One system. Every surface.</h2>
          <p className="landing-body">
            Workshop on your device. Audio through your ears. Vision in your field.
            One context, one memory, across all of them.
          </p>
        </div>

        {/* Visual */}
        <div
          ref={containerRef}
          style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
        >
          {/* SVG connection-line overlay */}
          {svg.ready && (
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
              viewBox={`0 0 ${svg.w} ${svg.h}`}
            >
              {/* Static dashed path — lens → phone */}
              <motion.path
                d={svg.l1} fill="none" stroke="rgba(100,200,255,0.28)"
                strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 8"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView && !reduced ? { pathLength: 1, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease: "easeOut", delay: 0.42 }}
              />
              {/* Flowing highlight — lens → phone */}
              {inView && !reduced && (
                <motion.path
                  d={svg.l1} fill="none" stroke="rgba(140,215,255,0.52)"
                  strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3.5 44"
                  animate={{ strokeDashoffset: [48, 0] }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: "linear" }}
                />
              )}

              {/* Static dashed path — phone → earbuds */}
              <motion.path
                d={svg.l2} fill="none" stroke="rgba(140,195,255,0.28)"
                strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 8"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView && !reduced ? { pathLength: 1, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease: "easeOut", delay: 0.66 }}
              />
              {/* Flowing highlight — phone → earbuds */}
              {inView && !reduced && (
                <motion.path
                  d={svg.l2} fill="none" stroke="rgba(140,215,255,0.52)"
                  strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3.5 44"
                  animate={{ strokeDashoffset: [48, 0] }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: "linear", delay: 0.45 }}
                />
              )}

              {/* Connection nodes */}
              {(() => {
                const parts = svg.l1.match(/M ([\d.]+) ([\d.]+).*?([\d.]+) ([\d.]+)$/);
                const parts2 = svg.l2.match(/M ([\d.]+) ([\d.]+).*?([\d.]+) ([\d.]+)$/);
                const lx = parts  ? +parts[1]  : 0; const ly = parts  ? +parts[2]  : 0;
                const pxl = parts  ? +parts[3]  : 0; const py1 = parts  ? +parts[4]  : 0;
                const pxr = parts2 ? +parts2[1] : 0; const py2 = parts2 ? +parts2[2] : 0;
                const ex  = parts2 ? +parts2[3] : 0; const ey  = parts2 ? +parts2[4] : 0;
                return (
                  <>
                    <motion.circle cx={lx}  cy={ly}  r="3" fill="rgba(100,200,255,0.55)" {...nodeProps(0.42)} />
                    <motion.circle cx={pxl} cy={py1} r="3" fill="rgba(167,139,250,0.55)" {...nodeProps(0.58)} />
                    <motion.circle cx={pxr} cy={py2} r="3" fill="rgba(167,139,250,0.55)" {...nodeProps(0.72)} />
                    <motion.circle cx={ex}  cy={ey}  r="3" fill="rgba(140,195,255,0.55)" {...nodeProps(0.88)} />
                  </>
                );
              })()}
            </svg>
          )}

          {/* ── LENS column ── */}
          <motion.div
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: 0 }}
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, ease: EASE, delay: 0.08 }}
          >
            <div
              ref={lensRef}
              style={{ filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.90)) drop-shadow(0 0 14px rgba(140,215,255,0.12))" }}
            >
              <MiniLens size={88} />
            </div>
            <div style={{ marginTop: 12, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(140,215,255,0.78)", fontFamily: "var(--font-geist-mono), monospace" }}>
              Sees
            </div>
            <div style={{ marginTop: 5, fontSize: 11, color: "#3a3a44", lineHeight: 1.5, maxWidth: 120 }}>
              Augmented visual layer
            </div>
            <div style={{ marginTop: 8, padding: "2px 8px", borderRadius: 100, border: "1px solid rgba(100,180,255,0.15)", background: "rgba(100,180,255,0.05)", fontSize: 9, color: "rgba(100,180,255,0.52)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.10em" }}>
              coming soon
            </div>
          </motion.div>

          {/* ── PHONE / WORKSHOP column ── */}
          <motion.div
            style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, ease: EASE, delay: 0.20 }}
          >
            <div ref={phoneRef}>
              <PhoneCard />
            </div>
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
              {[
                { label: "Thinks",    bg: "rgba(167,139,250,0.10)", bd: "rgba(167,139,250,0.20)", tx: "rgba(167,139,250,0.78)" },
                { label: "Remembers", bg: "rgba(100,200,130,0.08)", bd: "rgba(100,200,130,0.16)", tx: "rgba(100,200,130,0.72)" },
                { label: "Continues", bg: "rgba(168,196,255,0.07)", bd: "rgba(168,196,255,0.15)", tx: "rgba(168,196,255,0.66)" },
              ].map(({ label, bg, bd, tx }) => (
                <span key={label} style={{ padding: "3px 8px", borderRadius: 100, background: bg, border: `1px solid ${bd}`, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: tx, fontFamily: "var(--font-geist-mono), monospace" }}>
                  {label}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#3a3a44" }}>Workshop — the AI core</div>
          </motion.div>

          {/* ── EARBUDS column ── */}
          <motion.div
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: 0 }}
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, ease: EASE, delay: 0.34 }}
          >
            <div ref={earRef} style={{ paddingTop: 14 }}>
              <MiniEarbuds />
            </div>
            <div style={{ marginTop: 12, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(140,195,255,0.78)", fontFamily: "var(--font-geist-mono), monospace" }}>
              Hears
            </div>
            <div style={{ marginTop: 5, fontSize: 11, color: "#3a3a44", lineHeight: 1.5, maxWidth: 120 }}>
              Voice in · private audio out
            </div>
          </motion.div>

        </div>

        {/* Bottom summary */}
        <div style={{ marginTop: 52, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.75, maxWidth: 480, margin: "0 auto" }}>
            Workshop is the brain. Audio is the voice. Lens is the eye.{" "}
            <span style={{ color: "#52525b" }}>One context. One memory. Any surface.</span>
          </p>
        </div>

      </div>
    </section>
  );
}

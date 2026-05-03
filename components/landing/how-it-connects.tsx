"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ── Mini contact lens ───────────────────────────────────────── */
function MiniLens({ size = 76 }: { size?: number }) {
  const h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <defs>
        <radialGradient id="hicL_body" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(140,210,255,0.00)" />
          <stop offset="60%"  stopColor="rgba(130,200,255,0.06)" />
          <stop offset="85%"  stopColor="rgba(120,195,255,0.16)" />
          <stop offset="100%" stopColor="rgba(100,180,255,0.28)" />
        </radialGradient>
        <radialGradient id="hicL_dome" cx="34%" cy="28%" r="44%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.32)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="hicL_b4" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <filter id="hicL_b1" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      <circle cx={h} cy={h} r={h * 0.90} fill="url(#hicL_body)" />
      <circle cx={h} cy={h} r={h * 0.90} fill="url(#hicL_dome)" />
      <circle cx={h} cy={h} r={h * 0.90} stroke="rgba(200,240,255,0.46)" strokeWidth="1.4" />
      <path
        d={`M ${h - h*0.80} ${h - h*0.47} A ${h*0.88} ${h*0.88} 0 0 1 ${h + h*0.26} ${h - h*0.83}`}
        stroke="rgba(248,254,255,0.92)" strokeWidth="2.8" strokeLinecap="round"
      />
      <path
        d={`M ${h - h*0.76} ${h - h*0.52} A ${h*0.86} ${h*0.86} 0 0 1 ${h + h*0.22} ${h - h*0.82}`}
        stroke="rgba(190,242,255,0.30)" strokeWidth="8" strokeLinecap="round" filter="url(#hicL_b4)"
      />
      <ellipse cx={h - h*0.28} cy={h - h*0.30} rx={h*0.28} ry={h*0.15}
        fill="rgba(255,255,255,0.38)" transform={`rotate(-30, ${h - h*0.28}, ${h - h*0.30})`}
        filter="url(#hicL_b4)" />
      <ellipse cx={h - h*0.32} cy={h - h*0.33} rx={h*0.10} ry={h*0.06}
        fill="rgba(255,255,255,0.64)" transform={`rotate(-30, ${h - h*0.32}, ${h - h*0.33})`}
        filter="url(#hicL_b1)" />
      <circle cx={h} cy={h} r={h*0.53} stroke="rgba(100,200,255,0.18)" strokeWidth="0.8" strokeDasharray="3.5 7" />
      <circle cx={h} cy={h} r={h*0.30} stroke="rgba(110,210,255,0.28)" strokeWidth="0.8" />
      <circle cx={h} cy={h} r={h*0.065} fill="rgba(160,225,255,0.70)" />
    </svg>
  );
}

/* ── Phone / mobile card ─────────────────────────────────────── */
function PhoneCard() {
  return (
    <div style={{
      width: 90, height: 156,
      borderRadius: 15,
      background: "linear-gradient(155deg, #1c1c2e 0%, #111120 100%)",
      border: "1px solid rgba(167,139,250,0.26)",
      overflow: "hidden", position: "relative", flexShrink: 0,
      boxShadow: [
        "0 22px 52px rgba(0,0,0,0.90)",
        "0 0 0 0.5px rgba(255,255,255,0.03) inset",
        "0 1px 0 rgba(255,255,255,0.09) inset",
        "0 0 26px rgba(167,139,250,0.08)",
      ].join(","),
    }}>
      <div style={{ height: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 22, height: 3.5, borderRadius: 4, background: "rgba(0,0,0,0.60)" }} />
      </div>
      <div style={{ height: 17, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 7px", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", gap: 2.5 }}>
          {["rgba(255,88,78,0.35)", "rgba(255,188,48,0.28)", "rgba(55,200,88,0.28)"].map((c, i) => (
            <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{ height: 2.5, width: 36, borderRadius: 2, background: "rgba(167,139,250,0.24)" }} />
        <div style={{ width: 5 }} />
      </div>
      <div style={{ padding: "5px 5px", display: "flex", flexDirection: "column", gap: 4.5 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ padding: "3.5px 5px", borderRadius: "5px 5px 2px 5px", background: "rgba(167,139,250,0.14)", border: "1px solid rgba(167,139,250,0.20)", display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ height: 2.5, width: 38, borderRadius: 2, background: "rgba(167,139,250,0.55)" }} />
            <div style={{ height: 2.5, width: 26, borderRadius: 2, background: "rgba(167,139,250,0.32)" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 3.5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "rgba(167,139,250,0.22)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, padding: "3.5px 4.5px", borderRadius: "2px 5px 5px 5px", background: "rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ height: 2, width: "90%", borderRadius: 2, background: "rgba(255,255,255,0.28)" }} />
            <div style={{ height: 2, width: "72%", borderRadius: 2, background: "rgba(255,255,255,0.20)" }} />
            <div style={{ height: 2, width: "80%", borderRadius: 2, background: "rgba(255,255,255,0.24)" }} />
          </div>
        </div>
        <div style={{ padding: "3.5px 4.5px", borderRadius: 5, background: "rgba(100,200,130,0.07)", border: "1px solid rgba(100,200,130,0.16)", display: "flex", gap: 3.5, alignItems: "center" }}>
          <div style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: "rgba(100,200,130,0.72)", flexShrink: 0 }} />
          <div style={{ height: 2, flex: 1, borderRadius: 2, background: "rgba(100,200,130,0.30)" }} />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 5px 5px", background: "rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "3.5px 5px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", gap: 3.5 }}>
          <div style={{ flex: 1, height: 2, borderRadius: 2, background: "rgba(255,255,255,0.10)" }} />
          <div style={{ width: 10, height: 10, borderRadius: 2.5, background: "rgba(167,139,250,0.24)", border: "1px solid rgba(167,139,250,0.30)", flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}

/* ── PC / Desktop card ───────────────────────────────────────── */
function PCCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{
        width: 162, height: 102,
        borderRadius: "8px 8px 0 0",
        background: "linear-gradient(160deg, #181828 0%, #0e0e1c 100%)",
        border: "1px solid rgba(168,196,255,0.20)",
        borderBottom: "none",
        overflow: "hidden", position: "relative",
        boxShadow: [
          "0 18px 52px rgba(0,0,0,0.90)",
          "0 0 0 0.5px rgba(255,255,255,0.03) inset",
          "0 0 22px rgba(168,196,255,0.06)",
        ].join(","),
      }}>
        <div style={{ height: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 7px", background: "rgba(255,255,255,0.025)" }}>
          <div style={{ display: "flex", gap: 2.5 }}>
            {["rgba(255,88,78,0.30)", "rgba(255,188,48,0.24)", "rgba(55,200,88,0.24)"].map((c, i) => (
              <div key={i} style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, height: 2, margin: "0 6px", borderRadius: 2, background: "rgba(168,196,255,0.18)" }} />
        </div>
        <div style={{ display: "flex", height: "calc(100% - 16px)" }}>
          <div style={{ width: 26, borderRight: "1px solid rgba(255,255,255,0.05)", padding: "4px 3px", display: "flex", flexDirection: "column", gap: 3.5, flexShrink: 0 }}>
            {[0.30, 0.22, 0.17, 0.13, 0.09].map((op, i) => (
              <div key={i} style={{ height: 4, borderRadius: 2, background: `rgba(168,196,255,${op})` }} />
            ))}
          </div>
          <div style={{ flex: 1, padding: "4px 5px", display: "flex", flexDirection: "column", gap: 3.5 }}>
            <div style={{ height: 2.5, width: "82%", borderRadius: 2, background: "rgba(255,255,255,0.24)" }} />
            <div style={{ height: 2.5, width: "66%", borderRadius: 2, background: "rgba(255,255,255,0.16)" }} />
            <div style={{ height: 9, borderRadius: 3, background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.14)", marginTop: 1, display: "flex", alignItems: "center", padding: "0 4px", gap: 3 }}>
              <div style={{ flex: 1, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.14)" }} />
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(167,139,250,0.28)", border: "1px solid rgba(167,139,250,0.32)", flexShrink: 0 }} />
            </div>
            <div style={{ height: 2.5, width: "90%", borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
            <div style={{ height: 2.5, width: "44%", borderRadius: 2, background: "rgba(255,255,255,0.10)" }} />
          </div>
        </div>
      </div>
      <div style={{ height: 4, background: "linear-gradient(to bottom, #1c1c2e, #141422)", border: "1px solid rgba(168,196,255,0.13)", borderTop: "none" }} />
      <div style={{ height: 12, borderRadius: "0 0 5px 5px", background: "linear-gradient(to bottom, #171727, #111120)", border: "1px solid rgba(168,196,255,0.10)", borderTop: "1px solid rgba(168,196,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "58%", height: 2.5, borderRadius: 2, background: "rgba(168,196,255,0.08)" }} />
      </div>
    </div>
  );
}

/* ── Mini earbuds pair ───────────────────────────────────────── */
function MiniEarbuds() {
  const bud = (rotate: number, scale: number, opacity: number) => (
    <div style={{ transform: `rotate(${rotate}deg) scale(${scale})`, opacity, transformOrigin: "50% 80%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 28, height: 36,
        borderRadius: "50% 50% 44% 44% / 48% 48% 52% 52%",
        background: "radial-gradient(ellipse at 32% 26%, #2e2e3e 0%, #1c1c28 42%, #101018 100%)",
        position: "relative",
        boxShadow: ["0 10px 28px rgba(0,0,0,0.90)", "inset 0 1.5px 0 rgba(255,255,255,0.12)", "inset 2px 0 0 rgba(255,255,255,0.05)"].join(","),
      }}>
        <div style={{ position: "absolute", top: "8%", left: "14%", width: "30%", height: "22%", background: "radial-gradient(ellipse, rgba(255,255,255,0.26) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(1.5px)" }} />
        <div style={{ position: "absolute", top: "16%", right: 0, bottom: "16%", width: 1.5, background: "linear-gradient(to bottom, transparent, rgba(120,195,255,0.36) 38%, rgba(120,195,255,0.20) 68%, transparent)", borderRadius: 1 }} />
        <div style={{ position: "absolute", bottom: "17%", left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "rgba(140,218,255,0.95)", boxShadow: "0 0 4px rgba(140,218,255,0.80), 0 0 8px rgba(140,218,255,0.35)" }} />
      </div>
      <div style={{ width: 8, height: 22, marginTop: -1, background: "linear-gradient(170deg, #222232 0%, #161622 55%, #111120 100%)", borderRadius: "0 0 5px 5px", boxShadow: "0 6px 18px rgba(0,0,0,0.70), inset 1px 0 0 rgba(255,255,255,0.06)" }} />
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.85))" }}>
      {bud(-8, 1, 1)}
      {bud(10, 0.88, 0.78)}
    </div>
  );
}

/* ── Hub core ────────────────────────────────────────────────── */
function HubCore() {
  return (
    <div style={{
      width: 106, height: 106, borderRadius: "50%",
      background: "radial-gradient(circle at 40% 36%, rgba(167,139,250,0.14) 0%, rgba(120,100,220,0.04) 55%, transparent 80%)",
      border: "1px solid rgba(167,139,250,0.30)",
      boxShadow: [
        "0 0 0 8px rgba(167,139,250,0.04)",
        "0 0 0 16px rgba(167,139,250,0.02)",
        "0 18px 48px rgba(0,0,0,0.85)",
        "0 0 32px rgba(167,139,250,0.09)",
      ].join(","),
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", gap: 3,
    }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "rgba(167,139,250,0.85)" }}>◈</div>
      <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 7.5, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(167,139,250,0.85)", textTransform: "uppercase" }}>Workshop</div>
      <div style={{ width: 20, height: 0.5, background: "rgba(167,139,250,0.25)" }} />
      <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 7.5, letterSpacing: "0.12em", color: "rgba(167,139,250,0.48)", textTransform: "uppercase" }}>Memory</div>
    </div>
  );
}

/* ── Path state ──────────────────────────────────────────────── */
interface PathState {
  lens: string; phone: string; pc: string; audio: string;
  w: number; h: number; ready: boolean;
}

/* ── Main export ─────────────────────────────────────────────── */
export function HowItConnects() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef       = useRef<HTMLDivElement>(null);
  const lensRef      = useRef<HTMLDivElement>(null);
  const phoneRef     = useRef<HTMLDivElement>(null);
  const pcRef        = useRef<HTMLDivElement>(null);
  const audioRef     = useRef<HTMLDivElement>(null);

  const inView  = useInView(containerRef, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  const [ps, setPs] = useState<PathState>({ lens: "", phone: "", pc: "", audio: "", w: 1, h: 1, ready: false });

  useEffect(() => {
    function measure() {
      if (!containerRef.current || !hubRef.current || !lensRef.current ||
          !phoneRef.current || !pcRef.current || !audioRef.current) return;
      const cr = containerRef.current.getBoundingClientRect();
      const cx = (r: DOMRect) => ({ x: (r.left + r.right) / 2 - cr.left, y: (r.top + r.bottom) / 2 - cr.top });
      const hub   = cx(hubRef.current.getBoundingClientRect());
      const lens  = cx(lensRef.current.getBoundingClientRect());
      const phone = cx(phoneRef.current.getBoundingClientRect());
      const pc    = cx(pcRef.current.getBoundingClientRect());
      const audio = cx(audioRef.current.getBoundingClientRect());
      const L = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      setPs({ lens: L(lens, hub), phone: L(phone, hub), pc: L(pc, hub), audio: L(audio, hub), w: cr.width, h: cr.height, ready: true });
    }
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", measure); };
  }, []);

  const fadeIn = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 },
    transition: { duration: 0.65, ease: EASE, delay },
  });

  function Line({ path, stroke, flow, drawDelay, flowDelay }: {
    path: string; stroke: string; flow: string; drawDelay: number; flowDelay: number;
  }) {
    return (
      <>
        <motion.path d={path} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" strokeDasharray="3.5 8"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView && !reduced ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.75, ease: "easeOut", delay: drawDelay }}
        />
        {inView && !reduced && (
          <motion.path d={path} fill="none" stroke={flow} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 52"
            animate={{ strokeDashoffset: [56, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear", delay: flowDelay }}
          />
        )}
      </>
    );
  }

  const nodeLabel = (label: string, sub: string, color: string) => (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color, fontFamily: "var(--font-geist-mono), monospace" }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 10, color: "#3a3a44" }}>{sub}</div>
    </div>
  );

  return (
    <section style={{ background: "#050507" }}>
      <div className="landing-divider" />
      <div className="landing-section" style={{ maxWidth: 860 }}>

        {/* Headline */}
        <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto 56px" }}>
          <div className="landing-kicker">how it connects</div>
          <h2 className="landing-h2 landing-gradient-text">One system. Every surface.</h2>
          <p className="landing-body">
            Not a sequence — one connected system. Workshop is the brain. Memory follows everywhere.
            Every surface shares the same context.
          </p>
        </div>

        {/* Hub diagram */}
        <div ref={containerRef} style={{ position: "relative" }}>

          {/* SVG connection lines */}
          {ps.ready && (
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
              viewBox={`0 0 ${ps.w} ${ps.h}`}>
              <Line path={ps.lens}  stroke="rgba(100,200,255,0.24)" flow="rgba(140,215,255,0.50)" drawDelay={0.32} flowDelay={0.00} />
              <Line path={ps.phone} stroke="rgba(167,139,250,0.24)" flow="rgba(190,170,255,0.50)" drawDelay={0.46} flowDelay={0.60} />
              <Line path={ps.pc}    stroke="rgba(168,196,255,0.24)" flow="rgba(190,215,255,0.50)" drawDelay={0.46} flowDelay={1.20} />
              <Line path={ps.audio} stroke="rgba(100,180,255,0.24)" flow="rgba(130,200,255,0.50)" drawDelay={0.32} flowDelay={1.80} />
            </svg>
          )}

          {/* Cross grid — 5 nodes with grid-area names, no empty spacers needed */}
          <div className="hic-grid" style={{
            display: "grid",
            gridTemplateAreas: `". lens ." "phone hub pc" ". audio ."`,
            gridTemplateColumns: "1fr auto 1fr",
            gridTemplateRows: "auto auto auto",
            gap: "32px 20px",
            alignItems: "center",
            justifyItems: "center",
          }}>

            {/* Lens — top center */}
            <motion.div {...fadeIn(0.10)} style={{ gridArea: "lens", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div ref={lensRef} style={{ filter: "drop-shadow(0 8px 22px rgba(0,0,0,0.90)) drop-shadow(0 0 10px rgba(140,215,255,0.10))" }}>
                <MiniLens size={76} />
              </div>
              {nodeLabel("Sees", "Augmented visual", "rgba(140,215,255,0.80)")}
              <div style={{ display: "inline-block", padding: "1.5px 6px", borderRadius: 100, border: "1px solid rgba(100,180,255,0.14)", background: "rgba(100,180,255,0.05)", fontSize: 8, color: "rgba(100,180,255,0.52)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.10em" }}>coming soon</div>
            </motion.div>

            {/* Phone — middle left */}
            <motion.div {...fadeIn(0.22)} style={{ gridArea: "phone", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div ref={phoneRef}><PhoneCard /></div>
              {nodeLabel("Phone", "Mobile · Syncs", "rgba(167,139,250,0.80)")}
            </motion.div>

            {/* Hub — center */}
            <motion.div style={{ gridArea: "hub" }}
              initial={{ opacity: 0, scale: 0.80 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.55, ease: EASE, delay: 0.16 }}
            >
              <div ref={hubRef}><HubCore /></div>
            </motion.div>

            {/* PC — middle right */}
            <motion.div {...fadeIn(0.22)} style={{ gridArea: "pc", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div ref={pcRef}><PCCard /></div>
              {nodeLabel("Desktop", "Full workspace", "rgba(168,196,255,0.80)")}
            </motion.div>

            {/* Audio — bottom center */}
            <motion.div {...fadeIn(0.10)} style={{ gridArea: "audio", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div ref={audioRef}><MiniEarbuds /></div>
              {nodeLabel("Hears · Speaks", "Whisper — voice layer", "rgba(100,200,255,0.80)")}
            </motion.div>

          </div>
        </div>

        {/* Audio compatibility callout */}
        <div style={{ marginTop: 48, padding: "16px 20px", borderRadius: 12, border: "1px solid rgba(100,180,255,0.10)", background: "rgba(100,180,255,0.03)", maxWidth: 640, margin: "48px auto 0" }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.48)", lineHeight: 1.75, margin: 0 }}>
            <span style={{ fontWeight: 600, color: "rgba(140,210,255,0.75)" }}>Whisper works with your existing audio gear.</span>{" "}
            AirPods, AirPods Pro, Galaxy Buds, Beats Fit Pro, Sony WF-1000XM, Bose QuietComfort, and most Bluetooth headphones or headsets with a microphone. No first-party hardware required.
          </p>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 44, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.75, maxWidth: 480, margin: "0 auto" }}>
            Workshop is the brain. Audio is the voice. Lens is the eye.{" "}
            <span style={{ color: "#52525b" }}>One context. One memory. Every surface.</span>
          </p>
        </div>

      </div>

      {/* Mobile: reflow to hub-top + 2×2 devices below */}
      <style>{`
        @media (max-width: 600px) {
          .hic-grid {
            grid-template-areas: "hub hub hub" "lens audio audio" "phone pc pc" !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            gap: 24px 12px !important;
          }
        }
        @media (max-width: 440px) {
          .hic-grid {
            grid-template-areas: "hub" "lens" "audio" "phone" "pc" !important;
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </section>
  );
}

import type { Metadata } from "next";
import { Glasses3D } from "@/components/glasses/glasses-3d";

export const metadata: Metadata = { title: "Home" };

// ── design tokens (glasses site palette) ─────────────────────────────
const T = {
  bg0:   "#0A0F18",
  bg1:   "#0E1421",
  bg2:   "#060A12",
  bg3:   "#141B2B",
  fg1:   "#ECEFF4",
  fg2:   "#C7CDD7",
  fg3:   "#8B95A6",
  fg4:   "#5A6478",
  fg5:   "#3D4659",
  acc:   "#5CE5D5",
  line1: "rgba(199,205,215,0.06)",
  line2: "rgba(199,205,215,0.10)",
  line3: "rgba(199,205,215,0.18)",
  lineS: "rgba(199,205,215,0.32)",
  err:   "#FF6470",
  mono:  "JetBrains Mono, ui-monospace, monospace",
  sans:  "Inter Tight, -apple-system, sans-serif",
  serif: "Instrument Serif, Georgia, serif",
};

// ── spec data ─────────────────────────────────────────────────────────
const SPEC_GROUPS = [
  {
    group: "Capture",
    rows: [
      ["Array",          "8 × micro-camera"],
      ["Coverage",       "360° horizontal"],
      ["Resolution",     "4K per stream · stitched"],
      ["Frame rate",     "30 / 60 fps · auto"],
      ["Local storage",  "256 GB · streams to phone"],
    ],
  },
  {
    group: "Audio",
    rows: [
      ["Output",            "Near-field bone-conducted stereo"],
      ["Audibility",        "Inaudible to bystanders @ 30 cm"],
      ["Microphone array",  "4 × beamformed MEMS"],
      ["Whisper threshold", "26 dB SPL"],
      ["Latency",           "< 20 ms"],
    ],
  },
  {
    group: "Display",
    rows: [
      ["Type",          "Transparent waveguide"],
      ["Field of view", "28° diagonal"],
      ["Brightness",    "3,500 nits peak"],
      ["Refresh",       "90 Hz"],
      ["Eye relief",    "12 mm"],
    ],
  },
  {
    group: "Power · build",
    rows: [
      ["Battery active",  "6 hours full use"],
      ["Battery ambient", "14 hours indicator-only"],
      ["Charging",        "Case-based · USB-C · Qi"],
      ["Weight",          "42 g"],
      ["Frame",           "7075 aluminum · medical acetate"],
    ],
  },
];

// ── corner bracket SVG ────────────────────────────────────────────────
function CornerBrackets() {
  const c = T.lineS; const len = 18, off = 8, sw = 1;
  return (
    <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none">
      <line x1={off} y1={off} x2={off + len} y2={off} stroke={c} strokeWidth={sw} />
      <line x1={off} y1={off} x2={off} y2={off + len} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off + len}px)`} y1={off} x2={`calc(100% - ${off}px)`} y2={off} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off}px)`} y1={off} x2={`calc(100% - ${off}px)`} y2={off + len} stroke={c} strokeWidth={sw} />
      <line x1={off} y1={`calc(100% - ${off}px)`} x2={off + len} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
      <line x1={off} y1={`calc(100% - ${off + len}px)`} x2={off} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off + len}px)`} y1={`calc(100% - ${off}px)`} x2={`calc(100% - ${off}px)`} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off}px)`} y1={`calc(100% - ${off + len}px)`} x2={`calc(100% - ${off}px)`} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
    </svg>
  );
}

// ── feature diagrams ──────────────────────────────────────────────────
function RecordDiagram() {
  const cx = 200, cy = 160, r = 90;
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="8-camera 360° ring">
      <line x1="20" y1={cy} x2="380" y2={cy} stroke={T.line1} strokeWidth="1" strokeDasharray="2 4" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.fg3} strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke={T.line2} strokeWidth="1" strokeDasharray="2 3" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        return (
          <g key={i}>
            <path d={`M ${x} ${y} L ${x + Math.cos(a - 0.45) * 90} ${y + Math.sin(a - 0.45) * 90} L ${x + Math.cos(a + 0.45) * 90} ${y + Math.sin(a + 0.45) * 90} Z`} fill={T.acc} fillOpacity="0.07" />
            <circle cx={x} cy={y} r="4.5" fill={T.bg0} stroke={T.acc} strokeWidth="1.5" />
            <text x={x + Math.cos(a) * 14} y={y + Math.sin(a) * 14 + 4} fontFamily={T.mono} fontSize="9" fill={T.fg4} letterSpacing="0.05em" textAnchor="middle">{String(i + 1).padStart(2, "0")}</text>
          </g>
        );
      })}
      <text x={cx} y={cy + 4} fontFamily={T.mono} fontSize="11" fill={T.fg1} textAnchor="middle">360°</text>
      <text x="200" y="296" fontFamily={T.mono} fontSize="10" fill={T.fg4} textAnchor="middle" letterSpacing="0.05em">8 × MICRO CAMERA · STITCHED 4K</text>
    </svg>
  );
}

function ListenDiagram() {
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="Near-field audio zero leakage">
      <path d="M 80 130 Q 100 110 130 120 Q 145 135 140 165 Q 130 195 105 200 Q 85 198 75 175 Z" fill="none" stroke={T.fg2} strokeWidth="1.3" />
      <text x="100" y="232" fontFamily={T.mono} fontSize="10" fill={T.fg3} letterSpacing="0.04em">WEARER</text>
      {[1,2,3,4].map((i) => (
        <path key={i} d={`M 75 160 Q ${65-i*8} 160 ${55-i*12} ${135+i*5}`} fill="none" stroke={T.acc} strokeWidth="1.1" opacity={1-i*0.18} />
      ))}
      {[1,2,3,4].map((i) => (
        <path key={`a${i}`} d={`M 75 160 Q ${65-i*8} 160 ${55-i*12} ${185-i*5}`} fill="none" stroke={T.acc} strokeWidth="1.1" opacity={1-i*0.18} />
      ))}
      <ellipse cx="290" cy="120" rx="22" ry="26" fill="none" stroke={T.fg3} strokeWidth="1.1" />
      <path d="M 268 144 L 268 220 L 312 220 L 312 144 Z" fill="none" stroke={T.fg3} strokeWidth="1.1" />
      <text x="290" y="248" fontFamily={T.mono} fontSize="10" fill={T.fg4} letterSpacing="0.04em" textAnchor="middle">BYSTANDER</text>
      <text x="290" y="262" fontFamily={T.mono} fontSize="13" fill={T.fg1} textAnchor="middle">0 dB</text>
      <line x1="155" y1="160" x2="262" y2="160" stroke={T.fg5} strokeWidth="0.8" strokeDasharray="3 3" />
      <text x="208" y="153" fontFamily={T.mono} fontSize="10" fill={T.fg4} letterSpacing="0.04em" textAnchor="middle">~30 cm</text>
      <text x="200" y="298" fontFamily={T.mono} fontSize="10" fill={T.fg4} textAnchor="middle" letterSpacing="0.05em">BONE-CONDUCTED · ZERO LEAKAGE @ 30 cm</text>
    </svg>
  );
}

function SpeakDiagram() {
  const wave = [12,22,8,30,18,26,14,24,10,20,14,28,16,22,12,26,18,20,10,24,14,22,16,18,12,20,14,22,18,16,12,20];
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="Whisper recognition waveform">
      <line x1="30" y1="120" x2="370" y2="120" stroke={T.line2} strokeWidth="1" />
      <text x="30" y="60" fontFamily={T.mono} fontSize="10" letterSpacing="0.04em" fill={T.fg3}>WEARER · accepted</text>
      {wave.map((v, i) => <line key={`w${i}`} x1={30+i*10.5} y1={120-v} x2={30+i*10.5} y2={120+v} stroke={T.acc} strokeWidth="2" strokeLinecap="round" />)}
      <text x="30" y="220" fontFamily={T.mono} fontSize="10" letterSpacing="0.04em" fill={T.fg4}>ROOM · rejected</text>
      <line x1="30" y1="270" x2="370" y2="270" stroke={T.line2} strokeWidth="1" />
      {wave.map((v, i) => <line key={`r${i}`} x1={30+i*10.5} y1={270-Math.max(4,v*0.7)} x2={30+i*10.5} y2={270+Math.max(4,v*0.7)} stroke={T.fg4} strokeWidth="2" strokeLinecap="round" opacity="0.55" />)}
      <line x1="30" y1="240" x2="370" y2="300" stroke={T.err} strokeWidth="1" opacity="0.5" />
      <text x="200" y="298" fontFamily={T.mono} fontSize="10" fill={T.fg4} textAnchor="middle" letterSpacing="0.05em">VOICEPRINT-LOCKED · 26 dB SPL THRESHOLD</text>
    </svg>
  );
}

function SeeDiagram() {
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="Waveguide HUD field of view">
      <line x1="30" y1="160" x2="370" y2="160" stroke={T.line1} strokeWidth="1" strokeDasharray="2 4" />
      <ellipse cx="120" cy="160" rx="42" ry="32" fill="none" stroke={T.fg2} strokeWidth="1.4" />
      <circle cx="120" cy="160" r="14" fill={T.bg0} stroke={T.fg1} strokeWidth="1.2" />
      <circle cx="120" cy="160" r="5" fill={T.fg1} />
      <text x="120" y="216" fontFamily={T.mono} fontSize="10" textAnchor="middle" fill={T.fg3} letterSpacing="0.04em">EYE</text>
      <rect x="172" y="118" width="34" height="84" fill="none" stroke={T.acc} strokeWidth="1.4" />
      {[178,184,190,196].map((x) => <line key={x} x1={x} y1="124" x2="200" y2="196" stroke={T.acc} strokeWidth="0.6" />)}
      <text x="189" y="216" fontFamily={T.mono} fontSize="10" textAnchor="middle" fill={T.fg3} letterSpacing="0.04em">GUIDE</text>
      <path d="M 206 160 L 370 100 L 370 220 Z" fill={T.acc} fillOpacity="0.06" stroke={T.acc} strokeWidth="0.8" opacity="0.7" />
      <rect x="280" y="120" width="78" height="14" fill="none" stroke={T.acc} strokeWidth="0.8" />
      <text x="284" y="131" fontFamily={T.mono} fontSize="9" fill={T.acc} letterSpacing="0.05em">› GATE C12 · 4 MIN</text>
      <rect x="280" y="142" width="60" height="12" fill="none" stroke={T.acc} strokeWidth="0.8" opacity="0.7" />
      <text x="284" y="151" fontFamily={T.mono} fontSize="9" fill={T.acc} letterSpacing="0.05em" opacity="0.7">› 12:42 UTC</text>
      <rect x="280" y="180" width="68" height="20" fill="none" stroke={T.acc} strokeWidth="0.8" opacity="0.85" />
      <text x="284" y="195" fontFamily={T.mono} fontSize="9" fill={T.acc} letterSpacing="0.05em">CAPTION · LIVE</text>
      <text x="370" y="92" fontFamily={T.mono} fontSize="10" textAnchor="end" fill={T.fg4} letterSpacing="0.04em">28° DIAG</text>
      <text x="200" y="300" fontFamily={T.mono} fontSize="10" fill={T.fg4} textAnchor="middle" letterSpacing="0.05em">TRANSPARENT WAVEGUIDE · 3,500 NITS</text>
    </svg>
  );
}

// ── feature row ───────────────────────────────────────────────────────
function FeatureRow({
  index, label, headline, body, specs, diagram, reverse = false,
}: {
  index: number;
  label: string;
  headline: React.ReactNode;
  body: string;
  specs: { label: string; value: string }[];
  diagram: React.ReactNode;
  reverse?: boolean;
}) {
  const gutter = "clamp(20px,4vw,64px)";
  return (
    <section style={{ padding: `clamp(80px,11vw,144px) ${gutter}`, borderBottom: `1px solid ${T.line1}` }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: "clamp(40px,6vw,88px)", alignItems: "center" }} className={`vra-feature-grid${reverse ? " vra-feature-reverse" : ""}`}>
        <div style={{ order: reverse ? 2 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <span style={{ fontFamily: T.mono, fontSize: 28, color: T.fg1, opacity: 0.3, fontWeight: 500 }}>{String(index).padStart(2,"0")}</span>
            <span style={{ width: 32, height: 1, background: T.lineS }} />
            <span style={{ fontFamily: T.mono, fontSize: 13, color: T.fg3, letterSpacing: "0.04em" }}>{label.toLowerCase()}</span>
          </div>
          <h2 style={{ fontFamily: T.sans, fontSize: "clamp(1.875rem,3.4vw,3rem)", fontWeight: 500, color: T.fg1, letterSpacing: "-0.03em", lineHeight: 1.06, marginBottom: 28 }}>{headline}</h2>
          <p style={{ fontSize: "1.0625rem", color: T.fg2, marginBottom: 32, maxWidth: 520, lineHeight: 1.5 }}>{body}</p>
          <div style={{ borderTop: `1px solid ${T.lineS}`, maxWidth: 480 }}>
            {specs.map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr", padding: "14px 0", borderBottom: i === specs.length - 1 ? `1px solid ${T.lineS}` : `1px solid ${T.line1}`, alignItems: "baseline" }}>
                <div style={{ fontFamily: T.mono, color: T.fg4, fontSize: 12 }}>{s.label}</div>
                <div style={{ color: T.fg1, fontSize: 14 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ order: reverse ? 1 : 2 }}>
          <div style={{ position: "relative", aspectRatio: "4/3", background: T.bg1, border: `1px solid ${T.line2}`, overflow: "hidden" }}>
            <CornerBrackets />
            <div style={{ position: "absolute", top: 14, left: 14, fontFamily: T.mono, fontSize: 11, letterSpacing: "0.05em", color: T.fg3 }}>
              {String(index).padStart(2,"0")} · {label}
            </div>
            <div style={{ position: "absolute", inset: 0, padding: 32, display: "grid", placeItems: "center" }}>
              {diagram}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── page ──────────────────────────────────────────────────────────────
export default function HomePage() {
  const gutter = "clamp(20px,4vw,64px)";

  return (
    <div style={{ background: T.bg0, color: T.fg2, fontFamily: T.sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
        .vra-feature-grid { display:grid; }
        @media(max-width:980px){
          .vra-feature-grid { grid-template-columns:1fr !important; gap:32px !important; }
          .vra-feature-grid>*{ order:unset !important; }
          .vra-hero-grid { grid-template-columns:1fr !important; gap:48px !important; }
        }
        .vra-em { font-family:"Instrument Serif",Georgia,serif; font-style:italic; font-weight:400; letter-spacing:-0.005em; font-size:1.04em; }
      `}</style>

      {/* ── HERO ── */}
      <section style={{ position: "relative", minHeight: "calc(100vh - 64px)", borderBottom: `1px solid ${T.line1}`, overflow: "hidden", display: "flex", alignItems: "center" }}>
        {/* Background grid */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `linear-gradient(to right, ${T.line1} 1px, transparent 1px), linear-gradient(to bottom, ${T.line1} 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 0%, transparent 75%)",
          opacity: 0.7,
        }} />

        {/* Background 3D glasses — full viewport, dimmed */}
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", opacity: 0.32 }}>
          <div style={{ width: "min(1200px, 110vw)", aspectRatio: "5/4", maxHeight: "90vh" }}>
            <Glasses3D bare />
          </div>
        </div>

        {/* Subtle cyan radial toward the right */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 75% 50%, rgba(92,229,213,0.04) 0%, transparent 70%)" }} />

        {/* Foreground */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", width: "100%", padding: `clamp(80px,11vw,144px) ${gutter}` }}>
          <div style={{ maxWidth: 600 }}>
            <h1 style={{ fontFamily: T.sans, fontSize: "clamp(2.75rem,5.6vw,5rem)", fontWeight: 500, color: T.fg1, letterSpacing: "-0.035em", lineHeight: 1.02, margin: "0 0 28px" }}>
              A pair of glasses<br />that <span className="vra-em">remember</span><br />everything you saw.
            </h1>
            <p style={{ fontSize: "clamp(1rem,1.3vw,1.15rem)", color: T.fg2, marginBottom: 36, maxWidth: 480, lineHeight: 1.55 }}>
              Eight cameras around the frame. Sound only you can hear. A display at the edge of your vision. It catches your voice — even a whisper — not whoever&apos;s standing next to you.
            </p>
            <a href="#spec" style={{ fontSize: 14, color: T.fg2, textDecoration: "underline", textUnderlineOffset: 4, letterSpacing: "-0.005em" }}>
              See the full spec
            </a>
          </div>
        </div>
      </section>

      {/* ── MANIFESTO ── */}
      <section style={{ padding: `clamp(80px,11vw,144px) ${gutter}`, borderBottom: `1px solid ${T.line1}` }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <p style={{ fontSize: "clamp(1.5rem,2.4vw,1.875rem)", lineHeight: 1.35, color: T.fg1, letterSpacing: "-0.02em", fontWeight: 400 }}>
            Vraelis is something you wear. It has a camera, a mic, a speaker, and a light.{" "}
            <span className="vra-em" style={{ fontSize: "1.05em" }}>It remembers what you saw</span>
            {" "}— every angle, every word, every thought you whispered into it.
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <FeatureRow
        index={1} label="Record"
        headline={<>Eight cameras.<br />One memory.</>}
        body="Eight cameras cover the full room, not just what you were facing. Go back to any angle later — who was to your left, what was behind you, what the person up front pointed at."
        specs={[{ label: "Array", value: "8 × micro-camera" }, { label: "Coverage", value: "360° horizontal" }, { label: "Resolution", value: "4K per stream" }]}
        diagram={<RecordDiagram />}
      />

      <FeatureRow
        index={2} label="Listen" reverse
        headline={<>Stereo audio.<br />Only <span className="vra-em">you</span> hear it.</>}
        body="It plays audio through bone conduction — only you hear it. No earbuds. Nothing leaking out. The person sitting across from you has no idea."
        specs={[{ label: "Output", value: "Bone-conducted stereo" }, { label: "Leakage", value: "Inaudible @ 30 cm" }, { label: "Latency", value: "< 20 ms" }]}
        diagram={<ListenDiagram />}
      />

      <FeatureRow
        index={3} label="Speak"
        headline={<>Talk to it.<br />Or just whisper.</>}
        body="Four mics focused on your voice. It catches a full whisper even in a loud room. You can send a message in a meeting without saying anything out loud. It learns your voice, not the noise around you."
        specs={[{ label: "Microphones", value: "4 × beamformed array" }, { label: "Threshold", value: "26 dB SPL · whisper" }, { label: "Identity", value: "Voiceprint-locked" }]}
        diagram={<SpeakDiagram />}
      />

      <FeatureRow
        index={4} label="See" reverse
        headline={<>An ambient display<br /><span className="vra-em">over your sight.</span></>}
        body="A transparent overlay sits just outside your line of sight. Captions, directions, quick replies. It&apos;s there when you want it and easy to tune out when you don&apos;t."
        specs={[{ label: "Type", value: "Transparent waveguide" }, { label: "Field", value: "28° diagonal" }, { label: "Brightness", value: "3,500 nits peak" }]}
        diagram={<SeeDiagram />}
      />

      {/* ── SPEC ── */}
      <section id="spec" style={{ padding: `clamp(80px,11vw,144px) ${gutter}`, borderBottom: `1px solid ${T.line1}` }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56, flexWrap: "wrap", gap: 24 }}>
            <h2 style={{ fontFamily: T.sans, fontSize: "clamp(1.875rem,3vw,2.75rem)", fontWeight: 500, color: T.fg1, letterSpacing: "-0.03em", margin: 0 }}>Specifications</h2>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.fg4, textAlign: "right", lineHeight: 1.5 }}>Prototype · subject to change</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0 80px" }} className="vra-spec-grid">
            {SPEC_GROUPS.map((g) => (
              <div key={g.group} style={{ marginBottom: 56 }}>
                <div style={{ paddingBottom: 14, borderBottom: `1px solid ${T.lineS}`, marginBottom: 0 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: T.fg1, letterSpacing: "-0.015em", margin: 0 }}>{g.group}</h3>
                </div>
                {g.rows.map(([label, value], i) => (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "160px 1fr", padding: "13px 0", borderBottom: i === g.rows.length - 1 ? `1px solid ${T.lineS}` : `1px solid ${T.line1}`, alignItems: "baseline" }}>
                    <div style={{ fontFamily: T.mono, color: T.fg4, fontSize: 12 }}>{label}</div>
                    <div style={{ color: T.fg1, fontSize: 14 }}>{value}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @media(max-width:980px){ .vra-spec-grid { grid-template-columns:1fr !important; } }
      `}</style>
    </div>
  );
}

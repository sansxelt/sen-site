/* Physical product composition — contact lens + earbuds
   Used on the homepage hero and the product page hero. */

/* ─────────────────────────────────────────────────────────────────
   CONTACT LENS — transparent, curved, glossy SVG
───────────────────────────────────────────────────────────────── */
function ContactLens({ size = 260 }: { size?: number }) {
  const h = size / 2;
  const v = `0 0 ${size} ${size}`;

  return (
    <svg width={size} height={size} viewBox={v} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Glass body gradient — nearly transparent, cool blue tint */}
        <radialGradient id="lensBody" cx="38%" cy="32%" r="62%">
          <stop offset="0%"   stopColor="rgba(190,230,255,0.16)" />
          <stop offset="42%"  stopColor="rgba(150,210,255,0.08)" />
          <stop offset="100%" stopColor="rgba(100,180,255,0.02)" />
        </radialGradient>
        {/* Outer ambient halo */}
        <radialGradient id="lensHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(150,215,255,0.18)" />
          <stop offset="65%"  stopColor="rgba(100,180,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="lensBlur4" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="lensBlur2" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="lensBlur1" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* Outer halo glow */}
      <circle cx={h} cy={h} r={h * 0.98} fill="url(#lensHalo)" />

      {/* Main lens body — transparent glass disc */}
      <circle cx={h} cy={h} r={h * 0.89} fill="url(#lensBody)" />

      {/* Outer rim — thin, precise */}
      <circle cx={h} cy={h} r={h * 0.89} stroke="rgba(190,235,255,0.32)" strokeWidth="1.4" />

      {/* Rim lighting arc — upper-left, the dominant highlight */}
      <path
        d={`M ${h - h*0.76} ${h - h*0.52} A ${h*0.87} ${h*0.87} 0 0 1 ${h + h*0.25} ${h - h*0.84}`}
        stroke="rgba(235,250,255,0.78)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Rim lighting arc — second pass, slightly offset, softer */}
      <path
        d={`M ${h - h*0.72} ${h - h*0.56} A ${h*0.85} ${h*0.85} 0 0 1 ${h + h*0.20} ${h - h*0.82}`}
        stroke="rgba(200,240,255,0.28)"
        strokeWidth="5"
        strokeLinecap="round"
        filter="url(#lensBlur2)"
      />

      {/* Secondary arc — lower-right, dim */}
      <path
        d={`M ${h + h*0.70} ${h + h*0.42} A ${h*0.80} ${h*0.80} 0 0 1 ${h + h*0.32} ${h + h*0.80}`}
        stroke="rgba(130,200,255,0.22)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Primary refraction caustic — blurred bright ellipse */}
      <ellipse
        cx={h - h*0.30}
        cy={h - h*0.30}
        rx={h * 0.27}
        ry={h * 0.15}
        fill="rgba(255,255,255,0.18)"
        transform={`rotate(-28, ${h - h*0.30}, ${h - h*0.30})`}
        filter="url(#lensBlur4)"
      />
      {/* Secondary refraction — smaller, sharper spot */}
      <ellipse
        cx={h - h*0.52}
        cy={h - h*0.42}
        rx={h * 0.11}
        ry={h * 0.065}
        fill="rgba(255,255,255,0.28)"
        transform={`rotate(-20, ${h - h*0.52}, ${h - h*0.42})`}
        filter="url(#lensBlur1)"
      />

      {/* Inner micro-HUD dashed ring */}
      <circle
        cx={h} cy={h} r={h * 0.50}
        stroke="rgba(100,205,255,0.22)"
        strokeWidth="0.8"
        strokeDasharray="4.5 8"
      />
      {/* HUD tick marks — 8 evenly spaced */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 8 - Math.PI / 2;
        const ir = h * 0.50;
        const or = h * 0.56;
        return (
          <line
            key={i}
            x1={h + ir * Math.cos(angle)} y1={h + ir * Math.sin(angle)}
            x2={h + or * Math.cos(angle)} y2={h + or * Math.sin(angle)}
            stroke="rgba(100,205,255,0.22)"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Pupil ring */}
      <circle cx={h} cy={h} r={h * 0.28} stroke="rgba(110,210,255,0.38)" strokeWidth="1.2" />

      {/* Iris fill */}
      <circle cx={h} cy={h} r={h * 0.20} fill="rgba(100,200,255,0.07)" stroke="rgba(100,205,255,0.28)" strokeWidth="0.8" />

      {/* Center dot */}
      <circle cx={h} cy={h} r={h * 0.055} fill="rgba(130,215,255,0.55)" />

      {/* Inner rim detail */}
      <circle cx={h} cy={h} r={h * 0.72} stroke="rgba(150,215,255,0.08)" strokeWidth="0.6" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EARBUD — single premium earbud unit (CSS pseudo-3D)
───────────────────────────────────────────────────────────────── */
function EarbudUnit({
  rotate = 0,
  scale = 1,
  opacity = 1,
}: {
  rotate?: number;
  scale?: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        transform: `rotate(${rotate}deg) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transformOrigin: "50% 80%",
      }}
    >
      {/* Capsule / head */}
      <div
        style={{
          width: 56,
          height: 72,
          borderRadius: "50% 50% 44% 44% / 48% 48% 52% 52%",
          background:
            "radial-gradient(ellipse at 34% 27%, #2e2e3e 0%, #1c1c28 42%, #101018 100%)",
          position: "relative",
          boxShadow: [
            "0 22px 55px rgba(0,0,0,0.92)",
            "inset 0 1.5px 0 rgba(255,255,255,0.13)",
            "inset 0 -2px 3px rgba(0,0,0,0.58)",
            "inset 2.5px 0 0 rgba(255,255,255,0.055)",
            "inset -1.5px 0 0 rgba(0,0,0,0.45)",
          ].join(","),
        }}
      >
        {/* Specular highlight — upper-left catch light */}
        <div
          style={{
            position: "absolute",
            top: "9%", left: "16%",
            width: "33%", height: "25%",
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.26) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(2.5px)",
          }}
        />
        {/* Secondary specular — very small, sharp */}
        <div
          style={{
            position: "absolute",
            top: "7%", left: "22%",
            width: "12%", height: "10%",
            background: "rgba(255,255,255,0.55)",
            borderRadius: "50%",
            filter: "blur(1px)",
          }}
        />
        {/* Driver mesh — darker recessed circle */}
        <div
          style={{
            position: "absolute",
            top: "32%", left: "16%", right: "16%", bottom: "20%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 35%, rgba(22,22,34,0.70) 0%, rgba(8,8,14,0.80) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.60)",
          }}
        />
        {/* Mesh dot pattern on driver */}
        <div
          style={{
            position: "absolute",
            top: "36%", left: "20%", right: "20%", bottom: "24%",
            borderRadius: "50%",
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "4px 4px",
          }}
        />
        {/* Rim light — right edge */}
        <div
          style={{
            position: "absolute",
            top: "13%", right: 0, bottom: "13%",
            width: 2.5,
            background:
              "linear-gradient(to bottom, transparent, rgba(120,195,255,0.38) 38%, rgba(120,195,255,0.22) 68%, transparent)",
            borderRadius: 2,
          }}
        />
        {/* Status LED — blue-white glow */}
        <div
          style={{
            position: "absolute",
            bottom: "18%", left: "50%",
            transform: "translateX(-50%)",
            width: 4.5, height: 4.5,
            borderRadius: "50%",
            background: "rgba(140,218,255,0.95)",
            boxShadow:
              "0 0 5px rgba(140,218,255,0.85), 0 0 12px rgba(140,218,255,0.45), 0 0 20px rgba(140,218,255,0.18)",
          }}
        />
      </div>

      {/* Stem */}
      <div
        style={{
          width: 15,
          height: 44,
          marginTop: -1,
          background: "linear-gradient(170deg, #222232 0%, #161622 55%, #111120 100%)",
          borderRadius: "0 0 8px 8px",
          position: "relative",
          boxShadow: [
            "0 12px 32px rgba(0,0,0,0.75)",
            "inset 1.5px 0 0 rgba(255,255,255,0.07)",
            "inset -1.5px 0 0 rgba(0,0,0,0.45)",
            "inset 0 -2px 0 rgba(0,0,0,0.50)",
          ].join(","),
        }}
      >
        {/* Stem rim light — right edge */}
        <div
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: "15%",
            width: 1.5,
            background:
              "linear-gradient(to bottom, rgba(120,195,255,0.22), rgba(120,195,255,0.10) 60%, transparent)",
            borderRadius: 1,
          }}
        />
        {/* Groove marks */}
        {[36, 55, 72].map((pct, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${pct}%`, left: "18%", right: "18%",
              height: 0.8,
              background: "rgba(255,255,255,0.07)",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Full composition — lens + earbuds on a stage
───────────────────────────────────────────────────────────────── */
export function ProductComposition() {
  return (
    <div
      style={{
        position: "relative",
        width: "min(700px, 93vw)",
        height: "min(420px, 66vw)",
        margin: "0 auto",
        isolation: "isolate",
      }}
    >
      {/* ── Background stage lighting ── */}

      {/* Primary light from upper-center — cool blue */}
      <div
        style={{
          position: "absolute",
          top: "-8%", left: "8%", right: "28%",
          height: "65%",
          background:
            "radial-gradient(ellipse, rgba(140,215,255,0.12) 0%, transparent 65%)",
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />
      {/* Warm violet ambient — whole scene */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 70% at 45% 48%, rgba(100,80,180,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ── CONTACT LENS — hero object, center-left, floating ── */}
      <div
        className="hero-lens"
        style={{
          position: "absolute",
          left: "3%",
          top: "2%",
          filter:
            "drop-shadow(0 28px 44px rgba(0,0,0,0.94)) drop-shadow(0 0 22px rgba(140,215,255,0.15))",
        }}
      >
        <ContactLens size={240} />
      </div>

      {/* Lens ambient glow on surface below */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          bottom: "14%",
          width: 180,
          height: 28,
          background:
            "radial-gradient(ellipse, rgba(100,200,255,0.14) 0%, transparent 70%)",
          filter: "blur(8px)",
          pointerEvents: "none",
        }}
      />

      {/* ── EARBUDS — companion objects, right side ── */}
      <div
        className="hero-earbuds"
        style={{
          position: "absolute",
          right: "6%",
          top: "26%",
          display: "flex",
          gap: 11,
          alignItems: "flex-end",
          filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.90))",
        }}
      >
        <EarbudUnit rotate={-9} />
        <EarbudUnit rotate={11} scale={0.88} opacity={0.76} />
      </div>

      {/* Earbuds ambient glow */}
      <div
        style={{
          position: "absolute",
          right: "8%",
          bottom: "14%",
          width: 130,
          height: 22,
          background:
            "radial-gradient(ellipse, rgba(130,210,255,0.12) 0%, transparent 70%)",
          filter: "blur(6px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Surface plane — minimal stage / table ── */}
      <div
        style={{
          position: "absolute",
          bottom: "14%", left: "2%", right: "2%",
          height: 1,
          background:
            "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.055) 20%, rgba(255,255,255,0.075) 50%, rgba(255,255,255,0.055) 80%, transparent 100%)",
          borderRadius: 1,
        }}
      />
      {/* Surface reflection glow beneath the line */}
      <div
        style={{
          position: "absolute",
          bottom: "5%", left: "5%", right: "5%",
          height: 48,
          background:
            "radial-gradient(ellipse 85% 100% at 50% 0%, rgba(255,255,255,0.028) 0%, transparent 80%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Cast shadows — objects onto surface ── */}
      {/* Lens shadow */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          bottom: "10%",
          width: 210,
          height: 22,
          background:
            "radial-gradient(ellipse, rgba(0,0,0,0.65) 0%, transparent 72%)",
          filter: "blur(7px)",
          pointerEvents: "none",
        }}
      />
      {/* Earbuds shadow */}
      <div
        style={{
          position: "absolute",
          right: "8%",
          bottom: "10%",
          width: 120,
          height: 15,
          background:
            "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 72%)",
          filter: "blur(5px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Reflections below surface ── */}
      {/* Lens reflection */}
      <div
        style={{
          position: "absolute",
          left: "3%",
          bottom: "-4%",
          opacity: 0.06,
          transform: "scaleY(-1)",
          filter: "blur(4px)",
          pointerEvents: "none",
        }}
      >
        <ContactLens size={200} />
      </div>

      {/* ── Subtle Sansxel WORKSHOP interface context — behind objects ── */}
      <div
        style={{
          position: "absolute",
          right: "0%",
          top: "5%",
          width: "36%",
          height: "55%",
          borderRadius: 10,
          background:
            "linear-gradient(145deg, rgba(20,20,32,0.65) 0%, rgba(14,14,22,0.45) 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          opacity: 0.55,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {/* Tiny workshop UI context */}
        <div
          style={{
            height: 20,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.02)",
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            gap: 4,
          }}
        >
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 5.5, height: 5.5, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
          ))}
        </div>
        <div style={{ display: "flex", height: "calc(100% - 20px)" }}>
          <div style={{ width: "30%", borderRight: "1px solid rgba(255,255,255,0.04)", padding: "6px 5px", display: "flex", flexDirection: "column", gap: 3 }}>
            {[55, 44, 52].map((w, i) => (
              <div key={i} style={{ height: 5, width: `${w}%`, borderRadius: 2, background: i === 0 ? "rgba(167,139,250,0.22)" : "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
          <div style={{ flex: 1, padding: "6px 7px", display: "flex", flexDirection: "column", gap: 4, justifyContent: "flex-end" }}>
            {[90, 75, 82, 55].map((w, i) => (
              <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 2, background: "rgba(255,255,255,0.10)" }} />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

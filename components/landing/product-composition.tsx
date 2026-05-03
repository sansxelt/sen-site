/* Physical product composition — contact lens + earbuds on a dark stage.
   The hero visual for the homepage and product page. Hardware only — no
   software window lives here. */

/* ─────────────────────────────────────────────────────────────────
   CONTACT LENS — transparent curved glass, pseudo-3D via CSS perspective
───────────────────────────────────────────────────────────────── */
function ContactLens({ size = 290 }: { size?: number }) {
  const h = size / 2;
  const v = `0 0 ${size} ${size}`;

  return (
    <svg width={size} height={size} viewBox={v} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Fresnel body — truly transparent center, refractive/glassy edge */}
        <radialGradient id="lensBody" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(155,220,255,0.00)" />
          <stop offset="48%"  stopColor="rgba(140,210,255,0.03)" />
          <stop offset="72%"  stopColor="rgba(128,202,255,0.10)" />
          <stop offset="88%"  stopColor="rgba(112,192,255,0.22)" />
          <stop offset="100%" stopColor="rgba(95,178,255,0.38)" />
        </radialGradient>
        {/* Ambient halo — extends beyond the lens */}
        <radialGradient id="lensHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(150,220,255,0.10)" />
          <stop offset="65%"  stopColor="rgba(100,185,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        {/* Dome highlight — upper-left curved surface glint */}
        <radialGradient id="lensDomeHigh" cx="34%" cy="26%" r="44%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.28)" />
          <stop offset="55%"  stopColor="rgba(200,240,255,0.07)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="lBlur7" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="lBlur4" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="lBlur2" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="lBlur1" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <filter id="lRimBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.8" />
        </filter>
      </defs>

      {/* Outer ambient halo */}
      <circle cx={h} cy={h} r={h * 1.02} fill="url(#lensHalo)" filter="url(#lBlur7)" />

      {/* Fresnel lens body */}
      <circle cx={h} cy={h} r={h * 0.89} fill="url(#lensBody)" />

      {/* Dome curvature highlight overlay */}
      <circle cx={h} cy={h} r={h * 0.89} fill="url(#lensDomeHigh)" />

      {/* Main rim — precise thin edge */}
      <circle cx={h} cy={h} r={h * 0.89} stroke="rgba(210,242,255,0.44)" strokeWidth="1.4" fill="none" />

      {/* Chromatic fringing — red channel displaced outward */}
      <circle cx={h} cy={h} r={h * 0.905} stroke="rgba(255,80,80,0.07)" strokeWidth="4" fill="none" filter="url(#lRimBlur)" />
      {/* Chromatic fringing — blue channel inward */}
      <circle cx={h} cy={h} r={h * 0.875} stroke="rgba(80,120,255,0.08)" strokeWidth="5" fill="none" filter="url(#lBlur2)" />

      {/* PRIMARY rim light — upper-left arc — dominant specular */}
      <path
        d={`M ${h - h*0.80} ${h - h*0.48} A ${h*0.88} ${h*0.88} 0 0 1 ${h + h*0.30} ${h - h*0.84}`}
        stroke="rgba(255,255,255,0.97)"
        strokeWidth="4.0"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bright inner glow pass — simulates glass edge refraction */}
      <path
        d={`M ${h - h*0.78} ${h - h*0.50} A ${h*0.87} ${h*0.87} 0 0 1 ${h + h*0.26} ${h - h*0.83}`}
        stroke="rgba(220,248,255,0.55)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        filter="url(#lBlur2)"
      />
      {/* Wide soft glow pass on main rim light */}
      <path
        d={`M ${h - h*0.76} ${h - h*0.54} A ${h*0.86} ${h*0.86} 0 0 1 ${h + h*0.24} ${h - h*0.83}`}
        stroke="rgba(170,235,255,0.38)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        filter="url(#lBlur7)"
      />

      {/* SECONDARY rim light — lower-right, dim cool */}
      <path
        d={`M ${h + h*0.72} ${h + h*0.40} A ${h*0.82} ${h*0.82} 0 0 1 ${h + h*0.36} ${h + h*0.80}`}
        stroke="rgba(130,200,255,0.24)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* PRIMARY refraction caustic — bright blurred ellipse, upper-left */}
      <ellipse
        cx={h - h*0.27} cy={h - h*0.29}
        rx={h * 0.32} ry={h * 0.17}
        fill="rgba(255,255,255,0.50)"
        transform={`rotate(-30, ${h - h*0.27}, ${h - h*0.29})`}
        filter="url(#lBlur4)"
      />
      {/* Sharp specular hot-spot inside caustic */}
      <ellipse
        cx={h - h*0.33} cy={h - h*0.33}
        rx={h * 0.12} ry={h * 0.072}
        fill="rgba(255,255,255,0.82)"
        transform={`rotate(-30, ${h - h*0.33}, ${h - h*0.33})`}
        filter="url(#lBlur1)"
      />

      {/* Secondary transmitted caustic — lower area */}
      <ellipse
        cx={h + h*0.20} cy={h + h*0.16}
        rx={h * 0.19} ry={h * 0.10}
        fill="rgba(200,240,255,0.11)"
        transform={`rotate(22, ${h + h*0.20}, ${h + h*0.16})`}
        filter="url(#lBlur4)"
      />

      {/* Inner micro-HUD ring — AR design language */}
      <circle
        cx={h} cy={h} r={h * 0.52}
        stroke="rgba(100,205,255,0.20)"
        strokeWidth="0.9"
        strokeDasharray="4.5 8"
        fill="none"
      />

      {/* HUD tick marks — 12 total, longer on quarters */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
        const ir = h * 0.52;
        const or = h * (i % 3 === 0 ? 0.62 : 0.57);
        const isMajor = i % 3 === 0;
        return (
          <line
            key={i}
            x1={h + ir * Math.cos(angle)} y1={h + ir * Math.sin(angle)}
            x2={h + or * Math.cos(angle)} y2={h + or * Math.sin(angle)}
            stroke={`rgba(100,205,255,${isMajor ? 0.32 : 0.16})`}
            strokeWidth={isMajor ? 1.1 : 0.7}
          />
        );
      })}

      {/* Pupil ring */}
      <circle cx={h} cy={h} r={h * 0.30} stroke="rgba(110,210,255,0.36)" strokeWidth="1.3" fill="none" />

      {/* Iris fill + edge ring */}
      <circle cx={h} cy={h} r={h * 0.21} fill="rgba(100,200,255,0.08)" stroke="rgba(100,205,255,0.28)" strokeWidth="0.9" />

      {/* Center pupil dot + bright core */}
      <circle cx={h} cy={h} r={h * 0.065} fill="rgba(130,215,255,0.55)" />
      <circle cx={h} cy={h} r={h * 0.028} fill="rgba(210,245,255,0.95)" />

      {/* Inner depth ring */}
      <circle cx={h} cy={h} r={h * 0.73} stroke="rgba(150,215,255,0.07)" strokeWidth="0.5" fill="none" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EARBUD — single premium unit, CSS pseudo-3D with material depth
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
          width: 66,
          height: 84,
          borderRadius: "50% 50% 44% 44% / 48% 48% 52% 52%",
          background:
            "radial-gradient(ellipse at 32% 24%, #3c3c50 0%, #212132 38%, #0e0e1c 100%)",
          position: "relative",
          boxShadow: [
            "0 28px 64px rgba(0,0,0,0.96)",
            "inset 0 2px 0 rgba(255,255,255,0.16)",
            "inset 0 -3px 5px rgba(0,0,0,0.62)",
            "inset 3px 0 0 rgba(255,255,255,0.06)",
            "inset -2px 0 0 rgba(0,0,0,0.55)",
          ].join(","),
        }}
      >
        {/* Large soft specular — primary dome glint */}
        <div
          style={{
            position: "absolute",
            top: "6%", left: "10%",
            width: "52%", height: "38%",
            background:
              "radial-gradient(ellipse at 28% 28%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.07) 55%, transparent 78%)",
            borderRadius: "50%",
            filter: "blur(3.5px)",
          }}
        />
        {/* Sharp catch-light — key specular */}
        <div
          style={{
            position: "absolute",
            top: "8%", left: "19%",
            width: "16%", height: "12%",
            background: "rgba(255,255,255,0.78)",
            borderRadius: "50%",
            filter: "blur(1.4px)",
          }}
        />
        {/* Tiny secondary specular dot */}
        <div
          style={{
            position: "absolute",
            top: "13%", left: "38%",
            width: "7%", height: "6%",
            background: "rgba(255,255,255,0.45)",
            borderRadius: "50%",
            filter: "blur(0.8px)",
          }}
        />

        {/* Driver mesh — recessed darker circle */}
        <div
          style={{
            position: "absolute",
            top: "28%", left: "14%", right: "14%", bottom: "18%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 36%, rgba(14,14,24,0.65) 0%, rgba(5,5,12,0.88) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
            boxShadow:
              "inset 0 2.5px 6px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.025)",
          }}
        />
        {/* Driver mesh dot pattern */}
        <div
          style={{
            position: "absolute",
            top: "33%", left: "18%", right: "18%", bottom: "22%",
            borderRadius: "50%",
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "4px 4px",
          }}
        />

        {/* Right rim light — blue-tinted catch */}
        <div
          style={{
            position: "absolute",
            top: "10%", right: 0, bottom: "10%",
            width: 3,
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(120,195,255,0.44) 32%, rgba(100,180,255,0.28) 68%, transparent 100%)",
            borderRadius: 2,
          }}
        />
        {/* Left edge — subtle cool fill light */}
        <div
          style={{
            position: "absolute",
            top: "22%", left: 0, bottom: "22%",
            width: 1.5,
            background:
              "linear-gradient(to bottom, transparent, rgba(150,200,255,0.12) 50%, transparent)",
            borderRadius: 1,
          }}
        />

        {/* Status LED */}
        <div
          style={{
            position: "absolute",
            bottom: "19%", left: "50%",
            transform: "translateX(-50%)",
            width: 5, height: 5,
            borderRadius: "50%",
            background: "rgba(140,222,255,0.96)",
            boxShadow: [
              "0 0 4px rgba(140,222,255,0.92)",
              "0 0 12px rgba(120,205,255,0.60)",
              "0 0 24px rgba(100,185,255,0.28)",
            ].join(","),
          }}
        />
      </div>

      {/* Stem */}
      <div
        style={{
          width: 17,
          height: 52,
          marginTop: -1,
          background:
            "linear-gradient(172deg, #252535 0%, #181826 55%, #111120 100%)",
          borderRadius: "0 0 10px 10px",
          position: "relative",
          boxShadow: [
            "0 16px 42px rgba(0,0,0,0.85)",
            "inset 1.5px 0 0 rgba(255,255,255,0.08)",
            "inset -1.5px 0 0 rgba(0,0,0,0.52)",
            "inset 0 -2px 0 rgba(0,0,0,0.58)",
          ].join(","),
        }}
      >
        {/* Stem rim light */}
        <div
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: "14%",
            width: 1.5,
            background:
              "linear-gradient(to bottom, rgba(120,195,255,0.26), rgba(100,180,255,0.12) 60%, transparent)",
            borderRadius: 1,
          }}
        />
        {/* Grooves */}
        {[36, 55, 73].map((pct, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${pct}%`, left: "17%", right: "17%",
              height: 0.7,
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
   Full composition — lens + earbuds on a dark stage
   CSS perspective transforms create the illusion of 3D space.
───────────────────────────────────────────────────────────────── */
export function ProductComposition() {
  return (
    <div
      style={{
        position: "relative",
        width: "min(740px, 96vw)",
        height: "min(450px, 65vw)",
        margin: "0 auto",
        isolation: "isolate",
      }}
    >
      {/* ── Scene lighting ── */}

      {/* Primary stage spotlight — upper center, cold white */}
      <div
        style={{
          position: "absolute",
          top: "-10%", left: "15%", right: "15%",
          height: "58%",
          background:
            "radial-gradient(ellipse, rgba(210,240,255,0.10) 0%, rgba(168,210,255,0.04) 45%, transparent 72%)",
          filter: "blur(24px)",
          pointerEvents: "none",
        }}
      />
      {/* Secondary fill — warm violet from below, depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 85% 75% at 44% 62%, rgba(88,72,180,0.08) 0%, transparent 68%)",
          pointerEvents: "none",
        }}
      />
      {/* Lens-side cool ambient */}
      <div
        style={{
          position: "absolute",
          top: "-5%", left: "-8%",
          width: "55%", height: "70%",
          background:
            "radial-gradient(ellipse, rgba(140,215,255,0.08) 0%, transparent 65%)",
          filter: "blur(28px)",
          pointerEvents: "none",
        }}
      />

      {/* ── CONTACT LENS — hero object, center-left, 3D tilted ── */}
      <div
        className="hero-lens"
        style={{
          position: "absolute",
          left: "2%",
          top: "0%",
          filter:
            "drop-shadow(0 32px 52px rgba(0,0,0,0.96)) drop-shadow(0 0 28px rgba(140,215,255,0.14))",
        }}
      >
        {/* CSS 3D perspective wrapper — tighter perspective = more dramatic oval */}
        <div style={{ perspective: "560px" }}>
          <div
            style={{
              transform: "rotateX(40deg) rotateY(-22deg)",
              transformStyle: "preserve-3d",
            }}
          >
            <ContactLens size={290} />
          </div>
        </div>
      </div>

      {/* Lens ambient glow on surface — ring reflection (lens is transparent) */}
      <div
        style={{
          position: "absolute",
          left: "6%",
          bottom: "13%",
          width: 220,
          height: 32,
          background:
            "radial-gradient(ellipse, rgba(100,200,255,0.13) 0%, rgba(100,200,255,0.04) 50%, transparent 72%)",
          filter: "blur(8px)",
          pointerEvents: "none",
        }}
      />

      {/* ── EARBUDS — right side, 3D perspective tilt ── */}
      <div
        className="hero-earbuds"
        style={{
          position: "absolute",
          right: "4%",
          top: "22%",
          filter: "drop-shadow(0 20px 36px rgba(0,0,0,0.94))",
        }}
      >
        {/* Perspective wrapper — tighter for more dramatic foreshortening */}
        <div style={{ perspective: "420px" }}>
          <div
            style={{
              transform: "rotateX(22deg) rotateY(16deg)",
              transformStyle: "preserve-3d",
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
            }}
          >
            <EarbudUnit rotate={-10} />
            <EarbudUnit rotate={12} scale={0.87} opacity={0.74} />
          </div>
        </div>
      </div>

      {/* Earbuds floor glow */}
      <div
        style={{
          position: "absolute",
          right: "6%",
          bottom: "12%",
          width: 140,
          height: 24,
          background:
            "radial-gradient(ellipse, rgba(130,210,255,0.11) 0%, transparent 70%)",
          filter: "blur(6px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Stage surface — table/pedestal line ── */}
      <div
        style={{
          position: "absolute",
          bottom: "15%", left: "1%", right: "1%",
          height: 1,
          background:
            "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.04) 12%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.08) 70%, rgba(255,255,255,0.04) 88%, transparent 100%)",
        }}
      />
      {/* Surface bloom — light bouncing off the table */}
      <div
        style={{
          position: "absolute",
          bottom: "10%", left: "10%", right: "10%",
          height: 60,
          background:
            "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(255,255,255,0.022) 0%, transparent 80%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Cast shadows — objects onto surface ── */}
      {/* Lens shadow — elongated, hard-ish, perspective */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          bottom: "9%",
          width: 240,
          height: 28,
          background:
            "radial-gradient(ellipse 70% 100% at 40% 50%, rgba(0,0,0,0.72) 0%, transparent 75%)",
          filter: "blur(6px)",
          pointerEvents: "none",
          transform: "scaleX(1.1)",
        }}
      />
      {/* Earbuds shadow */}
      <div
        style={{
          position: "absolute",
          right: "6%",
          bottom: "9%",
          width: 140,
          height: 18,
          background:
            "radial-gradient(ellipse, rgba(0,0,0,0.62) 0%, transparent 75%)",
          filter: "blur(5px)",
          pointerEvents: "none",
        }}
      />

      {/* ── Reflections below the surface line ── */}
      {/* Lens reflection */}
      <div
        style={{
          position: "absolute",
          left: "2%",
          bottom: "-6%",
          opacity: 0.05,
          transform: "scaleY(-1)",
          filter: "blur(5px)",
          pointerEvents: "none",
        }}
      >
        <ContactLens size={240} />
      </div>

      {/* ── Edge vignette — contains the scene, feels like a stage ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 105% 100% at 50% 50%, transparent 42%, rgba(5,5,7,0.25) 72%, rgba(5,5,7,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

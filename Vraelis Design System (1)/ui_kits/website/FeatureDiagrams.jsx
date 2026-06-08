// FeatureDiagrams.jsx
// Four bespoke technical diagrams — one per feature row.
// Each renders the concept (record, listen, speak, see) as a
// schematic, not a photo. No stock atmospheric imagery anywhere.

// 01 — RECORD: a top-down schematic of 8 cameras forming a 360° ring.
function RecordDiagram() {
  const cx = 200, cy = 160, r = 90;
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="8-camera 360° ring">
      {/* horizon */}
      <line x1="20" y1={cy} x2="380" y2={cy} stroke="var(--line-1)" strokeWidth="1" strokeDasharray="2 4" />

      {/* frame ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--fg-3)" strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke="var(--line-2)" strokeWidth="1" strokeDasharray="2 3" />

      {/* 8 camera nodes */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        return (
          <g key={i}>
            {/* sight cone */}
            <path
              d={`M ${x} ${y} L ${x + Math.cos(a - 0.45) * 90} ${y + Math.sin(a - 0.45) * 90} L ${x + Math.cos(a + 0.45) * 90} ${y + Math.sin(a + 0.45) * 90} Z`}
              fill="var(--acc)"
              fillOpacity="0.07"
            />
            <circle cx={x} cy={y} r="4.5" fill="var(--bg-0)" stroke="var(--acc)" strokeWidth="1.5" />
            <text x={x + (Math.cos(a) * 14)} y={y + (Math.sin(a) * 14) + 4}
              fontFamily="JetBrains Mono" fontSize="9" fill="var(--fg-4)" letterSpacing="0.05em"
              textAnchor="middle">{String(i + 1).padStart(2, "0")}</text>
          </g>
        );
      })}

      {/* center label */}
      <text x={cx} y={cy + 4} fontFamily="JetBrains Mono" fontSize="11" fill="var(--fg-1)" textAnchor="middle" letterSpacing="0">360°</text>

      {/* bottom legend */}
      <text x="200" y="296" fontFamily="JetBrains Mono" fontSize="10" fill="var(--fg-4)" textAnchor="middle" letterSpacing="0.05em">8 × MICRO CAMERA · STITCHED 4K</text>
    </svg>
  );
}

// 02 — LISTEN: an audio cone emitting from temple to ear, with a
// silhouette of a second person nearby showing zero leakage.
function ListenDiagram() {
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="Near-field audio leakage zero">
      {/* Wearer ear (left) */}
      <g>
        <path d="M 80 130 Q 100 110 130 120 Q 145 135 140 165 Q 130 195 105 200 Q 85 198 75 175 Z" fill="none" stroke="var(--fg-2)" strokeWidth="1.3" />
        <text x="100" y="232" fontFamily="JetBrains Mono" fontSize="10" fill="var(--fg-3)" letterSpacing="0.04em">WEARER</text>

        {/* sound cone (close to ear) */}
        {[1, 2, 3, 4].map((i) => (
          <path key={i}
            d={`M 75 160 Q ${65 - i * 8} 160 ${55 - i * 12} ${135 + (i * 5)}`}
            fill="none" stroke="var(--acc)" strokeWidth="1.1" opacity={1 - i * 0.18}
          />
        ))}
        {[1, 2, 3, 4].map((i) => (
          <path key={`a${i}`}
            d={`M 75 160 Q ${65 - i * 8} 160 ${55 - i * 12} ${185 - (i * 5)}`}
            fill="none" stroke="var(--acc)" strokeWidth="1.1" opacity={1 - i * 0.18}
          />
        ))}
      </g>

      {/* Bystander silhouette (right) */}
      <g>
        <ellipse cx="290" cy="120" rx="22" ry="26" fill="none" stroke="var(--fg-3)" strokeWidth="1.1" />
        <path d="M 268 144 L 268 220 L 312 220 L 312 144 Z" fill="none" stroke="var(--fg-3)" strokeWidth="1.1" />
        <text x="290" y="248" fontFamily="JetBrains Mono" fontSize="10" fill="var(--fg-4)" letterSpacing="0.04em" textAnchor="middle">BYSTANDER</text>
        <text x="290" y="262" fontFamily="JetBrains Mono" fontSize="13" fill="var(--fg-1)" textAnchor="middle">0 dB</text>
      </g>

      {/* gap rule */}
      <line x1="155" y1="160" x2="262" y2="160" stroke="var(--line-3)" strokeWidth="0.8" strokeDasharray="3 3" />
      <text x="208" y="153" fontFamily="JetBrains Mono" fontSize="10" fill="var(--fg-4)" letterSpacing="0.04em" textAnchor="middle">~30 cm</text>

      {/* bottom legend */}
      <text x="200" y="298" fontFamily="JetBrains Mono" fontSize="10" fill="var(--fg-4)" textAnchor="middle" letterSpacing="0.05em">BONE-CONDUCTED · ZERO LEAKAGE @ 30 cm</text>
    </svg>
  );
}

// 03 — SPEAK: voiceprint waveform that fades into a clean line where
// the system recognizes the speaker, plus a "REJECTED" envelope for
// the room's voice.
function SpeakDiagram() {
  // pre-rolled waveform sample so it's stable, not random per render
  const wave = [12, 22, 8, 30, 18, 26, 14, 24, 10, 20, 14, 28, 16, 22, 12, 26, 18, 20, 10, 24, 14, 22, 16, 18, 12, 20, 14, 22, 18, 16, 12, 20];
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="Whisper recognition waveform">
      {/* baseline */}
      <line x1="30" y1="120" x2="370" y2="120" stroke="var(--line-2)" strokeWidth="1" />

      {/* WEARER waveform */}
      <text x="30" y="60" fontFamily="JetBrains Mono" fontSize="10" letterSpacing="0.04em" fill="var(--fg-3)">WEARER · accepted</text>
      {wave.map((v, i) => {
        const x = 30 + i * 10.5;
        return (
          <line key={`w${i}`} x1={x} y1={120 - v} x2={x} y2={120 + v} stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" />
        );
      })}

      {/* ROOM waveform — same energy, but greyed and crossed out */}
      <text x="30" y="220" fontFamily="JetBrains Mono" fontSize="10" letterSpacing="0.04em" fill="var(--fg-4)">ROOM · rejected</text>
      <line x1="30" y1="270" x2="370" y2="270" stroke="var(--line-2)" strokeWidth="1" />
      {wave.map((v, i) => {
        const x = 30 + i * 10.5;
        const v2 = Math.max(4, v * 0.7);
        return (
          <line key={`r${i}`} x1={x} y1={270 - v2} x2={x} y2={270 + v2} stroke="var(--fg-4)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
        );
      })}
      {/* X mark over rejected band */}
      <line x1="30" y1="240" x2="370" y2="300" stroke="var(--err)" strokeWidth="1" opacity="0.5" />

      <text x="200" y="298" fontFamily="JetBrains Mono" fontSize="10" fill="var(--fg-4)" textAnchor="middle" letterSpacing="0.05em">VOICEPRINT-LOCKED · 26 dB SPL THRESHOLD</text>
    </svg>
  );
}

// 04 — SEE: cross-section of an eye + waveguide projecting a HUD
// overlay into the field of vision.
function SeeDiagram() {
  return (
    <svg viewBox="0 0 400 320" style={{ width: "100%", height: "100%" }} aria-label="Waveguide HUD field of view">
      {/* horizon */}
      <line x1="30" y1="160" x2="370" y2="160" stroke="var(--line-1)" strokeWidth="1" strokeDasharray="2 4" />

      {/* eye */}
      <g>
        <ellipse cx="120" cy="160" rx="42" ry="32" fill="none" stroke="var(--fg-2)" strokeWidth="1.4" />
        <circle cx="120" cy="160" r="14" fill="var(--bg-0)" stroke="var(--fg-1)" strokeWidth="1.2" />
        <circle cx="120" cy="160" r="5" fill="var(--fg-1)" />
        <text x="120" y="216" fontFamily="JetBrains Mono" fontSize="10" textAnchor="middle" fill="var(--fg-3)" letterSpacing="0.04em">EYE</text>
      </g>

      {/* waveguide */}
      <g>
        <rect x="172" y="118" width="34" height="84" fill="none" stroke="var(--acc)" strokeWidth="1.4" />
        <line x1="178" y1="124" x2="200" y2="196" stroke="var(--acc)" strokeWidth="0.6" />
        <line x1="184" y1="124" x2="200" y2="196" stroke="var(--acc)" strokeWidth="0.6" />
        <line x1="190" y1="124" x2="200" y2="196" stroke="var(--acc)" strokeWidth="0.6" />
        <line x1="196" y1="124" x2="200" y2="196" stroke="var(--acc)" strokeWidth="0.6" />
        <text x="189" y="216" fontFamily="JetBrains Mono" fontSize="10" textAnchor="middle" fill="var(--fg-3)" letterSpacing="0.04em">GUIDE</text>
      </g>

      {/* projected field-of-view triangle */}
      <path d="M 206 160 L 370 100 L 370 220 Z" fill="var(--acc)" fillOpacity="0.06" stroke="var(--acc)" strokeWidth="0.8" opacity="0.7" />

      {/* simulated HUD elements floating in the FOV */}
      <g>
        <rect x="280" y="120" width="78" height="14" fill="none" stroke="var(--acc)" strokeWidth="0.8" />
        <text x="284" y="131" fontFamily="JetBrains Mono" fontSize="9" fill="var(--acc)" letterSpacing="0.05em">› GATE C12 · 4 MIN</text>

        <rect x="280" y="142" width="60" height="12" fill="none" stroke="var(--acc)" strokeWidth="0.8" opacity="0.7" />
        <text x="284" y="151" fontFamily="JetBrains Mono" fontSize="9" fill="var(--acc)" letterSpacing="0.05em" opacity="0.7">› 12:42 UTC</text>

        <rect x="280" y="180" width="68" height="20" fill="none" stroke="var(--acc)" strokeWidth="0.8" opacity="0.85" />
        <text x="284" y="195" fontFamily="JetBrains Mono" fontSize="9" fill="var(--acc)" letterSpacing="0.05em">CAPTION · LIVE</text>
      </g>

      {/* FOV degree arc label */}
      <text x="370" y="92" fontFamily="JetBrains Mono" fontSize="10" textAnchor="end" fill="var(--fg-4)" letterSpacing="0.04em">28° DIAG</text>

      <text x="200" y="300" fontFamily="JetBrains Mono" fontSize="10" fill="var(--fg-4)" textAnchor="middle" letterSpacing="0.05em">TRANSPARENT WAVEGUIDE · 3,500 NITS</text>
    </svg>
  );
}

Object.assign(window, { RecordDiagram, ListenDiagram, SpeakDiagram, SeeDiagram });

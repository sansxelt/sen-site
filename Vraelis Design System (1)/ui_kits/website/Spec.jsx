// Spec.jsx — full technical specifications.
// A four-group spec sheet with hard top/bottom rules.

const SPEC_GROUPS = [
  {
    group: "Capture",
    icon: "ph-video-camera",
    rows: [
      ["Array",             "8 × micro-camera"],
      ["Coverage",          "360° horizontal"],
      ["Resolution",        "4K per stream · stitched"],
      ["Frame rate",        "30 / 60 fps · auto"],
      ["Local storage",     "256 GB · streams to phone"],
    ],
  },
  {
    group: "Audio",
    icon: "ph-headphones",
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
    icon: "ph-eye",
    rows: [
      ["Type",              "Transparent waveguide"],
      ["Field of view",     "28° diagonal"],
      ["Brightness",        "3,500 nits peak"],
      ["Refresh",           "90 Hz"],
      ["Eye relief",        "12 mm"],
    ],
  },
  {
    group: "Power · build",
    icon: "ph-battery-charging",
    rows: [
      ["Battery active",    "6 hours full use"],
      ["Battery ambient",   "14 hours indicator-only"],
      ["Charging",          "Case-based · USB-C · Qi"],
      ["Weight",            "42 g"],
      ["Frame",             "7075 aluminum · medical acetate"],
    ],
  },
];

function Spec() {
  return (
    <section id="spec" style={{
      padding: "var(--section-y) var(--gutter)",
      borderBottom: "1px solid var(--line-1)",
    }}>
      <div style={{ maxWidth: "var(--max-content)", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 56, flexWrap: "wrap", gap: 24 }}>
          <h2 className="display" style={{ fontSize: "clamp(1.875rem, 3vw, 2.75rem)" }}>Specifications</h2>
          <div className="mono" style={{ fontSize: 12, color: "var(--fg-4)", textAlign: "right", lineHeight: 1.5 }}>
            Prototype · subject to change
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0 80px" }} className="vra-spec-grid">
          {SPEC_GROUPS.map((g) => (
            <div key={g.group} style={{ marginBottom: 56 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line-strong)" }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.015em" }}>{g.group}</h3>
              </div>
              {g.rows.map(([label, value], i) => (
                <div key={label} style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr",
                  padding: "13px 0",
                  borderBottom: i === g.rows.length - 1 ? "1px solid var(--line-strong)" : "1px solid var(--line-1)",
                  alignItems: "baseline",
                }}>
                  <div className="mono" style={{ color: "var(--fg-4)", fontSize: 12 }}>{label}</div>
                  <div style={{ color: "var(--fg-1)", fontSize: 14 }}>{value}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Spec });

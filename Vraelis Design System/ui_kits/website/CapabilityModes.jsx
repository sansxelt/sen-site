// CapabilityModes.jsx — three usage modes the glasses shift between.

const { useState } = React;

const MODES = [
  {
    name: "Active",
    accent: "#a8c4ff",
    body: "Full HUD overlay. Notifications, navigation, live transcripts. Always-on context that stays out of your way.",
    bullets: [
      "Live captions for everyone speaking around you",
      "Walking and driving directions in your peripheral",
      "Tap the temple to record. Hold to keep recording.",
    ],
  },
  {
    name: "Ambient",
    accent: "#c084fc",
    body: "Reduced UI. A single soft indicator and silence otherwise. For long days when you want the loop without the layer.",
    bullets: [
      "Hours of additional battery per pair",
      "Tap-only summon — no glanceable feed",
      "Camera and mic ready, never engaged",
    ],
  },
  {
    name: "Recall",
    accent: "#7ab5ff",
    body: "Eyes-up, hands-free playback. Scrub through what you saw and heard earlier today, in 360°, by whispering a query.",
    bullets: [
      "\"What did she say about the deadline?\"",
      "\"Show me the slide with the chart.\"",
      "\"Replay the last ten seconds.\"",
    ],
  },
];

function CapabilityModes() {
  const [active, setActive] = useState(null);

  return (
    <section id="capabilities" style={{
      background: "var(--bg-2)",
      padding: "clamp(80px, 12vh, 140px) clamp(20px, 5vw, 80px)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ maxWidth: 640, marginBottom: 56 }}>
          <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 18 }}>
            Three ways to wear them.
          </h2>
          <p className="cinematic-body" style={{ maxWidth: 540 }}>
            Vraelis shifts between three modes throughout your day.
            Active for the meeting, Ambient for the walk home, Recall
            for the moment you wish you'd written down.
          </p>
        </div>

        <div className="vra-modes-grid" style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr" }}>
          {MODES.map((m) => {
            const hot = active === m.name;
            return (
              <div
                key={m.name}
                onMouseEnter={() => setActive(m.name)}
                onMouseLeave={() => setActive(null)}
                style={{
                  borderRadius: 18,
                  border: `1px solid ${m.accent}${hot ? "80" : "33"}`,
                  background: `linear-gradient(180deg, ${m.accent}${hot ? "12" : "08"}, transparent 80%)`,
                  padding: "28px 28px",
                  cursor: "default",
                  transition: "border-color 250ms cubic-bezier(0.16, 1, 0.3, 1), background 250ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.accent, boxShadow: `0 0 12px ${m.accent}` }} />
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.16em", textTransform: "uppercase", color: m.accent, opacity: 0.85, whiteSpace: "nowrap" }}>mode</div>
                </div>
                <h3 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>{m.name}</h3>
                <p style={{ margin: "0 0 18px", color: "var(--fg-3)", lineHeight: 1.55, fontSize: 14 }}>{m.body}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {m.bullets.map((b) => (
                    <li key={b} style={{ display: "flex", gap: 9, fontSize: 13, color: "var(--fg-4)", lineHeight: 1.5 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: `${m.accent}88`, marginTop: 8, flexShrink: 0 }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { CapabilityModes });

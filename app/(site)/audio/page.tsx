import Link from "next/link";
import { auth } from "@/auth";
import { getSignInPath } from "@/lib/auth-ui";

const TODAY_DEVICES = [
  { name: "AirPods",           desc: "Full voice mode via AirPods and AirPods Pro. In-ear, hands-free." },
  { name: "Headphones",        desc: "Any over-ear or on-ear headphones with microphone support." },
  { name: "Bluetooth devices", desc: "Wireless earbuds, speakers, and Bluetooth audio from any brand." },
  { name: "Wired audio",       desc: "Standard 3.5mm and USB audio devices. If your device has a mic, it works." },
  { name: "Built-in mic",      desc: "Use your laptop or phone mic directly. No external hardware required." },
];

export default async function AudioPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main style={{ background: "#050507", overflowX: "hidden" }}>

      {/* Hero */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 760, paddingTop: 80, paddingBottom: 72 }}>
          <div className="landing-kicker" style={{ color: "rgba(167,139,250,0.75)" }}>audio</div>
          <h1
            className="landing-gradient-text"
            style={{ fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: 20 }}
          >
            Sansxel in your ear.
          </h1>
          <p className="landing-body" style={{ maxWidth: 520, marginBottom: 36 }}>
            Voice is a first-class interface in Workshop today. Use Sansxel
            through the audio devices you already own. Talk to it like you talk
            to someone who actually knows your work.
          </p>
          <Link
            href={signedIn ? "/app" : getSignInPath()}
            className="landing-cta-primary"
            style={{ display: "inline-flex" }}
          >
            {signedIn ? "Try voice in Workshop" : "Start free"}
          </Link>
        </div>
      </section>

      {/* Works with your devices today */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section">
          <div style={{ maxWidth: 540, marginBottom: 48 }}>
            <div className="landing-kicker">today</div>
            <h2 className="landing-h2 landing-gradient-text">Works with your devices.</h2>
            <p className="landing-body">
              You do not need special hardware. Use voice mode through any audio
              input you already have.
            </p>
          </div>
          <div
            style={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(1, 1fr)" }}
            className="audio-device-grid"
          >
            {TODAY_DEVICES.map((d) => (
              <div
                key={d.name}
                style={{
                  padding: "24px 28px",
                  borderRadius: 14,
                  border: "1px solid rgba(167,139,250,0.10)",
                  background: "rgba(167,139,250,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(167,139,250,0.85)" }}>{d.name}</div>
                <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.6 }}>{d.desc}</div>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 640px)  { .audio-device-grid { grid-template-columns: repeat(2, 1fr) !important; } }
            @media (min-width: 1024px) { .audio-device-grid { grid-template-columns: repeat(3, 1fr) !important; } }
          `}</style>
        </div>
      </section>

      {/* What voice mode is */}
      <section style={{ background: "#050507" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 680 }}>
          <div className="landing-kicker">how it works</div>
          <h2 className="landing-h2 landing-gradient-text">Not a feature. An interface.</h2>
          <p className="landing-body" style={{ marginBottom: 20 }}>
            Voice mode in Workshop is low-latency and conversational. It is not
            a dictation tool. You talk. Sansxel responds. You push back. It
            adjusts. The same context from your threads and projects is
            available in voice mode.
          </p>
          <p className="landing-body">
            Use it hands-free at your desk, on a walk, through headphones on
            a commute. The interface follows you.
          </p>
        </div>
      </section>

      {/* Future direction */}
      <section style={{ background: "#040406" }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 680 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 20,
              padding: "4px 12px",
              borderRadius: 100,
              border: "1px solid rgba(167,139,250,0.18)",
              background: "rgba(167,139,250,0.05)",
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              letterSpacing: "0.12em",
              color: "rgba(167,139,250,0.60)",
            }}
          >
            future direction
          </div>
          <h2 className="landing-h2 landing-gradient-text">Sansxel Audio hardware.</h2>
          <p className="landing-body" style={{ marginBottom: 16 }}>
            Voice mode today runs on the hardware you already own. The future
            direction is purpose-built Sansxel audio hardware. Earbuds and
            listening devices designed around how the AI actually works, not
            adapted from consumer audio.
          </p>
          <p className="landing-body">
            This is the direction, not a product shipping today. When it is
            ready, you will hear about it in the Discord first.
          </p>
          <a
            href="https://discord.gg/WEMgmvtDgG"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 28,
              fontSize: 13,
              color: "rgba(167,139,250,0.75)",
              textDecoration: "none",
              borderBottom: "1px solid rgba(167,139,250,0.28)",
              paddingBottom: 2,
            }}
          >
            Join the Discord for updates <span style={{ fontSize: 11 }}>→</span>
          </a>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#050507", paddingBottom: 80 }}>
        <div className="landing-divider" />
        <div className="landing-section" style={{ maxWidth: 600, textAlign: "center" }}>
          <h2 className="landing-h2 landing-gradient-text" style={{ marginBottom: 14 }}>
            Try voice in Workshop.
          </h2>
          <p className="landing-body" style={{ marginBottom: 32 }}>
            Open Workshop and tap the voice button. Your earbuds or mic
            are all you need.
          </p>
          <Link
            href={signedIn ? "/app" : getSignInPath()}
            className="landing-cta-primary"
            style={{ display: "inline-flex" }}
          >
            {signedIn ? "Open Workshop" : "Start free"}
          </Link>
        </div>
      </section>

    </main>
  );
}

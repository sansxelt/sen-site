// Hero.jsx — sign-up-screen-style hero.
// Reads as a product sign-in surface: typography on the left, a real
// interactive enrollment card on the right. The 3D device model lives
// in the background, dimmed and slow-floating behind everything, so
// the eye lands on the form first.

function Hero({ onJoin }) {
  return (
    <section id="top" style={{
      position: "relative",
      padding: "calc(var(--section-y) * 0.85) var(--gutter) calc(var(--section-y) * 0.7)",
      borderBottom: "1px solid var(--line-1)",
      overflow: "hidden",
      minHeight: "calc(100vh - 80px)",
    }}>
      {/* Background grid — anchors layout to system */}
      <BackgroundGrid />

      {/* Background 3D model — sits BEHIND the content at low opacity */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        opacity: 0.32,
        filter: "blur(0.2px)",
      }}>
        <div style={{ width: "min(1200px, 110vw)", aspectRatio: "5/4", maxHeight: "90vh" }}>
          <Glasses3D bare />
        </div>
      </div>

      {/* Soft radial vignette toward the form so the right side is
          slightly lifted */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 50% 60% at 75% 50%, rgba(92, 229, 213, 0.04) 0%, transparent 70%)",
      }} />

      {/* Foreground — type left, form right */}
      <div style={{
        position: "relative",
        maxWidth: "var(--max-content)",
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.9fr)",
        gap: "clamp(40px, 6vw, 88px)",
        alignItems: "center",
        minHeight: "70vh",
      }} className="vra-hero-grid">

        {/* LEFT — type */}
        <div style={{ position: "relative" }}>
          <h1 className="display vra-rise-2" style={{ marginBottom: 28 }}>
            A pair of glasses<br/>
            that <span className="em">remember</span><br/>
            everything you saw.
          </h1>

          <p className="vra-rise-3" style={{
            fontSize: "clamp(1rem, 1.3vw, 1.15rem)",
            color: "var(--fg-2)",
            maxWidth: 480,
            marginBottom: 36,
            lineHeight: 1.55,
          }}>
            Eight cameras ring the frame. Stereo audio reaches only the wearer. An ambient display rests over your sight. Voice and whisper recognition tuned to you — not the room.
          </p>

          <div className="vra-rise-4">
            <a href="#spec" style={{
              color: "var(--fg-2)",
              fontSize: 14,
              textDecoration: "underline",
              textUnderlineOffset: 4,
              letterSpacing: "-0.005em",
            }}>
              See the full spec
            </a>
          </div>
        </div>

        {/* RIGHT — sign-up card */}
        <div className="vra-rise-3" style={{ display: "flex", justifyContent: "center" }}>
          <SignUpCard />
        </div>
      </div>
    </section>
  );
}

function BackgroundGrid() {
  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0,
      backgroundImage: `
        linear-gradient(to right, var(--line-1) 1px, transparent 1px),
        linear-gradient(to bottom, var(--line-1) 1px, transparent 1px)
      `,
      backgroundSize: "80px 80px",
      maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 0%, transparent 75%)",
      WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 0%, transparent 75%)",
      pointerEvents: "none",
      opacity: 0.7,
    }} />
  );
}

Object.assign(window, { Hero, BackgroundGrid });

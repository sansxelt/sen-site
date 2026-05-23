// WaitlistPlate.jsx — glass slab on radial accent halo. Mirrors the
// outro panel from the source /lens page.

const { useState: useStateW } = React;

function WaitlistPlate() {
  const [email, setEmail] = useStateW("");
  const [submitted, setSubmitted] = useStateW(false);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section id="waitlist" style={{
      background: "var(--bg-2)",
      padding: "clamp(100px, 16vh, 200px) clamp(20px, 5vw, 80px)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(192,132,252,0.06) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative",
        maxWidth: 720,
        margin: "0 auto",
        textAlign: "center",
        padding: "56px 32px",
        borderRadius: 24,
        border: "1px solid var(--vio-line)",
        background: "linear-gradient(180deg, rgba(192,132,252,0.06), rgba(192,132,252,0.02))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        {submitted ? (
          <>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 999, border: "1px solid var(--ok-line)", background: "var(--ok-soft)", marginBottom: 22 }}>
              <span className="dot dot--ok"></span>
              <span className="label" style={{ color: "var(--ok)" }}>YOU'RE ON THE LIST</span>
            </div>
            <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 16 }}>
              We'll be in touch.
            </h2>
            <p className="cinematic-body" style={{ maxWidth: 480, margin: "0 auto" }}>
              When the next dev-kit window opens, you'll get an email from a real person.
            </p>
          </>
        ) : (
          <>
            <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 16 }}>
              Be first to wear Vraelis.
            </h2>
            <p className="cinematic-body" style={{ maxWidth: 480, margin: "0 auto 32px" }}>
              We will email when there is an early-access window or development-kit signup. No spam, no marketing pollution.
            </p>
            <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, maxWidth: 460, margin: "0 auto" }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid var(--vio-line)",
                  background: "rgba(0,0,0,0.4)",
                  color: "var(--fg-2)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button type="submit" style={{
                padding: "12px 22px",
                borderRadius: 10,
                border: "none",
                background: "var(--vio)",
                color: "var(--fg-on-accent)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
              }}>
                Join the waitlist
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

Object.assign(window, { WaitlistPlate });

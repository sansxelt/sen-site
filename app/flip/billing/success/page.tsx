import type { Metadata } from "next";

export const metadata: Metadata = { title: "You're Pro — Flip Engine" };

export default function FlipBillingSuccess() {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 560, textAlign: "center" }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: "50%", margin: "0 auto 20px",
            display: "grid", placeItems: "center", fontSize: 22, color: "#fff",
            background: "linear-gradient(158deg, var(--acc) 0%, var(--acc-deep) 100%)",
            boxShadow: "0 18px 40px -16px var(--acc-glow)",
          }}
        >
          ✓
        </div>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: 14 }}>
          You&apos;re <span className="em">Pro</span>.
        </h1>
        <p className="lead-copy" style={{ margin: "0 auto 30px" }}>
          Unlimited listings are unlocked. Go list everything.
        </p>
        <a href="/flip/app" className="btn btn--lg">Back to the tool <span aria-hidden>→</span></a>
      </div>
    </section>
  );
}

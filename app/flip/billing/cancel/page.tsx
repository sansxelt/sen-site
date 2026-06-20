import type { Metadata } from "next";

export const metadata: Metadata = { title: "Checkout canceled — Vraelis" };

export default function FlipBillingCancel() {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 560, textAlign: "center" }}>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: 14 }}>
          No <span className="em">worries</span>.
        </h1>
        <p className="lead-copy" style={{ margin: "0 auto 30px" }}>
          Checkout was canceled — nothing was charged. Your free listings are still here whenever you want them.
        </p>
        <a href="/flip/app" className="btn btn--ghost btn--lg">Back to the tool</a>
      </div>
    </section>
  );
}

import Link from "next/link";

// Artboard 2 — Production proof. One requirement, held across two deployments. The agent reported success;
// Vraelis observed the real browser and it Failed; a repair was independently Verified. Both records kept.
// Real lineage: 8f21ad (Failed, preserved) -> 72c98e (Verified, current).
const SIGNIN = "/signin?callbackUrl=%2Fapp";

export default function Proof() {
  return (
    <div className="ab">
      {/* ---------- DESKTOP ---------- */}
      <div className="ab-desk ab-frame ab2">
        <header className="ab-top">
          <span className="ab-wordmark">Vraelis</span>
          <Link href={SIGNIN} className="ab-cta ab-cta--top">Verify an application</Link>
        </header>

        <div className="ab2__req">
          <span className="ab-label ab2__reqlabel">The business required, held across two deployments</span>
          <h1 className="ab2__reqt">A paid customer receives Pro access and retains it after signing back in.</h1>
        </div>

        <div className="ab2__bridge">
          <span className="ab-label">One requirement, two deployments</span>
          <span className="ab2__track" aria-hidden />
          <span className="ab2__deps"><span className="ab2__dep-fail">8f21ad</span> → <span className="ab2__dep-ok">72c98e</span></span>
        </div>

        <div className="ab2__grid">
          <div className="ab2__mv ab2__mv--fail">
            <div className="ab2__beat">
              <span className="ab-label">The agent reported</span>
              <p className="ab2__say">Checkout complete.</p>
            </div>
            <div className="ab2__beat">
              <span className="ab-label">Vraelis observed</span>
              <p className="ab2__say">Payment completed. <span className="ab2__clay">The account returned to Free.</span></p>
            </div>
            <div className="ab2__verdwrap">
              <span className="ab2__verd ab2__verd--fail">Failed</span>
              <span className="ab2__rec">8f21ad · preserved</span>
            </div>
          </div>

          <div className="ab2__mv ab2__mv--ok">
            <div className="ab2__beat">
              <span className="ab-label">Repair · deployment 72c98e</span>
              <p className="ab2__say">Access granted. Session restored. Entitlement retained.</p>
            </div>
            <div className="ab2__beat">
              <span className="ab-label">Vraelis re-checked</span>
              <p className="ab2__say"><span className="ab2__ok">Pro access held</span> through a fresh sign-in.</p>
            </div>
            <div className="ab2__verdwrap">
              <span className="ab2__verd ab2__verd--ok">Verified</span>
              <span className="ab2__rec">72c98e · current</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="ab-mob ab-frame">
        <header className="ab-top">
          <span className="ab-wordmark">Vraelis</span>
          <Link href={SIGNIN} className="ab-cta ab-cta--top">Verify</Link>
        </header>
        <div className="ab2-m">
          <span className="ab-label">The business required</span>
          <h1 className="ab2-m__reqt">A paid customer receives Pro access and retains it after signing back in.</h1>

          <div className="ab2-m__mv ab2-m__mv--fail">
            <span className="ab-label">Vraelis observed, 8f21ad</span>
            <p className="ab2-m__say">Payment completed. <span className="ab2__clay">The account returned to Free.</span></p>
            <div className="ab2-m__verdwrap">
              <span className="ab2-m__verd ab2-m__verd--fail">Failed</span>
              <span className="ab2-m__rec">preserved</span>
            </div>
          </div>

          <div className="ab2-m__mv ab2-m__mv--ok">
            <span className="ab-label">Repaired and re-checked, 72c98e</span>
            <p className="ab2-m__say"><span className="ab2__ok">Pro access held</span> through a fresh sign-in.</p>
            <div className="ab2-m__verdwrap">
              <span className="ab2-m__verd ab2-m__verd--ok">Verified</span>
              <span className="ab2-m__rec">current</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

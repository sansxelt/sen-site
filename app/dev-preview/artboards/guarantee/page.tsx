import Link from "next/link";

// Artboard 3 — The Guarantee object. One durable proof instrument: a named requirement, currently Verified
// on a real deployment, approved once by a person (the building agent cannot approve its own proof), with a
// preserved record. The emerald spine is the line the agent cannot cross.
const SIGNIN = "/signin?callbackUrl=%2Fapp";

export default function Guarantee() {
  return (
    <div className="ab">
      {/* ---------- DESKTOP ---------- */}
      <div className="ab-desk ab-frame ab3">
        <header className="ab-top">
          <span className="ab-wordmark">Vraelis</span>
          <Link href={SIGNIN} className="ab-cta ab-cta--top">Verify an application</Link>
        </header>

        <div className="ab3__spine">
          <span className="ab-label ab3__spinelabel">Guarantee · standing</span>
          <div className="ab3__hist">
            <div className="ab3__node ab3__node--fail">
              <span className="ab3__node-v">Failed</span>
              <span className="ab3__node-l">8f21ad · preserved</span>
            </div>
            <div className="ab3__node ab3__node--ok">
              <span className="ab3__node-v">Verified</span>
              <span className="ab3__node-l">72c98e · current</span>
            </div>
          </div>
        </div>

        <div className="ab3__body">
          <span className="ab3__sys ab-mono">system / checkout-web</span>
          <div className="ab3__promise">
            <span className="ab-label ab3__plabel">What must remain true</span>
            <h1 className="ab3__req">A paid customer keeps Pro access after signing back in.</h1>
            <div className="ab3__status">
              <span className="ab3__verd">Verified</span>
              <span className="ab3__on">currently proven on the live<br />software, deployment 72c98e</span>
            </div>
          </div>
          <div className="ab3__record">
            <div className="ab3__field">
              <span className="ab-label">Approved, once</span>
              <p className="ab3__fval">By a person. The building agent cannot approve the standard used to judge its own work.</p>
              <span className="ab3__seal">✓ human approval, plan v1 locked</span>
            </div>
            <div className="ab3__field">
              <span className="ab-label">Reviewed proof plan</span>
              <p className="ab3__fval">Three proof obligations, expected and forbidden outcomes, checked from outside the code in a real browser.</p>
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
        <div className="ab3-m">
          <span className="ab-label" style={{ color: "var(--ok-ink)" }}>Guarantee · checkout-web</span>
          <h1 className="ab3-m__req">A paid customer keeps Pro access after signing back in.</h1>
          <div className="ab3-m__status">
            <span className="ab3-m__verd">Verified</span>
            <span className="ab3-m__on">on 72c98e</span>
          </div>
          <div className="ab3-m__record">
            <div className="ab3-m__field">
              <span className="ab-label">Approved, once</span>
              <p className="ab3-m__fval">By a person. The building agent cannot approve its own proof.</p>
            </div>
            <div className="ab3-m__field">
              <span className="ab-label">Reviewed proof plan</span>
              <p className="ab3-m__fval">Three obligations, checked in a real browser, from outside the code.</p>
            </div>
            <div className="ab3-m__field">
              <span className="ab-label">Preserved record</span>
              <p className="ab3-m__fval"><span className="ab3__fail">Failed 8f21ad</span> → <span className="ab3__ok">Verified 72c98e</span>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

// Artboard 1 — Homepage opening. A monumental thesis meets an oversized dark evidence monument: the live
// software, observed in a real browser, failing the requirement held outside it. Real lineage (8f21ad).
const SIGNIN = "/signin?callbackUrl=%2Fapp";

export default function HomeOpen() {
  return (
    <div className="ab">
      {/* ---------- DESKTOP ---------- */}
      <div className="ab-desk ab-frame ab1">
        <header className="ab-top">
          <span className="ab-wordmark">Vraelis</span>
        </header>

        <div className="ab1__left">
          <p className="ab-kicker">Independent proof for AI-built software</p>
          <h1 className="ab1__h1">AI can build<br />the software.<br /><span className="ab1__turn">It cannot prove itself.</span></h1>
          <p className="ab1__say">Vraelis keeps the requirements your company depends on outside the code, then independently proves the live software against them.</p>
          <div className="ab1__actions">
            <Link href={SIGNIN} className="ab-cta ab-cta--lg">Verify an application <span aria-hidden>→</span></Link>
            <span className="ab1__honest ab-mono">Live today for deployed web applications.</span>
          </div>
        </div>

        <aside className="ab1__mon">
          <div className="ab1__reqwrap">
            <span className="ab-label ab1__reqlabel">The requirement, held outside the code</span>
            <p className="ab1__req">A paid customer keeps Pro access after signing back in.</p>
          </div>
          <div className="ab1__evi">
            <div className="ab1__evihead">
              <span className="ab-label">Observed in a real browser</span>
              <span className="ab-mono ab1__dep">deployment 8f21ad</span>
            </div>
            <div className="ab1__rows">
              <div className="ab1__row"><span className="ab1__k">account.plan</span><span className="ab1__v ab1__v--bad">Free</span></div>
              <div className="ab1__row"><span className="ab1__k">entitlement.pro</span><span className="ab1__v ab1__v--bad">inactive</span></div>
              <div className="ab1__row"><span className="ab1__k">checkout.payment</span><span className="ab1__v">completed</span></div>
            </div>
          </div>
          <div className="ab1__punch">
            <span className="ab1__punch-l"><span className="ab1__exp">Expected</span> <b className="ab1__punch-ok">Pro.</b></span>
            <span className="ab1__punch-l"><span className="ab1__exp">Observed</span> <b className="ab1__punch-bad">Free.</b></span>
          </div>
        </aside>
      </div>

      {/* ---------- MOBILE ---------- */}
      <div className="ab-mob ab-frame">
        <header className="ab-top">
          <span className="ab-wordmark">Vraelis</span>
          <Link href={SIGNIN} className="ab-cta ab-cta--top">Verify</Link>
        </header>
        <div className="ab1-m">
          <p className="ab-kicker">Independent proof</p>
          <h1 className="ab1-m__h1">AI can build the software. <span className="ab1-m__turn">It cannot prove itself.</span></h1>
          <p className="ab1-m__say">Vraelis holds the requirements your company depends on outside the code, and proves the live software against them.</p>
          <div className="ab1-m__mon">
            <span className="ab-label ab1-m__reqlabel">Held outside the code</span>
            <p className="ab1-m__req">A paid customer keeps Pro access after signing back in.</p>
            <div className="ab1-m__evi">
              <div className="ab1__evihead"><span className="ab-label" style={{ color: "var(--dok)" }}>Observed in a real browser</span><span className="ab-mono ab1__dep">8f21ad</span></div>
              <div className="ab1-m__row"><span className="ab1-m__k">account.plan</span><span className="ab1-m__v ab1-m__v--bad">Free</span></div>
              <div className="ab1-m__row"><span className="ab1-m__k">entitlement.pro</span><span className="ab1-m__v ab1-m__v--bad">inactive</span></div>
            </div>
          </div>
          <div className="ab1-m__actions">
            <Link href={SIGNIN} className="ab-cta ab-cta--lg">Verify an application</Link>
            <span className="ab1-m__honest ab-mono">Live today for deployed web applications.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// THE HERO HAS A SUBJECT AGAIN.
//
// The opening was type on an empty graphite field, because the visual that used to sit there was cut for
// competing with the headline. That was the right call about THAT visual and the wrong outcome: measured at
// 1920x1200, the first viewport was ~1200px tall carrying four lines of text and roughly 750px of nothing.
//
// The reference for this page is Scale, and what actually carries Scale's homepage is not scroll — it is
// media. A cockpit under the headline, a rig under layered translucent frames. Type sits ON something.
//
// This repository has no photography and no video of Vraelis, and there is nothing to shoot: the product is
// a verdict about somebody else's deployment. So the subject here is the only honest one available, and it
// is a better one than stock imagery would be — THE PRODUCT'S OWN OUTPUT. A real observed browser state,
// the requirement that was claimed, and the row that did not hold.
//
// Recovered rather than invented: the readout, its four rows and the failed/verified lineage are the
// composition from public-v7 (evidence-first hero, 2026-07-23, never merged). The values are the ones that
// branch already used — a checkout that took the payment and left the account on Free.
//
// SERVER COMPONENT ON PURPOSE. No hook, no listener, no client boundary: it renders identically on the
// server and the client, so the first viewport cannot shift during hydration. Its entrance is the hero's
// own, driven by the same .v6-mask timing the headline uses.
import { Ic, I } from "@/app/rank/_components/icons";

/** The observed state that produced the verdict. From public-v7; the row that fails is the point. */
const ROWS: { k: string; v: string; ok: boolean }[] = [
  { k: "checkout.payment", v: "completed", ok: true },
  { k: "account.plan", v: "Free", ok: false },
  { k: "entitlement.pro", v: "inactive", ok: false },
  { k: "session", v: "restored", ok: true },
];

export function HeroEvidence() {
  return (
    // aria-hidden: every fact in here is stated in the hero copy beside it. A screen reader that walks this
    // panel gets a table of key/value pairs with no frame of reference, which is worse than not getting it.
    <div className="v6-he" aria-hidden>
      {/* The two empty frames behind the panel are the depth. Scale's second scene is three stacked planes
          at slightly different angles, and it is what stops a flat rectangle reading as a screenshot. */}
      <div className="v6-he__plane v6-he__plane--back" />
      <div className="v6-he__plane v6-he__plane--mid" />

      <div className="v6-he__card">
        <div className="v6-he__head">
          <span className="v6-he__lbl">Observed in a real browser</span>
          <span className="v6-he__dep">8f21ad</span>
        </div>

        <div className="v6-he__claim">
          &ldquo;A customer can upgrade to Pro and receive access immediately.&rdquo;
        </div>

        <div className="v6-he__rows">
          {ROWS.map((r) => (
            <div key={r.k} className={`v6-he__row ${r.ok ? "is-ok" : "is-bad"}`}>
              <span className="v6-he__k">{r.k}</span>
              <span className="v6-he__v">{r.v}</span>
              <span className="v6-he__mk"><Ic d={r.ok ? I.check : I.x} size={12} sw={2.7} /></span>
            </div>
          ))}
        </div>

        <div className="v6-he__foot">
          <span className="v6-he__verdict">Failed</span>
          <span className="v6-he__note">the payment completed; the plan did not change</span>
        </div>
      </div>
    </div>
  );
}

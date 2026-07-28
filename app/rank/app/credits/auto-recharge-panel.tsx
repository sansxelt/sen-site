"use client";

// AUTOMATIC TOP-UP, as a thing a customer configures rather than a thing that happens to them.
//
// This is the only surface in the product that arranges for money to move with nobody present, so the
// panel's job is not to sell it. It is to make the three numbers explicit, make the monthly ceiling
// impossible to skip, and make turning it off take one click.
//
// WHAT IS DELIBERATELY MISSING: recommended values, a "most customers choose" hint, and a pre-filled form.
// A default we picked would be this company choosing when a customer gets charged, and a suggestion is a
// default wearing a hat.
//
// The consent sentence is not decoration and not a dark pattern in reverse. Stripe requires an off-session
// charge to be traceable to an agreement, and the checkbox is what consent_at records. Unticking it is the
// same as switching the feature off, which is why they are one control and not two.
import { useEffect, useState } from "react";

type Settings = {
  enabled: boolean;
  triggerCents: number | null;
  targetCents: number | null;
  monthlyCapCents: number | null;
  hasPaymentMethod: boolean;
  paymentMethod: { type: string; label: string } | null;
  consentAt: string | null;
  consecutiveFailures: number;
  disabledReason: string | null;
  chargedThisMonthCents: number;
  recent: { at: string; kind: string; amountCents: number | null; reason: string | null }[];
};

const dollars = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));
const cents = (v: string) => Math.round(Number(v) * 100);

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };
const field: React.CSSProperties = {
  width: "100%", padding: "9px 11px", fontSize: 14, color: "var(--fg-1)", background: "var(--bg-1)",
  border: "1px solid var(--line-2)", borderRadius: 8, fontVariantNumeric: "tabular-nums",
};

export function AutoRechargePanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [trigger, setTrigger] = useState("");
  const [target, setTarget] = useState("");
  const [cap, setCap] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const load = () => fetch("/api/v/auto-recharge")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: Settings | null) => {
      if (!j) return;
      setS(j);
      setTrigger(dollars(j.triggerCents));
      setTarget(dollars(j.targetCents));
      setCap(dollars(j.monthlyCapCents));
      setConsent(!!j.consentAt && j.enabled);
    })
    .catch(() => {});

  useEffect(() => { load(); }, []);

  if (!s) return null;

  const submit = async (enabled: boolean) => {
    setBusy(true); setProblems([]); setSaved(false);
    try {
      const res = await fetch("/api/v/auto-recharge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          triggerCents: cents(trigger), targetCents: cents(target), monthlyCapCents: cents(cap),
          consent,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setProblems(Array.isArray(j?.problems) && j.problems.length ? j.problems : [j?.error || "Could not save."]); return; }
      setSaved(true);
      await load();
    } finally { setBusy(false); }
  };

  const stopped = s.consecutiveFailures >= 3;

  return (
    <section aria-label="Automatic top-up" style={{ marginTop: 30 }}>
      <div style={{ ...label, marginBottom: 12 }}>Automatic top-up</div>

      <div className="card" style={{ background: "var(--bg-1)", padding: "clamp(16px, 2.4vw, 22px)" }}>
        {/* STATE FIRST. Whether this is armed is the thing a person opening the page needs to know, and it
            was never going to be legible from three filled-in inputs. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="pill" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
            color: s.enabled ? "var(--go-ink)" : "var(--fg-4)",
            background: s.enabled ? "var(--go-wash)" : "var(--bg-2)",
            borderColor: s.enabled ? "var(--go-line)" : "var(--line-2)",
          }}>{s.enabled ? "On" : "Off"}</span>
          {s.enabled ? (
            <span style={{ fontSize: 13, color: "var(--fg-3)" }}>
              Top up to ${dollars(s.targetCents)} when the balance reaches ${dollars(s.triggerCents)}, never more than
              ${dollars(s.monthlyCapCents)} a month.
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "var(--fg-3)" }}>Your balance is never charged automatically.</span>
          )}
        </div>

        {/* NAMED, not called "your card". Stripe offers whichever methods this account has enabled that can
            be reused without the customer present, so the saved one may be PayPal or a bank account, and
            telling someone their card will be charged when it is their bank is a small lie with a real
            consequence. Read from Stripe rather than stored, so a detached method shows as gone. */}
        {s.paymentMethod ? (
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--fg-4)" }}>
            Charging <strong style={{ color: "var(--fg-2)", textTransform: "capitalize" }}>{s.paymentMethod.label}</strong>.
            {s.paymentMethod.type === "us_bank_account" || s.paymentMethod.type === "sepa_debit" ? (
              <> Bank debits take a few days to clear, so a top-up shows as pending until the money actually arrives.</>
            ) : null}
          </p>
        ) : null}

        {stopped ? (
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--stop-ink)", background: "var(--stop-wash)", border: "1px solid var(--stop-line)", borderRadius: 8, padding: "9px 12px", lineHeight: 1.55 }}>
            Automatic top-up was switched off after {s.consecutiveFailures} failed payments
            {s.disabledReason ? ` (${s.disabledReason})` : ""}. Repeated attempts against a card that is
            declining, or a bank account that keeps bouncing, gets an account flagged, so it stops rather
            than retrying. Save again to turn it back on.
          </p>
        ) : null}

        {!s.hasPaymentMethod ? (
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--wait-ink)", background: "var(--wait-wash)", border: "1px solid var(--wait-line)", borderRadius: 8, padding: "9px 12px", lineHeight: 1.55 }}>
            No saved payment method yet. Automatic top-up needs one, and nothing is saved unless you ask
            for it, so a past top-up did not leave one behind. Tick the box on your next top-up and
            whichever method you use, card, PayPal or a bank account, can be reused.
          </p>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
          <label style={{ display: "block" }}>
            <span style={{ ...label, display: "block", marginBottom: 5 }}>When balance reaches</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: 9, fontSize: 14, color: "var(--fg-4)" }}>$</span>
              <input inputMode="decimal" value={trigger} onChange={(e) => setTrigger(e.target.value)}
                style={{ ...field, paddingLeft: 22 }} placeholder="5.00" aria-label="Trigger balance in dollars" />
            </div>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ ...label, display: "block", marginBottom: 5 }}>Top up to</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: 9, fontSize: 14, color: "var(--fg-4)" }}>$</span>
              <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)}
                style={{ ...field, paddingLeft: 22 }} placeholder="50.00" aria-label="Top up to, in dollars" />
            </div>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ ...label, display: "block", marginBottom: 5 }}>Never more than, per month</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: 9, fontSize: 14, color: "var(--fg-4)" }}>$</span>
              <input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)}
                style={{ ...field, paddingLeft: 22 }} placeholder="200.00" aria-label="Monthly limit in dollars" />
            </div>
          </label>
        </div>

        {/* The ceiling gets its own sentence because it is the control that makes the rest safe, and a
            limit nobody read is a limit that only becomes real on a statement. */}
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.6 }}>
          The monthly limit is a stop, not a target. A top-up that would cross it is refused outright rather
          than reduced to fit, and nothing is charged again until the next calendar month.
          {s.chargedThisMonthCents > 0 ? <> You have been charged <strong style={{ color: "var(--fg-2)" }}>${dollars(s.chargedThisMonthCents)}</strong> automatically this month.</> : null}
        </p>

        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
            I authorise Vraelis to charge my saved payment method automatically on these terms, until I
            turn this off.
          </span>
        </label>

        {problems.length > 0 ? (
          <ul style={{ margin: "0 0 14px", padding: "10px 12px 10px 28px", fontSize: 13, color: "var(--stop-ink)", background: "var(--stop-wash)", border: "1px solid var(--stop-line)", borderRadius: 8, lineHeight: 1.55 }}>
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        ) : null}
        {saved ? <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--go-ink)" }}>Saved.</p> : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn--primary" disabled={busy || !consent} onClick={() => submit(true)}>
            {busy ? "Saving…" : s.enabled ? "Update" : "Turn on automatic top-up"}
          </button>
          {/* Off is one click and never asks the customer to confirm they meant it. Making it hard to stop
              a recurring charge is the pattern this whole panel is written against. */}
          {s.enabled ? (
            <button className="btn btn--ghost" disabled={busy} onClick={() => submit(false)}>Turn off</button>
          ) : null}
        </div>

        {s.recent.length > 0 ? (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--line-1)", paddingTop: 14 }}>
            <div style={{ ...label, marginBottom: 8 }}>Recent</div>
            <div style={{ display: "grid", gap: 5 }}>
              {/* Refusals are listed beside charges. A log of successes cannot answer "why did it not top
                  up when I expected", which is the question a customer actually opens this for. */}
              {s.recent.map((e, i) => (
                <div key={`${e.at}-${i}`} style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--fg-3)" }}>
                  <span style={{ fontFamily: "var(--font-code)", color: "var(--fg-5)" }}>{new Date(e.at).toLocaleDateString()}</span>
                  {/* A pending bank debit is neither charged nor failed, and calling it "Charged" would
                      tell someone their balance is topped up while the money has not moved. The executor
                      writes the pending reason; this reads it rather than assuming success. */}
                  <span style={{ color: e.kind === "failed" ? "var(--stop-ink)" : e.kind === "charged" && !/^pending settlement/.test(e.reason ?? "") ? "var(--go-ink)" : "var(--fg-4)" }}>
                    {e.kind === "failed" ? "Payment failed"
                      : e.kind !== "charged" ? "Not charged"
                      : /^pending settlement/.test(e.reason ?? "") ? `$${dollars(e.amountCents)} pending`
                      : `Charged $${dollars(e.amountCents)}`}
                  </span>
                  {e.reason ? <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--fg-5)" }}>{e.reason}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

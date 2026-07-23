"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Early-access plans surface. Vraelis is priced by the Production Pass ($10 base, five flows included,
// $2 per additional flow), never per seat and never in per-flow credits. The old credit-bundle tier
// ladder is retired; monthly plans (Pro / Scale) render as a NON-purchasable preview until their
// functionality and billing genuinely exist — do not wire subscription checkout here to match the mock.
// "Manage billing" stays for any account with a legacy subscription (Stripe portal).

const FUTURE_PLANS: { name: string; price: string; perks: string[] }[] = [
  { name: "Pro", price: "$99/mo", perks: ["20 verifications monthly", "Up to 10 flows per verification", "Repair verification", "Longer evidence retention", "API access"] },
  { name: "Scale", price: "$299/mo", perks: ["75 verifications monthly", "Higher limits", "Team access", "Priority execution", "Longer retention"] },
];

export default function PlansPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) setSignedIn(true); }).catch(() => {});
  }, []);

  async function manageBilling() {
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/v/portal", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (j.url) window.location.href = j.url;
      else setNote(j.error === "no_subscription" ? "No billing account yet. There is nothing to manage until your first purchase." : "Couldn't open billing. Try again.");
    } catch { setNote("Couldn't open billing. Try again."); } finally { setBusy(false); }
  }

  return (
    <div className="wrap" style={{ maxWidth: 1100, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Plans</p>
          <h1 className="display">Priced by the run, not the seat</h1>
          <p>Run your AI-built application through a real production review. Every verification includes browser execution, evidence, issue tracking, and an explainable launch decision.</p>
        </div>
        {signedIn && <button onClick={manageBilling} disabled={busy} className="btn btn--ghost">{busy ? "Opening…" : "Manage billing"}</button>}
      </div>
      {note && <p style={{ color: "var(--fg-3)", fontSize: 13, marginBottom: 14 }}>{note}</p>}

      <div className="tile-grid cols-2">
        <div className="price">
          <div className="price__name">Free</div>
          <div className="price__amt">$0</div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>One complete verification</div>
          <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Up to 3 critical flows, real-browser evidence, a full launch decision. No card required.</div>
          <ul className="price__feat">
            <li>Real-browser execution with screenshots</li>
            <li>Verified, Failed, or Blocked, with evidence</li>
          </ul>
          <Link className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }} href="/applications">Run your free verification</Link>
        </div>
        <div className="price price--hot">
          <div className="price__name">Pay as you go</div>
          <div className="price__amt">$10<small>/verification</small></div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>Includes up to 5 approved critical flows</div>
          <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>$2 per additional approved flow. Targeted reruns charge only the flows they execute.</div>
          <ul className="price__feat">
            <li>Screenshots and reproduction steps on every failure</li>
            <li>Linked failed-flow reruns after each fix</li>
            <li>No seat charge, ever</li>
          </ul>
          <Link className="btn" style={{ marginTop: "auto", justifyContent: "center" }} href="/credits">Add balance</Link>
        </div>
      </div>

      <div style={{ marginTop: 34 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <h2 className="display" style={{ fontSize: "clamp(1.2rem, 2vw, 1.5rem)", margin: 0 }}>Monthly plans are coming</h2>
          <span className="pill" style={{ fontSize: 10 }}>Preview</span>
        </div>
        <div className="tile-grid cols-2">
          {FUTURE_PLANS.map((p) => (
            <div key={p.name} className="price" style={{ opacity: 0.75 }}>
              <div className="price__name">{p.name}</div>
              <div className="price__amt">{p.price.split("/")[0]}<small>/mo</small></div>
              <ul className="price__feat">
                {p.perks.map((perk) => <li key={perk}>{perk}</li>)}
              </ul>
              <button className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center", opacity: 0.6 }} disabled>Not available yet</button>
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 28, lineHeight: 1.6, textAlign: "center", maxWidth: 620, marginInline: "auto" }}>
        Early access: accounts currently run on included balance while per-verification checkout rolls out. You are never charged for a verification that did not execute.
      </p>
    </div>
  );
}

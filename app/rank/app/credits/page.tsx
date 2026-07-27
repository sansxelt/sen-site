"use client";

import { useEffect, useState } from "react";
import { planLabel, isOnAPaidPlan } from "@/lib/plan-label";
import { passPriceCents, PASS_INCLUDED_FLOWS } from "@/lib/preflight/pass-pricing";
import Link from "next/link";

const RECOMMENDED = [9, 39, 99, 299, 999];
// $999,999 is the hard ceiling for a single Stripe charge; it's the default max.
const MIN = 5, DEFAULT_MAX = 999999, RATE = 10;

// THE PRICE IS COMPUTED, NOT TYPED. This line said "$10 per verification" while every charging path called
// passPriceCents with no options and took $15: the early-access base exists in the catalog but nothing in
// production ever passes earlyAccess, so it has never been the price anyone paid. /plans and /pricing were
// right because they derive from the same function this now uses. A price a customer reads should not be
// able to disagree with the price they are charged.
const PASS_PRICE = `${(passPriceCents(PASS_INCLUDED_FLOWS) / 100).toFixed(0)}`;

const RULES: [string, string][] = [
  ["Pays for validation runs", "Your balance covers verifying your app before it ships. Each verification draws from it and settles only when it actually executes."],
  ["Nothing ran, nothing charged", "If a run cannot start or no flow executes, the hold is returned automatically."],
  ["Per-verification pricing", `Verifications are priced per pass (${PASS_PRICE} per verification, ${PASS_INCLUDED_FLOWS} journeys included). Your balance keeps its full purchase value.`],
  ["Larger volumes", "Invoicing is available for teams that need more than a single top-up."],
];

const eyebrow = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;
const BEFORE_KEY = "vraelis:balance-before-topup";

const bigNum = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(2.1rem, 4vw, 2.7rem)", letterSpacing: "-0.03em", lineHeight: 1 } as const;

export default function CreditsPage() {
  // ONE SELECTION, STATED EXPLICITLY, WITH NO SILENT FALLBACK.
  //
  // This was two independent pieces of state — a preselected pack of 39 and a custom string — with
  // `usingCustom = custom !== ""` deciding between them. So backspacing a typo out of the custom field
  // silently re-armed the $39 pack: the input read empty, the panel beside it said "390 credits for $39",
  // and Continue charged $39. A customer typing their own number and ending up on somebody else's price is
  // the worst defect a checkout can have, and it is invisible because the page looks calm the whole time.
  //
  // Now the selection IS the state. Choosing custom keeps custom selected even when it is empty, so an empty
  // field is an INVALID selection that disables the button, never a different price.
  const [sel, setSel] = useState<{ kind: "pack"; dollars: number } | { kind: "custom"; text: string }>({ kind: "pack", dollars: 39 });
  const custom = sel.kind === "custom" ? sel.text : "";
  const amount = sel.kind === "pack" ? sel.dollars : 0;
  const setCustom = (text: string) => setSel({ kind: "custom", text });
  const setAmount = (dollars: number) => setSel({ kind: "pack", dollars });
  const [bal, setBal] = useState<number | null>(null);
  // The purchase wait. `expected` is what the ledger should gain; `settle` is what the page is allowed to
  // say about it. "waiting" is the only honest state until the webhook's write is actually visible.
  const [expected, setExpected] = useState(0);
  const [settle, setSettle] = useState<null | "waiting" | "credited" | "slow">(null);
  const [MAX, setMAX] = useState(DEFAULT_MAX);
  const [elevated, setElevated] = useState(false);
  const [plan, setPlan] = useState<string>("free");
  const [planV1, setPlanV1] = useState<string | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) { setBal(j.balance); if (typeof j.topupMax === "number") setMAX(j.topupMax); setElevated(!!j.elevatedTopup); if (j.plan) setPlan(j.plan); if (typeof j.plan_v1 === "string") setPlanV1(j.plan_v1); } }).catch(() => {});
    load();

    // WAITING FOR THE LEDGER, NOT FOR A TIMER.
    //
    // Every purchase path returns here: hosted Checkout with ?session_id, PayPal with ?paypal=1, and the
    // in-app Payment Element with ?topup=<credits>. None of them proves anything by arriving; the webhook is
    // the only authority, and its write can land after the redirect.
    //
    // This used to poll eight times and then stop saying anything, so a slow webhook left the page quietly
    // showing the OLD balance under the words "Payment received". Now it waits for a TARGET: the balance
    // recorded before checkout plus the credits bought. It only says "credited" when that number is really
    // there, and if it does not arrive it says so plainly instead of falling silent.
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const topup = Number(params?.get("topup") || 0);
    if (!params || !(params.get("session_id") || params.get("paypal") || topup > 0)) return;

    window.history.replaceState({}, "", "/credits");

    // The balance the moment before this person left for checkout. Written by go(); absent for a hosted
    // Checkout round trip, in which case any increase at all is the signal.
    const beforeRaw = typeof window !== "undefined" ? window.sessionStorage.getItem(BEFORE_KEY) : null;
    const before = beforeRaw === null ? null : Number(beforeRaw);
    const target = before !== null && topup > 0 ? before + topup : null;

    let stop = false;
    const deadline = Date.now() + 45_000;
    (async () => {
      // Announced from inside the wait rather than from the effect body: the state belongs to this
      // asynchronous piece of work, and setting it in the effect itself renders twice before anything has
      // been checked.
      setExpected(topup);
      setSettle("waiting");
      while (!stop && Date.now() < deadline) {
        const j = await fetch("/api/v/me").then((r) => r.json()).catch(() => null);
        const b = typeof j?.balance === "number" ? j.balance : null;
        if (b !== null) {
          setBal(b);
          const landed = target !== null ? b >= target : before !== null ? b > before : false;
          if (landed) { setSettle("credited"); window.sessionStorage.removeItem(BEFORE_KEY); return; }
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!stop) setSettle("slow");
    })();
    return () => { stop = true; };
  }, []);

  const usingCustom = sel.kind === "custom";
  const effective = usingCustom ? Math.floor(Number(custom) || 0) : amount;
  const valid = effective >= MIN && effective <= MAX;
  const credits = (valid ? effective : 0) * RATE;

  function go() {
    if (!valid) return;
    // The number to beat, stashed before leaving. Without it the return page can only guess whether the
    // balance it sees already includes this purchase.
    if (bal !== null) window.sessionStorage.setItem(BEFORE_KEY, String(bal));
    window.location.href = `/checkout?amount=${effective}`;
  }

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          {/* Headed by the name it is clicked by. It used to read "Top up credits", which is what you DO
              here and not what this page IS, so arriving from the account menu's "Credits" landed you on a
              heading that did not repeat the word you pressed. Topping up is still the point, and the
              button below still says so. */}
          <p className="eyebrow">Billing</p>
          <h1 className="display">Credits</h1>
          <p>Your balance pays for validating your AI-built app before it ships. Each verification draws from it and only settles when it actually executes. Per-verification pricing is rolling out; your balance keeps its full purchase value through the change.</p>
        </div>
      </div>

      {isOnAPaidPlan(planV1, plan) && (
        <div className="card" style={{ marginBottom: 22, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>You&apos;re on the <strong style={{ color: "var(--fg-1)" }}>{planLabel(planV1, plan)}</strong> plan, your monthly credits refresh automatically. Top up here only if you want extra beyond your plan.</div>
          <Link href="/plans" style={{ fontSize: 13, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>Manage plan →</Link>
        </div>
      )}

      {settle && (
        <div className="card" role="status" aria-live="polite"
          style={{ marginBottom: 22, boxShadow: "none",
            borderColor: settle === "credited" ? "var(--go-line)" : settle === "slow" ? "var(--wait-line)" : "var(--line-2)",
            background: settle === "credited" ? "var(--go-wash)" : settle === "slow" ? "var(--wait-wash)" : "var(--bg-2)" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600,
            color: settle === "credited" ? "var(--go-ink)" : settle === "slow" ? "var(--wait-ink)" : "var(--fg-2)" }}>
            {settle === "waiting" && (expected > 0 ? `Payment received. Confirming ${expected.toLocaleString()} credits…` : "Payment received. Confirming your credits…")}
            {settle === "credited" && (expected > 0 ? `${expected.toLocaleString()} credits added.` : "Your credits have been added.")}
            {settle === "slow" && "Payment received. Your credits have not appeared yet."}
          </p>
          {settle === "slow" && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55 }}>
              Nothing is lost: the payment is recorded and the balance settles from it. Reload in a minute,
              and <Link href="/contact" style={{ color: "var(--acc-deep)" }}>tell us</Link> if it is still missing.
            </p>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 18, alignItems: "start" }} className="cols-stack">
        {/* picker */}
        <div className="card">
          <div style={eyebrow}>Recommended packs</div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 26 }}>
            {RECOMMENDED.map((a) => {
              const on = !usingCustom && amount === a;
              return (
                <button key={a} onClick={() => setAmount(a)} style={{ flex: "0 1 150px", textAlign: "center", padding: "16px 14px", borderRadius: "var(--r-lg)", cursor: "pointer", border: `1.5px solid ${on ? "var(--acc-line-2)" : "var(--line-2)"}`, background: on ? "var(--acc-soft)" : "var(--bg-1)", boxShadow: on ? "0 0 0 3px var(--acc-soft)" : "var(--shadow-sm)", transition: "all .15s ease" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 21, color: on ? "var(--acc-deep)" : "var(--fg-1)" }}>${a.toLocaleString()}</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>{(a * RATE).toLocaleString()} credits</div>
                </button>
              );
            })}
          </div>

          <div className="field">
            <span className="lbl">Or a custom amount</span>
            <div style={{ position: "relative", maxWidth: 440 }}>
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: "var(--fg-4)" }}>$</span>
              <input type="text" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="0"
                style={{ width: "100%", boxSizing: "border-box", padding: "16px 16px 16px 36px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, outline: "none" }} />
            </div>
            {!valid && usingCustom && <span style={{ color: "var(--err)", fontSize: 12.5 }}>Enter an amount between ${MIN} and ${MAX.toLocaleString()}.</span>}
            <span className="hint">Min ${MIN}, max ${MAX.toLocaleString()} per top-up.</span>
            {elevated && (
              <p style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 8, lineHeight: 1.55 }}>Need more than ${MAX.toLocaleString()} in one go? A single payment tops out here, but we can invoice you for larger volumes (including unlimited credit for enterprise programs). <Link href="/contact" style={{ color: "var(--acc-deep)" }}>Contact us for an invoice →</Link></p>
            )}
          </div>
        </div>

        {/* right column, balance above, you'll receive below, matched size */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="sticky-side">
          <div className="card" style={{ minHeight: 214, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={eyebrow}>Your balance</div>
              <div style={{ ...bigNum, color: "var(--fg-1)" }}>{bal !== null ? bal.toLocaleString() : "-"}</div>
              <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 6 }}>credits available</div>
            </div>
            <Link href="/billing" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none", fontWeight: 500, marginTop: 16 }}>View credit activity →</Link>
          </div>

          <div className="card" style={{ minHeight: 214, borderColor: "var(--acc-line)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={eyebrow}>You&apos;ll receive</div>
              <div style={{ ...bigNum, color: valid ? "var(--acc-deep)" : "var(--fg-4)" }}>{credits.toLocaleString()}</div>
              <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 6 }}>credits for ${valid ? effective.toLocaleString() : "0"}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button onClick={go} disabled={!valid} className="btn btn--lg" style={{ width: "100%", justifyContent: "center", opacity: valid ? 1 : 0.55 }}>Continue to checkout <span aria-hidden>→</span></button>
              <p style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>Secure checkout on Vraelis, payments processed by Stripe.</p>
            </div>
          </div>
        </div>
      </div>

      {/* rules */}
      <div style={{ marginTop: 30 }}>
        <div style={eyebrow}>How your balance works</div>
        <div className="tile-grid cols-4">
          {RULES.map(([t, d]) => (
            <div key={t} className="acard" style={{ gap: 6 }}>
              <div className="acard__t" style={{ fontSize: 14.5 }}>{t}</div>
              <div className="acard__d">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

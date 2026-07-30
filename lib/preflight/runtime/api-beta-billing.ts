// Shared billing for the API-beta customer path. The SAME authoritative pricing/hold/refund the web run route
// uses (gatePassLaunch / hold / refund / passPriceCents / estimateRunCredits) — pricing is FROZEN and
// runtime-agnostic (it takes only a flow count), so an API run of N flows costs exactly what a web run of N
// flows costs. Preview and launch call the SAME priceApiLaunch(), so the previewed price can never diverge
// from the charge. Settlement is SYNCHRONOUS here (the inline executor tells us whether productive work
// happened) instead of by the Railway worker.

import { randomUUID } from "node:crypto";
import { hold, refund } from "@/lib/v-credits";
import { estimateRunCredits } from "@/lib/preflight/flow-selection";
import { passPricingEnabled, passPriceCents, rerunPriceCents } from "@/lib/preflight/pass-pricing";
import { gatePassLaunch } from "@/lib/preflight/entitlements-v1";

// What the customer sees before launch. Mirrors the web pass-preview decision modes.
export type ApiPrice =
  | { mode: "payg"; cents: number; label: string }
  | { mode: "free"; label: string }
  | { mode: "subscription"; label: string }
  | { mode: "legacy"; credits: number; label: string }
  | { mode: "blocked"; error: string; status: number; message: string };

// The single price source for BOTH preview and launch. Never mutates. `rerun` picks the (capped) rerun price.
//
// API-BETA BILLING RULE (founder constraint: "API usage cannot consume or certify web coverage"): an API run
// is ALWAYS a per-run charge (PAYG cents when pass-pricing is on, legacy credits when off). It NEVER draws on
// the web subscription allowance and NEVER consumes the lifetime web free pass — so a subscriber can't run
// unlimited free API passes, and no API run can burn the web free pass a web launch depends on. We still call
// gatePassLaunch ONLY to honor a hard account block (frozen/disputed billing); we ignore its free/subscription
// modes for the API path and always price the run itself.
export async function priceApiLaunch(owner: string, flowCount: number, opts: { rerun?: boolean } = {}): Promise<ApiPrice> {
  if (!passPricingEnabled()) {
    const credits = estimateRunCredits(flowCount);
    return { mode: "legacy", credits, label: `${credits} credit${credits === 1 ? "" : "s"}` };
  }
  const gate = await gatePassLaunch(owner, flowCount, opts);
  // Only a HARD refusal (frozen/disputed billing) blocks; free/subscription/payg all price as a per-run PAYG
  // charge for the API path. A frozen account returns ok:false and is surfaced as blocked.
  if (!gate.ok && gate.mode === "frozen") return { mode: "blocked", error: gate.error, status: gate.status, message: gate.message };
  const cents = opts.rerun ? rerunPriceCents(flowCount) : passPriceCents(flowCount);
  return { mode: "payg", cents, label: `$${(cents / 100).toFixed(2)}` };
}

// A held reservation for one launch attempt. `settle()` charges (keeps) or refunds based on the executor's
// verdict; call it EXACTLY once after execution. `release()` refunds unconditionally (use on a pre-execution
// error after the hold). A subscription/free launch has no hold to settle (creditsHeld 0).
export type ApiHold = {
  reservationId: string;
  creditsHeld: number;                 // in the hold's own unit (cents for payg, credits for legacy); 0 for free/sub
  settle(chargedFullHold: boolean): Promise<void>;
  release(): Promise<void>;
};

// Take the hold for a launch, using the SAME price the preview showed. Returns a 402-style refusal if the
// balance can't cover a payg/legacy hold. free/subscription take no hold. The caller must call settle() once
// after the executor returns (chargedFullHold=true => keep as the charge; false => refund), or release() on a
// pre-execution failure.
export async function takeApiHold(owner: string, price: ApiPrice): Promise<{ ok: true; hold: ApiHold } | { ok: false; status: number; error: string; message: string }> {
  const reservationId = randomUUID();
  const noop: ApiHold = { reservationId, creditsHeld: 0, async settle() {}, async release() {} };

  if (price.mode === "blocked") return { ok: false, status: price.status, error: price.error, message: price.message };
  if (price.mode === "free" || price.mode === "subscription") return { ok: true, hold: noop };

  const amount = price.mode === "payg" ? price.cents : price.credits;
  const unit = price.mode === "payg" ? ("cent" as const) : undefined;
  const ok = unit ? await hold(owner, reservationId, amount, unit) : await hold(owner, reservationId, amount);
  if (!ok) {
    // The payg branch holds 'cent' (line above) while every top-up path mints 'credit', so "Add balance"
    // named an action that cannot clear this refusal. Same correction as accept-run.ts, which carries the
    // full note on why the denomination fix is a migration and not an edit. The credit branch is unchanged:
    // there, adding balance genuinely does resolve it.
    const msg = price.mode === "payg"
      ? `This run costs $${(amount / 100).toFixed(2)}. Paid runs aren't self-serve yet — contact us and we'll enable them on your account.`
      : "You do not have enough credits to launch this run.";
    return { ok: false, status: 402, error: price.mode === "payg" ? "insufficient_balance" : "insufficient_credits", message: msg };
  }
  const held: ApiHold = {
    reservationId, creditsHeld: amount,
    // On productive work: KEEP the hold (retaining it IS the charge, exactly like a completed web run — no
    // positive ledger write). On no productive work / infra: REFUND the full hold.
    async settle(chargedFullHold: boolean) { if (!chargedFullHold) await refund(owner, reservationId, amount); },
    async release() { await refund(owner, reservationId, amount); },
  };
  return { ok: true, hold: held };
}

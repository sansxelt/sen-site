"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { billingAddons, isOneTimeBoost, planIncludesAddon, pricingPlans } from "../lib/pricing";
import type { BillingState } from "../lib/billing-state";
import { UpdatePaymentMethodModal } from "./update-payment-method-modal";
import { BuyCreditsModal } from "./buy-credits-modal";
import { PayPalAddonButton, PayPalAddonsProvider } from "./paypal-addon-button";
// 3D tilt removed, billing/payment surfaces shouldn't feel "playful";
// users want them to read as steady and trustworthy.

// Which sections of the panel to render. Pass a narrow list when
// rendering a focused page (/account/plan, /account/addons,
// /account/credits) so each shop entry actually does what its
// label says. Default = all sections, preserving the legacy
// /account/billing one-pager URL.
export type BillingSection =
  | "payment"
  | "plan"
  | "addons"
  | "credits"
  | "invoices";

type Props = {
  state: BillingState;
  publishableKey: string;
  sections?: BillingSection[];
};

type UsageSummary = {
  balance: number;
  weekly: {
    chat: { used: number; cap: number | null; lifted: boolean };
    image: { used: number; cap: number | null; lifted: boolean };
    voice_seconds: { used: number; cap: number | null; lifted: boolean };
    reset_iso: string;
  };
  boosts: { session: number; weekly: number };
};

function formatCap(used: number, cap: number | null, lifted: boolean): string {
  if (lifted) return `${used.toLocaleString()} · unlimited`;
  if (cap === null) return `${used.toLocaleString()} · unlimited`;
  return `${used.toLocaleString()} / ${cap.toLocaleString()}`;
}

function formatVoiceCap(used: number, cap: number | null, lifted: boolean): string {
  const usedMin = Math.round(used / 60);
  if (lifted) return `${usedMin} min · unlimited`;
  if (cap === null) return `${usedMin} min · unlimited`;
  return `${usedMin} / ${Math.round(cap / 60)} min`;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

const ALL_SECTIONS: BillingSection[] = [
  "payment",
  "plan",
  "addons",
  "credits",
  "invoices",
];

export function BillingPanel({ state, publishableKey, sections }: Props) {
  const visible = new Set<BillingSection>(sections ?? ALL_SECTIONS);
  const showSection = (key: BillingSection) => visible.has(key);
  const router = useRouter();
  const [busy, setBusy]   = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pmOpen, setPmOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  // Combined balance + weekly usage + boost counts so the Credits
  // section can show the user's whole usage picture in one place.
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  // NEXT_PUBLIC_* vars are inlined at build time, safe to read on client.
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

  const loadUsage = async () => {
    try {
      const res = await fetch("/api/account/billing/usage-summary", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as UsageSummary;
      setUsage(data);
    } catch {
      // ignore, display "—"
    }
  };
  useEffect(() => { void loadUsage(); }, []);

  async function post(path: string, body?: unknown) {
    const res = await fetch(path, {
      method:  "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body:    body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Something went wrong." }));
      throw new Error((data as { error?: string }).error ?? "Something went wrong.");
    }
  }

  async function handleCancel() {
    setBusy("cancel");
    setError(null);
    try {
      await post("/api/account/billing/cancel");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not cancel."); }
    finally { setBusy(null); }
  }

  async function handleResume() {
    setBusy("resume");
    setError(null);
    try {
      await post("/api/account/billing/cancel?undo=true");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not resume."); }
    finally { setBusy(null); }
  }

  async function handleRemoveAddon(addonKey: string) {
    setBusy(`remove-${addonKey}`);
    setError(null);
    try {
      await post("/api/account/billing/remove-addon", { addonKey });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove addon."); }
    finally { setBusy(null); }
  }

  async function handleAddAddon(addonKey: string) {
    setBusy(`add-${addonKey}`);
    setError(null);
    try {
      await post("/api/stripe/payment-intent", { addonKey, cycle: state.cycle ?? "monthly" });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add addon."); }
    finally { setBusy(null); }
  }

  const hasPlan = Boolean(state.plan);
  const activeAddonKeys = new Set(state.activeAddons.map((a) => a.addon.key));
  // v0.2.0 phase G+ — one-time boosts (Session Boost / Weekly Boost)
  // were redundant with the credit ledger ($5 = 500 chats either way)
  // and confused the pricing story. Hide the buy buttons; the
  // consume path stays active in plan-limits so any rows already
  // sitting in boost_credits keep working until they're spent.
  const availableAddons = billingAddons.filter(
    (a) => !activeAddonKeys.has(a.key) && !isOneTimeBoost(a.key),
  );

  // v0.1.13 \u2014 3D tilt on each billing section so the "main changing UI"
  // matches the heist-style 3D affordance the rest of the marketing
  // surfaces have. Mouse-only; touch falls through.

  return (
    <div className="space-y-4 sm:space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200 sm:p-4">
          {error}
        </div>
      )}

      {/* ── Payment method (TOP, so a card is on file before any
            buy click). Card-required addons + plan upgrades all
            check this section first; PayPal one-offs route through
            their own buttons next to each addon and don't need
            anything here. ───────────────────────────────────────── */}
      {showSection("payment") && (
      <section
        className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
              Payment method
            </div>
            {state.paymentMethod ? (
              <div className="mt-1.5 text-sm text-white sm:mt-2">
                <span className="font-medium uppercase">{state.paymentMethod.brand}</span>{" "}
                ending in {state.paymentMethod.last4}
                <span className="ml-1.5 block text-xs text-neutral-400 sm:ml-2 sm:inline">
                  expires {String(state.paymentMethod.expMonth).padStart(2, "0")}/{state.paymentMethod.expYear}
                </span>
              </div>
            ) : (
              <div className="mt-1.5 text-sm text-neutral-500 sm:mt-2">
                No card on file. Add one to subscribe or grab a card-only addon. PayPal one-offs work without a saved card.
              </div>
            )}
          </div>
          {publishableKey && (
            <button
              type="button"
              onClick={() => setPmOpen(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              {state.paymentMethod ? "Update card" : "Add card"}
            </button>
          )}
        </div>
      </section>
      )}

      {/* ── Current plan ────────────────────────────────────────────── */}
      {showSection("plan") && (
      <section
        className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
              Current plan
            </div>
            <div className="mt-1.5 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">
              {state.plan?.name ?? "Free"}
            </div>
            <div className="mt-0.5 text-xs text-neutral-400 sm:mt-1 sm:text-sm">
              {state.cycle === "yearly" ? "Yearly billing" : state.cycle === "monthly" ? "Monthly billing" : "No billing active"}
            </div>
          </div>
          {hasPlan && state.cancelAtPeriodEnd && (
            <span className="whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-medium text-amber-300 sm:text-xs">
              Cancels {formatDate(state.currentPeriodEnd)}
            </span>
          )}
        </div>

        {hasPlan && (() => {
          // v0.1.13 \u2014 Comped accounts (plan in our DB but no Stripe sub)
          // were showing misleading "Renews \u2014" with an em-dash. Show
          // honest copy depending on actual state:
          //   active     \u2192 Renews <date>
          //   cancelling \u2192 Expires <date>
          //   comped     \u2192 No expiry \u00b7 comped
          const isCancelling = state.cancelAtPeriodEnd;
          const isComped =
            !state.stripeSubscriptionId && !state.currentPeriodEnd;
          const renewLabel = isCancelling ? "Expires" : "Renews";
          const renewValue = isComped
            ? "No expiry \u00b7 comped"
            : formatDate(state.currentPeriodEnd);
          return (
            <div className="mt-4 grid gap-3 text-sm text-neutral-300 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Price</div>
                <div className="mt-1">
                  {isComped
                    ? "$0 \u00b7 comped"
                    : state.cycle === "yearly"
                      ? state.plan?.yearlyLabel ?? state.plan?.monthlyLabel
                      : state.plan?.monthlyLabel}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">{renewLabel}</div>
                <div className="mt-1">{renewValue}</div>
              </div>
            </div>
          );
        })()}

        <div className="mt-6 flex flex-wrap gap-3">
          {!hasPlan ? (
            <Link
              href="/pricing"
              className="VRAELIS-white-button rounded-2xl bg-white px-5 py-2.5 text-sm font-medium transition hover:opacity-90"
              style={{ color: "#0a0a0c" }}
            >
              Choose a plan
            </Link>
          ) : (
            <>
              <ChangePlanSelect
                currentPlanKey={state.plan!.key}
                currentCycle={state.cycle ?? "monthly"}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
              />
              {/* v0.1.13 \u2014 Comped users (no real Stripe sub) saw a
                  "Cancel subscription" button that did nothing. Hide it
                  when there's no sub to cancel; show "Activate billing"
                  instead so they can convert to a real paying customer. */}
              {!state.stripeSubscriptionId ? (
                <Link
                  href="/pricing"
                  className="rounded-2xl bg-white px-5 py-2.5 text-sm font-medium transition hover:opacity-90"
                  style={{ color: "#0a0a0c" }}
                >
                  {"Start paying \u2014 unlock annual + invoices"}
                </Link>
              ) : state.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={busy === "resume"}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {busy === "resume" ? "Resuming\u2026" : "Resume subscription"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy === "cancel"}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {busy === "cancel" ? "Canceling\u2026" : "Cancel subscription"}
                </button>
              )}
            </>
          )}
        </div>
      </section>
      )}

      {/* ── Addons ─────────────────────────────────────────────────── */}
      {/* Always rendered. Was gated on hasPlan, which made the section
          invisible to Free users even though several addons are
          available regardless of plan tier. The section itself shows
          a "No addons available" empty state when there's nothing to
          surface, so leaving it always-on is safe. */}
      {showSection("addons") && (
        <section
          className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6"
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
            Addons
          </div>
          <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
            {state.activeAddons.length === 0 && availableAddons.length === 0 ? (
              <div className="text-sm text-neutral-500">No addons available.</div>
            ) : (
              <PayPalAddonsProvider clientId={paypalClientId || ""}>
                {state.activeAddons.map(({ addon }) => (
                  <div key={addon.key} className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-white">{addon.name}</div>
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                          Active
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">{addon.description}</div>
                      <div className="mt-1 text-xs font-medium text-neutral-300">{addon.monthlyLabel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAddon(addon.key)}
                      disabled={busy === `remove-${addon.key}`}
                      className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200 disabled:opacity-60"
                    >
                      {busy === `remove-${addon.key}` ? "Removing…" : "Remove"}
                    </button>
                  </div>
                ))}
                {availableAddons.map((addon) => {
                  const ownedViaPlan = planIncludesAddon(state.plan?.key, addon.key);
                  return (
                    <div
                      key={addon.key}
                      className={`flex flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${
                        ownedViaPlan
                          ? "border-emerald-400/25 bg-emerald-400/[0.04]"
                          : "border-white/10 bg-black/20 hover:border-white/20"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-white">{addon.name}</div>
                          {ownedViaPlan && (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                              Owned with {state.plan?.name ?? "your plan"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-neutral-400">{addon.description}</div>
                        <div className="mt-1 text-xs font-medium text-neutral-300">{addon.monthlyLabel}</div>
                      </div>
                      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-40">
                        {ownedViaPlan ? (
                          <span className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-center text-xs font-semibold text-emerald-300">
                            ✓ Included
                          </span>
                        ) : (
                          <>
                            {(() => {
                              const oneTime = isOneTimeBoost(addon.key);
                              const hasCard = Boolean(state.paymentMethod);
                              // One-time boosts (Session / Weekly) only
                              // need a card on file, no plan required.
                              // Recurring addons modify an existing
                              // subscription, so they still need a plan.
                              const cardEligible = oneTime ? hasCard : hasPlan;
                              const cardTitle = oneTime
                                ? hasCard
                                  ? `Charges $${addon.monthlyValue} to your card on file`
                                  : "Add a card first to buy this with card"
                                : hasPlan
                                  ? "Add via card (modifies your existing subscription)"
                                  : "Subscribe to a plan first to add addons via card";
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAddAddon(addon.key)}
                                    disabled={
                                      busy === `add-${addon.key}` || !cardEligible
                                    }
                                    className="w-full rounded-xl bg-white px-4 py-1.5 text-center text-xs font-semibold transition hover:opacity-90 disabled:opacity-60"
                                    style={{ color: "#0a0a0c" }}
                                    title={cardTitle}
                                  >
                                    {busy === `add-${addon.key}`
                                      ? "Buying…"
                                      : oneTime
                                        ? `Buy with card · $${addon.monthlyValue}`
                                        : "Add with card"}
                                  </button>
                                  {paypalClientId && addon.monthlyValue > 0 && (
                                    <PayPalAddonButton
                                      addonKey={addon.key}
                                      addonName={addon.name}
                                      amountUsd={addon.monthlyValue}
                                      onActivated={() => router.refresh()}
                                    />
                                  )}
                                  {!cardEligible && (
                                    <p className="text-[11px] leading-snug text-neutral-500">
                                      {oneTime
                                        ? "Add a card at the top of this page, or use PayPal."
                                        : "Card addons need an active plan. Subscribe first or use PayPal."}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </PayPalAddonsProvider>
            )}
          </div>
        </section>
      )}

      {/* ── Credits + usage ────────────────────────────────────────── */}
      {showSection("credits") && (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
              Credits & usage
            </div>
            <div className="mt-1.5 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">
              {usage === null ? "—" : `${usage.balance.toLocaleString()} credits`}
            </div>
            <div className="mt-0.5 text-xs text-neutral-400 sm:mt-1 sm:text-sm">
              $1 = 100 credits · burns when you exceed your weekly cap
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCreditsOpen(true)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            Top up
          </button>
        </div>

        {usage && (
          <>
            {/* Weekly usage breakdown, chat / image / voice with the
                user's plan caps. "Unlimited" pill replaces the cap
                when an addon (or the plan) lifts the cap. */}
            <div className="mt-5 grid gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3">
              <UsageCell
                label="Chat this week"
                value={formatCap(usage.weekly.chat.used, usage.weekly.chat.cap, usage.weekly.chat.lifted)}
                lifted={usage.weekly.chat.lifted || usage.weekly.chat.cap === null}
              />
              <UsageCell
                label="Images this week"
                value={formatCap(usage.weekly.image.used, usage.weekly.image.cap, usage.weekly.image.lifted)}
                lifted={usage.weekly.image.lifted || usage.weekly.image.cap === null}
              />
              <UsageCell
                label="Voice this week"
                value={formatVoiceCap(usage.weekly.voice_seconds.used, usage.weekly.voice_seconds.cap, usage.weekly.voice_seconds.lifted)}
                lifted={usage.weekly.voice_seconds.lifted || usage.weekly.voice_seconds.cap === null}
              />
            </div>
            {(usage.boosts.session > 0 || usage.boosts.weekly > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Boosts ready</span>
                {usage.boosts.session > 0 && (
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.06] px-2.5 py-0.5 text-amber-200/90">
                    {usage.boosts.session}× Session Boost
                  </span>
                )}
                {usage.boosts.weekly > 0 && (
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.06] px-2.5 py-0.5 text-amber-200/90">
                    {usage.boosts.weekly}× Weekly Boost
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </section>
      )}

      {/* ── Invoices ───────────────────────────────────────────────── */}
      {showSection("invoices") && state.invoices.length > 0 && (
        <section
          className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6"
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
            Recent invoices
          </div>
          <div className="mt-3 divide-y divide-white/5 sm:mt-4">
            {state.invoices.map((invoice) => (
              <div key={invoice.number ?? invoice.date} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">
                    {invoice.number ?? "Invoice"} · {formatMoney(invoice.amountDue, invoice.currency)}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {formatDate(invoice.date)} · {invoice.status ?? "—"}
                  </div>
                </div>
                {invoice.pdfUrl && (
                  <a
                    href={invoice.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-neutral-300 underline underline-offset-4 hover:text-white"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {pmOpen && publishableKey && (
        <UpdatePaymentMethodModal
          publishableKey={publishableKey}
          onClose={() => setPmOpen(false)}
          onSuccess={() => {
            setPmOpen(false);
            router.refresh();
          }}
        />
      )}

      {creditsOpen && publishableKey && (
        <BuyCreditsModal
          publishableKey={publishableKey}
          onClose={() => setCreditsOpen(false)}
          onSuccess={() => {
            setCreditsOpen(false);
            // Webhook lands the balance update, give it a moment,
            // then re-poll. Refresh router too so any other panels
            // that read account state get fresh data.
            window.setTimeout(() => { void loadUsage(); router.refresh(); }, 1500);
          }}
        />
      )}
    </div>
  );
}

function UsageCell({ label, value, lifted }: { label: string; value: string; lifted: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-sm font-medium ${lifted ? "text-emerald-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function ChangePlanSelect({
  busy, currentCycle, currentPlanKey, setBusy, setError,
}: {
  busy: string | null;
  currentCycle: "monthly" | "yearly";
  currentPlanKey: string;
  setBusy: (v: string | null) => void;
  setError: (v: string | null) => void;
}) {
  const router = useRouter();
  const selectablePlans = pricingPlans.filter(
    (p) =>
      !p.hidden &&
      p.key !== "free" &&
      p.key !== "enterprise" &&
      p.key !== "teams",
  );
  const [cycle, setCycle] = useState<"monthly" | "yearly">(currentCycle);

  async function handleChange(planKey: string) {
    if (planKey === currentPlanKey && cycle === currentCycle) return;
    setBusy(`change-${planKey}`);
    setError(null);
    try {
      const res = await fetch("/api/account/billing/change-plan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planKey, cycle }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Could not change plan." }));
        throw new Error((data as { error?: string }).error ?? "Could not change plan.");
      }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not change plan."); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* v0.1.13 \u2014 cycle pill text-black was being out-cascaded so the
          ACTIVE label rendered white-on-white (invisible). Inline style
          forces dark text on the white-bg active state regardless of
          cascade order. */}
      <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setCycle("monthly")}
          className={`rounded-full px-3 py-1 transition ${cycle === "monthly" ? "bg-white" : "text-neutral-400 hover:text-white"}`}
          style={cycle === "monthly" ? { color: "#0a0a0c" } : undefined}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setCycle("yearly")}
          className={`rounded-full px-3 py-1 transition ${cycle === "yearly" ? "bg-white" : "text-neutral-400 hover:text-white"}`}
          style={cycle === "yearly" ? { color: "#0a0a0c" } : undefined}
        >
          Yearly
        </button>
      </div>
      {selectablePlans.map((plan) => {
        const isCurrent = plan.key === currentPlanKey && cycle === currentCycle;
        return (
          <button
            key={plan.key}
            type="button"
            disabled={isCurrent || busy === `change-${plan.key}`}
            onClick={() => handleChange(plan.key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              isCurrent
                ? "border border-white/20 bg-white/10 text-white"
                : "border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {busy === `change-${plan.key}` ? "…" : isCurrent ? `${plan.name} (current)` : plan.name}
          </button>
        );
      })}
    </div>
  );
}

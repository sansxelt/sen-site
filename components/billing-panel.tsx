"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { billingAddons, pricingPlans } from "../lib/pricing";
import type { BillingState } from "../lib/billing-state";
import { UpdatePaymentMethodModal } from "./update-payment-method-modal";

type Props = {
  state: BillingState;
  publishableKey: string;
};

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

export function BillingPanel({ state, publishableKey }: Props) {
  const router = useRouter();
  const [busy, setBusy]   = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pmOpen, setPmOpen] = useState(false);

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
  const availableAddons = billingAddons.filter((a) => !activeAddonKeys.has(a.key));

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* ── Current plan ────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
              Current plan
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {state.plan?.name ?? "Free"}
            </div>
            <div className="mt-1 text-sm text-neutral-400">
              {state.cycle === "yearly" ? "Yearly billing" : state.cycle === "monthly" ? "Monthly billing" : "No billing active"}
            </div>
          </div>
          {hasPlan && state.cancelAtPeriodEnd && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
              Cancels {formatDate(state.currentPeriodEnd)}
            </span>
          )}
        </div>

        {hasPlan && (
          <div className="mt-4 grid gap-3 text-sm text-neutral-300 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Price</div>
              <div className="mt-1">
                {state.cycle === "yearly"
                  ? state.plan?.yearlyLabel ?? state.plan?.monthlyLabel
                  : state.plan?.monthlyLabel}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Renews</div>
              <div className="mt-1">{formatDate(state.currentPeriodEnd)}</div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {!hasPlan ? (
            <Link
              href="/pricing"
              className="sansxel-white-button rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90"
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
              {state.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={busy === "resume"}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  {busy === "resume" ? "Resuming…" : "Resume subscription"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy === "cancel"}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {busy === "cancel" ? "Canceling…" : "Cancel subscription"}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Addons ─────────────────────────────────────────────────── */}
      {hasPlan && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
            Addons
          </div>
          <div className="mt-4 space-y-3">
            {state.activeAddons.length === 0 && availableAddons.length === 0 ? (
              <div className="text-sm text-neutral-500">No addons available.</div>
            ) : (
              <>
                {state.activeAddons.map(({ addon }) => (
                  <div key={addon.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <div className="text-sm font-medium text-white">{addon.name}</div>
                      <div className="mt-0.5 text-xs text-neutral-400">{addon.monthlyLabel} — active</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAddon(addon.key)}
                      disabled={busy === `remove-${addon.key}`}
                      className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {busy === `remove-${addon.key}` ? "Removing…" : "Remove"}
                    </button>
                  </div>
                ))}
                {availableAddons.map((addon) => (
                  <div key={addon.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <div className="text-sm font-medium text-white">{addon.name}</div>
                      <div className="mt-0.5 text-xs text-neutral-400">{addon.monthlyLabel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddAddon(addon.key)}
                      disabled={busy === `add-${addon.key}`}
                      className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:opacity-90 disabled:opacity-60"
                    >
                      {busy === `add-${addon.key}` ? "Adding…" : "Add"}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── Payment method ─────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
              Payment method
            </div>
            {state.paymentMethod ? (
              <div className="mt-2 text-sm text-white">
                <span className="font-medium uppercase">{state.paymentMethod.brand}</span>{" "}
                ending in {state.paymentMethod.last4}
                <span className="ml-2 text-xs text-neutral-400">
                  expires {String(state.paymentMethod.expMonth).padStart(2, "0")}/{state.paymentMethod.expYear}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-neutral-500">No payment method on file.</div>
            )}
          </div>
          {publishableKey && (
            <button
              type="button"
              onClick={() => setPmOpen(true)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              {state.paymentMethod ? "Update card" : "Add card"}
            </button>
          )}
        </div>
      </section>

      {/* ── Invoices ───────────────────────────────────────────────── */}
      {state.invoices.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
            Recent invoices
          </div>
          <div className="mt-4 divide-y divide-white/5">
            {state.invoices.map((invoice) => (
              <div key={invoice.number ?? invoice.date} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm text-white">
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
  const selectablePlans = pricingPlans.filter((p) =>
    p.key !== "free" && p.key !== "enterprise" && p.key !== "teams",
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
      <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setCycle("monthly")}
          className={`rounded-full px-3 py-1 transition ${cycle === "monthly" ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setCycle("yearly")}
          className={`rounded-full px-3 py-1 transition ${cycle === "yearly" ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}
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

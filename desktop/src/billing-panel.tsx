import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  cancelDesktopSubscription,
  changeDesktopPlan,
  createDesktopBillingIntent,
  createDesktopSetupIntent,
  removeDesktopAddon,
  updateDesktopPaymentMethod,
  type BillingAddonSummary,
  type BillingCycle,
  type BillingPlanSummary,
  type DesktopBillingState,
  type PricingPlanKey,
} from "./billing-api";

const stripePromiseCache = new Map<string, Promise<StripeJs | null>>();
function stripePromise(key: string): Promise<StripeJs | null> {
  let cached = stripePromiseCache.get(key);
  if (!cached) {
    cached = loadStripe(key);
    stripePromiseCache.set(key, cached);
  }
  return cached;
}

type BillingPanelProps = {
  token: string;
  billing: DesktopBillingState;
  onRefresh: () => Promise<void> | void;
};

export function DesktopBillingPanel({
  token,
  billing,
  onRefresh,
}: BillingPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlanSummary | null>(null);
  const [checkoutCycle, setCheckoutCycle] = useState<BillingCycle>(
    billing.state.cycle ?? "monthly",
  );
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const currentPlanKey = billing.state.planKey ?? billing.currentPlanKey;
  const hasPaidPlan = currentPlanKey !== "free";
  const personalPlans = billing.plans.filter(
    (plan) => plan.key === "free" || plan.key === "apprentice" || plan.key === "studio" || plan.key === "pro",
  );
  const activeAddonKeys = new Set(
    billing.state.activeAddons.map(({ addon }) => addon.key),
  );
  const availableAddons = billing.addons.filter(
    (addon) => !activeAddonKeys.has(addon.key),
  );

  async function refreshWithReset() {
    setError(null);
    await onRefresh();
  }

  async function handlePlanChange(planKey: PricingPlanKey, cycle: BillingCycle) {
    setBusy(`plan-${planKey}-${cycle}`);
    setError(null);
    try {
      await changeDesktopPlan(token, { planKey, cycle });
      await refreshWithReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change plan.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel(undo = false) {
    setBusy(undo ? "resume" : "cancel");
    setError(null);
    try {
      await cancelDesktopSubscription(token, undo);
      await refreshWithReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update billing.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveAddon(addonKey: BillingAddonSummary["key"]) {
    setBusy(`remove-${addonKey}`);
    setError(null);
    try {
      await removeDesktopAddon(token, addonKey);
      await refreshWithReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove addon.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAddAddon(addonKey: BillingAddonSummary["key"]) {
    setBusy(`add-${addonKey}`);
    setError(null);
    try {
      await createDesktopBillingIntent(token, { addonKey });
      await refreshWithReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add addon.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && <div className="view-error">{error}</div>}

      <div className="billing-grid">
        <section className="billing-panel billing-panel--hero">
          <div className="billing-kicker">Current plan</div>
          <div className="billing-hero-row">
            <div>
              <h2>{billing.currentPlanName}</h2>
              <p>{billing.currentPlanDescription}</p>
            </div>
            {billing.state.cancelAtPeriodEnd && (
              <span className="billing-badge billing-badge--warn">
                Ends {formatDate(billing.state.currentPeriodEnd)}
              </span>
            )}
          </div>

          <div className="billing-chip-row">
            <div className="billing-chip">
              <span className="billing-chip-label">Memory</span>
              <span>{billing.currentPlanMemoryWindow}</span>
            </div>
            <div className="billing-chip">
              <span className="billing-chip-label">Usage</span>
              <span>{billing.currentPlanMonthlyCredits}</span>
            </div>
            <div className="billing-chip">
              <span className="billing-chip-label">Renews</span>
              <span>{formatDate(billing.state.currentPeriodEnd)}</span>
            </div>
            <div className="billing-chip">
              <span className="billing-chip-label">Card</span>
              <span>
                {billing.state.paymentMethod
                  ? `${(billing.state.paymentMethod.brand ?? "card").toUpperCase()} •••• ${billing.state.paymentMethod.last4 ?? ""}`
                  : "Not added"}
              </span>
            </div>
          </div>

          <div className="billing-actions">
            {billing.publishableKey && (
              <button
                type="button"
                className="upgrade-cta-btn"
                onClick={() => setPaymentModalOpen(true)}
              >
                {billing.state.paymentMethod ? "Update card" : "Add card"}
              </button>
            )}
            {hasPaidPlan ? (
              billing.state.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="billing-secondary-btn"
                  onClick={() => void handleCancel(true)}
                  disabled={busy === "resume"}
                >
                  {busy === "resume" ? "Resuming..." : "Resume plan"}
                </button>
              ) : (
                <button
                  type="button"
                  className="billing-secondary-btn"
                  onClick={() => void handleCancel(false)}
                  disabled={busy === "cancel"}
                >
                  {busy === "cancel" ? "Scheduling..." : "Cancel at period end"}
                </button>
              )
            ) : null}
          </div>
        </section>

        <section className="billing-panel">
          <div className="billing-kicker">Plans in app</div>
          <div className="billing-cycle-toggle">
            {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                className={`billing-cycle-pill${checkoutCycle === cycle ? " active" : ""}`}
                onClick={() => setCheckoutCycle(cycle)}
              >
                {cycle === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>

          <div className="billing-plan-list">
            {personalPlans.map((plan) => {
              const isCurrent = plan.key === currentPlanKey;
              const label =
                checkoutCycle === "yearly"
                  ? plan.yearlyLabel ?? plan.monthlyLabel
                  : plan.monthlyLabel;
              return (
                <div
                  key={plan.key}
                  className={`billing-plan-card${isCurrent ? " active" : ""}`}
                >
                  <div className="billing-plan-head">
                    <div>
                      <div className="billing-plan-title">
                        {plan.name}
                        {plan.badge && <span className="billing-badge">{plan.badge}</span>}
                      </div>
                      <div className="billing-plan-price">{label}</div>
                    </div>
                    <div className="billing-plan-note">{plan.note}</div>
                  </div>
                  <p className="billing-plan-copy">{plan.description}</p>
                  <div className="billing-mini-chip-row">
                    <span className="billing-mini-chip">{plan.memoryWindow}</span>
                    <span className="billing-mini-chip">{plan.monthlyCredits}</span>
                  </div>
                  <ul className="billing-point-list">
                    {plan.points.slice(0, 4).map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <div className="billing-plan-actions">
                    {isCurrent ? (
                      <button type="button" className="billing-secondary-btn" disabled>
                        Current plan
                      </button>
                    ) : hasPaidPlan ? (
                      <button
                        type="button"
                        className="upgrade-cta-btn"
                        onClick={() => void handlePlanChange(plan.key, checkoutCycle)}
                        disabled={busy === `plan-${plan.key}-${checkoutCycle}`}
                      >
                        {busy === `plan-${plan.key}-${checkoutCycle}`
                          ? "Updating..."
                          : `Switch to ${plan.name}`}
                      </button>
                    ) : plan.key === "free" ? (
                      <button type="button" className="billing-secondary-btn" disabled>
                        Current plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="upgrade-cta-btn"
                        onClick={() => setCheckoutPlan(plan)}
                        disabled={!billing.stripeConfigured || !billing.publishableKey}
                      >
                        Start {plan.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="billing-panel">
          <div className="billing-kicker">Addons</div>
          <div className="billing-addon-list">
            {billing.state.activeAddons.map(({ addon }) => (
              <div key={addon.key} className="billing-addon-row">
                <div>
                  <div className="billing-addon-name">{addon.name}</div>
                  <div className="billing-addon-meta">{addon.monthlyLabel} active</div>
                </div>
                <button
                  type="button"
                  className="billing-secondary-btn"
                  onClick={() => void handleRemoveAddon(addon.key)}
                  disabled={busy === `remove-${addon.key}`}
                >
                  {busy === `remove-${addon.key}` ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}

            {availableAddons.map((addon) => (
              <div key={addon.key} className="billing-addon-row">
                <div>
                  <div className="billing-addon-name">{addon.name}</div>
                  <div className="billing-addon-meta">{addon.monthlyLabel}</div>
                </div>
                <button
                  type="button"
                  className="upgrade-cta-btn"
                  onClick={() => void handleAddAddon(addon.key)}
                  disabled={!hasPaidPlan}
                  title={hasPaidPlan ? undefined : "Choose a paid plan before adding addons"}
                >
                  {busy === `add-${addon.key}` ? "Adding..." : "Add addon"}
                </button>
              </div>
            ))}
            {!hasPaidPlan && availableAddons.length > 0 && (
              <div className="billing-note">
                Addons unlock after you start a paid plan.
              </div>
            )}
          </div>
        </section>

        <section className="billing-panel">
          <div className="billing-kicker">Recent invoices</div>
          {billing.state.invoices.length === 0 ? (
            <div className="billing-note">No invoices yet.</div>
          ) : (
            <div className="billing-invoice-list">
              {billing.state.invoices.map((invoice) => (
                <a
                  key={`${invoice.number ?? invoice.date}-${invoice.amountDue}`}
                  className="billing-invoice-row"
                  href={invoice.pdfUrl ?? invoice.hostedUrl ?? undefined}
                  target={invoice.pdfUrl || invoice.hostedUrl ? "_blank" : undefined}
                  rel={invoice.pdfUrl || invoice.hostedUrl ? "noreferrer" : undefined}
                >
                  <div>
                    <div className="billing-addon-name">
                      {invoice.number ?? "Invoice"} • {formatMoney(invoice.amountDue, invoice.currency)}
                    </div>
                    <div className="billing-addon-meta">
                      {formatDate(invoice.date)} • {invoice.status ?? "pending"}
                    </div>
                  </div>
                  <span className="billing-invoice-link">
                    {invoice.pdfUrl || invoice.hostedUrl ? "Open" : "Saved"}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>

      {checkoutPlan && billing.publishableKey && (
        <CheckoutModal
          token={token}
          plan={checkoutPlan}
          cycle={checkoutCycle}
          publishableKey={billing.publishableKey}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={async () => {
            setCheckoutPlan(null);
            await refreshWithReset();
          }}
        />
      )}

      {paymentModalOpen && billing.publishableKey && (
        <PaymentMethodModal
          token={token}
          publishableKey={billing.publishableKey}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={async () => {
            setPaymentModalOpen(false);
            await refreshWithReset();
          }}
        />
      )}
    </>
  );
}

function CheckoutModal({
  token,
  plan,
  cycle,
  publishableKey,
  onClose,
  onSuccess,
}: {
  token: string;
  plan: BillingPlanSummary;
  cycle: BillingCycle;
  publishableKey: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stripeP = useMemo(() => stripePromise(publishableKey), [publishableKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await createDesktopBillingIntent(token, {
          planKey: plan.key,
          cycle,
        });
        if (!cancelled) setClientSecret(result.clientSecret ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not start checkout.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, plan.key, cycle]);

  return (
    <BillingModalFrame
      kicker="Secure checkout"
      title={`Start ${plan.name}`}
      subtitle={`You stay inside sansxel desktop while Stripe handles the payment form.`}
      error={error}
      onClose={onClose}
    >
      {!clientSecret ? (
        <div className="billing-note">Preparing checkout...</div>
      ) : (
        <Elements
          stripe={stripeP}
          options={{
            clientSecret,
            appearance: billingAppearance,
          }}
        >
          <CheckoutForm
            amountLabel={cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel}
            onSuccess={onSuccess}
            onError={setError}
          />
        </Elements>
      )}
    </BillingModalFrame>
  );
}

function PaymentMethodModal({
  token,
  publishableKey,
  onClose,
  onSuccess,
}: {
  token: string;
  publishableKey: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stripeP = useMemo(() => stripePromise(publishableKey), [publishableKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await createDesktopSetupIntent(token);
        if (!cancelled) setClientSecret(result.clientSecret);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not start card update.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <BillingModalFrame
      kicker="Payment method"
      title="Update card"
      subtitle="Card details go directly to Stripe and never pass through sansxel servers."
      error={error}
      onClose={onClose}
    >
      {!clientSecret ? (
        <div className="billing-note">Preparing secure form...</div>
      ) : (
        <Elements
          stripe={stripeP}
          options={{
            clientSecret,
            appearance: billingAppearance,
          }}
        >
          <SetupForm
            token={token}
            onSuccess={onSuccess}
            onError={setError}
          />
        </Elements>
      )}
    </BillingModalFrame>
  );
}

function BillingModalFrame({
  kicker,
  title,
  subtitle,
  error,
  onClose,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  error: string | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div className="billing-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="billing-modal" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="billing-modal-close"
          onClick={onClose}
          aria-label="Close billing modal"
        >
          x
        </button>
        <div className="billing-kicker">{kicker}</div>
        <h3 className="billing-modal-title">{title}</h3>
        <p className="billing-modal-subtitle">{subtitle}</p>
        {error && <div className="view-error">{error}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CheckoutForm({
  amountLabel,
  onError,
  onSuccess,
}: {
  amountLabel: string;
  onError: (message: string) => void;
  onSuccess: () => Promise<void> | void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    if (!paymentIntent) {
      setSubmitting(false);
      onError("Extra verification is required to complete this payment.");
      return;
    }

    switch (paymentIntent.status) {
      case "processing":
      case "succeeded":
        await onSuccess();
        return;
      default:
        onError(`Payment is in an unexpected state (${paymentIntent.status}).`);
        setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="billing-form">
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />
      <button
        type="submit"
        className="upgrade-cta-btn billing-submit"
        disabled={!stripe || submitting}
      >
        {submitting ? "Processing..." : `Subscribe • ${amountLabel}`}
      </button>
    </form>
  );
}

function SetupForm({
  token,
  onError,
  onSuccess,
}: {
  token: string;
  onError: (message: string) => void;
  onSuccess: () => Promise<void> | void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Could not save card.");
      setBusy(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id ?? null;

    if (!paymentMethodId) {
      onError("Stripe did not return a payment method id.");
      setBusy(false);
      return;
    }

    try {
      await updateDesktopPaymentMethod(token, paymentMethodId);
      await onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update card.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="billing-form">
      <PaymentElement options={{ layout: "tabs" }} />
      <button
        type="submit"
        className="upgrade-cta-btn billing-submit"
        disabled={!stripe || busy}
      >
        {busy ? "Saving..." : "Save card"}
      </button>
    </form>
  );
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "Not set";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Not set";
  }
}

const billingAppearance = {
  theme: "night",
  variables: {
    colorPrimary: "#ffffff",
    colorBackground: "#0a0a0a",
    colorText: "#f5f5f5",
    colorTextSecondary: "#a3a3a3",
    colorDanger: "#f87171",
    fontFamily: "inherit",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid rgba(255,255,255,0.35)",
      boxShadow: "0 0 0 3px rgba(255,255,255,0.08)",
    },
    ".Tab": {
      border: "1px solid rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    ".Tab--selected": {
      border: "1px solid rgba(255,255,255,0.35)",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
  },
} as const;

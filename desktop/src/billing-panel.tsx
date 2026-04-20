import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
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
  createCreditPurchase,
  createDesktopBillingIntent,
  createDesktopSetupIntent,
  getCreditBalance,
  isOneTimeBoost,
  removeDesktopAddon,
  updateDesktopPaymentMethod,
  type BillingAddonKey,
  type BillingAddonSummary,
  type BillingCycle,
  type BillingPlanSummary,
  type CreditBalance,
  type DesktopBillingState,
  type PricingPlanKey,
} from "./billing-api";

// v0.1.4 monetization: each boost is now a real addon key that maps
// to a Stripe price (see lib/stripe.ts STRIPE_PRICES). The Buy / Add
// buttons call createDesktopBillingIntent with the addonKey — the
// server picks PaymentIntent for one-time keys and SubscriptionItem
// for recurring keys.
type BoostCard = {
  key: BillingAddonKey;
  name: string;
  price: string;
  detail: string;
  featured?: boolean;
};

// v0.1.9 — pared down to the SKUs that actually exist in Stripe.
// voice_minute_pack / image_credit_pack / copilot_time_pack were
// dropped in favour of the credit ledger; voice_pack / image_pack
// were dropped because credits cover both surfaces.
const ONE_TIME_BOOSTS: BoostCard[] = [
  { key: "session_boost", name: "Session Boost", price: "$2", detail: "+50 chats" },
  { key: "weekly_boost", name: "Weekly Boost", price: "$5", detail: "+500 weekly requests" },
];

const RECURRING_BOOSTS: BoostCard[] = [
  { key: "copilot_pro_pack", name: "Copilot Pro Pack", price: "$12/mo", detail: "Unlimited copilot for any plan" },
  {
    key: "power_pack",
    name: "Power Pack BUNDLE",
    price: "$25/mo",
    detail: "Copilot Pro + bonus credits — best ongoing value",
    featured: true,
  },
];

// v0.1.13 \u2014 Buy credits presets. Small grid of common values with
// $500 promoted to its own centered "big" button below. Cap raised
// from $500 \u2192 $10,000 (Stripe's per-charge ceiling is ~$999k but
// most cards reject transactions above ~$10k anyway, so this is the
// realistic upper bound).
const CREDIT_PRESETS_GRID = [5, 10, 25, 50, 100, 200] as const;
const CREDIT_PRESET_BIG = 500;
const CREDIT_MIN = 1;
const CREDIT_MAX = 10000;

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
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  // v0.1.4 — one-time boost checkout. Holds the clientSecret returned
  // by the payment-intent route plus the boost label so the modal can
  // render an accurate "Pay $X" button.
  const [oneTimeBoost, setOneTimeBoost] = useState<{
    key: BillingAddonKey;
    name: string;
    price: string;
    clientSecret: string;
  } | null>(null);
  // v0.1.9 — credits balance + buy-credits modal state. The balance
  // refreshes after a successful credit purchase and on every billing
  // panel mount/refresh; we never block the panel render on it (null
  // means "still loading"; 0 is a real value).
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [creditToast, setCreditToast] = useState<string | null>(null);

  const currentPlanKey = billing.state.planKey ?? billing.currentPlanKey;
  const hasPaidPlan = currentPlanKey !== "free";
  // "Comped" tier: paid plan key but no Stripe subscription on file.
  // Avoids dangling "Add card" + "Cancel at period end" CTAs that
  // imply a real subscription when there isn't one.
  const isComped =
    hasPaidPlan &&
    !billing.state.paymentMethod &&
    !billing.state.currentPeriodEnd;
  const personalPlans = billing.plans.filter(
    (plan) => plan.key === "free" || plan.key === "apprentice" || plan.key === "studio" || plan.key === "pro",
  );
  // v0.1.13 \u2014 Teams + Enterprise are not buyable inline; they
  // redirect to the website (Stripe per-seat checkout for Teams,
  // /contact for Enterprise). Pulled out of personalPlans so the
  // grid doesn't try to render them as regular Switch-to-Plan cards.
  const teamsPlan = billing.plans.find((plan) => plan.key === "teams");
  const enterprisePlan = billing.plans.find((plan) => plan.key === "enterprise");
  const activeAddonKeys = new Set(
    billing.state.activeAddons.map(({ addon }) => addon.key),
  );
  const availableAddons = billing.addons.filter(
    (addon) => !activeAddonKeys.has(addon.key),
  );

  // v0.1.10 — hide boost cards whose Stripe price env var is missing.
  // The server advertises which addon keys are wired up via
  // `configured_addons`; if it's absent (older server build), we
  // fall back to showing everything so local dev still works.
  const configuredAddonSet = useMemo(
    () => new Set<BillingAddonKey>(billing.configured_addons ?? []),
    [billing.configured_addons],
  );
  const hasConfiguredList = Array.isArray(billing.configured_addons);
  const visibleOneTimeBoosts = ONE_TIME_BOOSTS.filter(
    (b) => !hasConfiguredList || configuredAddonSet.has(b.key),
  );
  const visibleRecurringBoosts = RECURRING_BOOSTS.filter(
    (b) => !hasConfiguredList || configuredAddonSet.has(b.key),
  );

  async function refreshWithReset() {
    setError(null);
    await onRefresh();
    void refreshCreditBalance();
  }

  // v0.1.9 — fetch credit balance. Failures are silent — we just
  // leave the previous value (or null). The credits card renders
  // "—" while loading; a buy-credits success forces a refresh.
  async function refreshCreditBalance() {
    try {
      const balance = await getCreditBalance(token);
      setCreditBalance(balance);
    } catch (err) {
      console.warn("getCreditBalance failed:", err);
    }
  }

  // Initial load + clear toast on unmount.
  useEffect(() => {
    void refreshCreditBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!creditToast) return;
    const id = window.setTimeout(() => setCreditToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [creditToast]);

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
      const result = await createDesktopBillingIntent(token, { addonKey });
      // v0.1.8 — the hero addon micro-grid surfaces one-time boost
      // keys too; route them through the same Elements modal as the
      // dedicated Buy buttons so the clientSecret isn't dropped.
      if (isOneTimeBoost(addonKey)) {
        if (!result.clientSecret) {
          throw new Error("Stripe did not return a client secret.");
        }
        const addon = billing.addons.find((a) => a.key === addonKey);
        setOneTimeBoost({
          key: addonKey,
          name: addon?.name ?? addonKey,
          price: addon?.monthlyLabel ?? "",
          clientSecret: result.clientSecret,
        });
      } else {
        await refreshWithReset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add addon.");
    } finally {
      setBusy(null);
    }
  }

  // v0.1.4 — Boost button click handler. Routes one-time boosts through
  // a PaymentIntent + Elements modal; recurring boosts attach as a new
  // subscription item the same way memory_boost / api_boost / key_pack
  // already do (no modal — added in place, refresh shows them as active).
  async function handleBoostClick(boost: BoostCard) {
    setBusy(`add-${boost.key}`);
    setError(null);
    try {
      const result = await createDesktopBillingIntent(token, {
        addonKey: boost.key,
      });
      if (isOneTimeBoost(boost.key)) {
        if (!result.clientSecret) {
          throw new Error("Stripe did not return a client secret.");
        }
        setOneTimeBoost({
          key: boost.key,
          name: boost.name,
          price: boost.price,
          clientSecret: result.clientSecret,
        });
      } else {
        // Recurring addon attached to existing subscription — nothing
        // else to do, just refresh so it shows up in the active list.
        await refreshWithReset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not buy boost.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && <div className="view-error">{error}</div>}

      <div className="billing-stack">
        {/* Top row: hero (full width, dense) — plan info + chips on left,
            addons micro-grid in middle, actions on right. */}
        <section className="billing-panel billing-panel--hero billing-hero-dense">
          <div className="billing-hero-main">
            <div className="billing-hero-headline">
              <div className="billing-kicker">Current plan</div>
              <div className="billing-hero-row">
                <div>
                  <h2>{billing.currentPlanName}</h2>
                  <p>{billing.currentPlanDescription}</p>
                </div>
                {/* v0.1.12 \u2014 Plan status is now ALWAYS visible. The old
                    code only showed a badge when the user was cancelling,
                    so most users had no idea whether their plan was active,
                    comped, or expiring. Four explicit states now: */}
                {(() => {
                  // v0.1.13 \u2014 JSX text nodes don't interpret backslash
                  // escapes, so the previous version rendered literal
                  // "Comped \u0087 no card needed". Use actual unicode
                  // characters directly OR wrap in a JS string expression.
                  if (!hasPaidPlan) {
                    return (
                      <span className="billing-badge billing-badge--status">
                        Free plan
                      </span>
                    );
                  }
                  if (isComped) {
                    return (
                      <span className="billing-badge billing-badge--status">
                        {"Active \u00b7 free access"}
                      </span>
                    );
                  }
                  if (billing.state.cancelAtPeriodEnd) {
                    return (
                      <span className="billing-badge billing-badge--warn billing-badge--status">
                        {`Cancelling \u00b7 ends ${formatDate(billing.state.currentPeriodEnd)}`}
                      </span>
                    );
                  }
                  return (
                    <span className="billing-badge billing-badge--ok billing-badge--status">
                      {`Active \u00b7 renews ${formatDate(billing.state.currentPeriodEnd)}`}
                    </span>
                  );
                })()}
              </div>

              {/* v0.1.13 \u2014 Renews / Card chips now hide entirely
                  when the user is comped (they were showing misleading
                  "Not set" / "Not added" copy that implied a billing
                  problem). For real subscribers they show normally. */}
              <div className="billing-chip-row billing-chip-row--dense">
                <div className="billing-chip">
                  <span className="billing-chip-label">Memory</span>
                  <span>{billing.currentPlanMemoryWindow}</span>
                </div>
                <div className="billing-chip">
                  <span className="billing-chip-label">Usage</span>
                  <span>{billing.currentPlanMonthlyCredits}</span>
                </div>
                {!isComped && hasPaidPlan && (
                  <div className="billing-chip">
                    <span className="billing-chip-label">
                      {billing.state.cancelAtPeriodEnd ? "Ends" : "Renews"}
                    </span>
                    <span>{formatDate(billing.state.currentPeriodEnd)}</span>
                  </div>
                )}
                {!isComped && (
                  <div className="billing-chip">
                    <span className="billing-chip-label">Card</span>
                    <span>
                      {billing.state.paymentMethod
                        ? `${(billing.state.paymentMethod.brand ?? "card").toUpperCase()} \u2022\u2022\u2022\u2022 ${billing.state.paymentMethod.last4 ?? ""}`
                        : "Not added"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Inline addons micro-grid: keeps existing Stripe wiring */}
            <div className="billing-hero-addons">
              <div className="billing-kicker">Addons</div>
              <div className="billing-addon-microgrid">
                {billing.state.activeAddons.map(({ addon }) => (
                  <div key={addon.key} className="billing-addon-tile billing-addon-tile--active">
                    <div>
                      <div className="billing-addon-name">{addon.name}</div>
                      <div className="billing-addon-meta">{addon.monthlyLabel} active</div>
                    </div>
                    <button
                      type="button"
                      className="billing-secondary-btn billing-tile-btn"
                      onClick={() => void handleRemoveAddon(addon.key)}
                      disabled={busy === `remove-${addon.key}`}
                    >
                      {busy === `remove-${addon.key}` ? "..." : "Remove"}
                    </button>
                  </div>
                ))}

                {availableAddons.map((addon) => (
                  <div key={addon.key} className="billing-addon-tile">
                    <div>
                      <div className="billing-addon-name">{addon.name}</div>
                      <div className="billing-addon-meta">{addon.monthlyLabel}</div>
                    </div>
                    <button
                      type="button"
                      className="upgrade-cta-btn billing-tile-btn"
                      onClick={() => void handleAddAddon(addon.key)}
                      disabled={!hasPaidPlan}
                      title={hasPaidPlan ? undefined : "Choose a paid plan before adding addons"}
                    >
                      {busy === `add-${addon.key}` ? "..." : "Add"}
                    </button>
                  </div>
                ))}
              </div>
              {!hasPaidPlan && availableAddons.length > 0 && (
                <div className="billing-note billing-note--inline">
                  Addons unlock after you start a paid plan.
                </div>
              )}
            </div>
          </div>

          <div className="billing-hero-side">
            <div className="billing-actions billing-actions--column">
              {isComped ? (
                <span className="billing-comped-pill" title="Free access \u2014 plan is active without a payment method on file. Common for early supporters, founders, and team members.">
                  Active · free access
                </span>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </section>

        {/* Middle row: plans-in-app — full width, horizontal scroll */}
        <section className="billing-panel billing-panel--dense">
          <div className="billing-section-head">
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
          </div>

          <div className="billing-plan-list billing-plan-list--horizontal">
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

          {/* v0.1.13 \u2014 Teams + Enterprise CTAs. Both redirect to the
              website (Teams = per-seat Stripe checkout on /pricing#teams,
              Enterprise = /contact for sales). The desktop billing panel
              doesn't try to handle per-seat or custom-contract flows
              inline because those need a real form / sales-team loop. */}
          {(teamsPlan || enterprisePlan) && (
            <div className="billing-team-row" style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {teamsPlan && (
                <button
                  type="button"
                  className="billing-team-card"
                  onClick={() => void openUrl("https://sansxel.ai/pricing#teams").catch(() => {})}
                >
                  <div className="billing-team-card-name">Teams</div>
                  <div className="billing-team-card-copy">
                    Per-seat plans for groups. Opens checkout in your browser.
                  </div>
                  <span className="billing-team-card-cta">Set up Teams \u2192</span>
                </button>
              )}
              {enterprisePlan && (
                <button
                  type="button"
                  className="billing-team-card"
                  onClick={() => void openUrl("https://sansxel.ai/contact?subject=Enterprise").catch(() => {})}
                >
                  <div className="billing-team-card-name">Enterprise</div>
                  <div className="billing-team-card-copy">
                    Custom contracts, dedicated capacity, SSO. Opens our contact form.
                  </div>
                  <span className="billing-team-card-cta">Talk to us \u2192</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* v0.1.9 — Credits card. Shows balance and opens the buy modal.
            One credit = $0.01 worth of usage; chat = 1 credit, image = 5,
            voice = 2/min, copilot = 1. Sits above the boost packs because
            it's the new primary monetization surface. */}
        <section className="billing-panel billing-panel--dense">
          <div className="billing-section-head">
            <div className="billing-kicker">Credits</div>
            <span className="billing-note billing-note--inline">
              Pay-as-you-go usage. Stacks on any plan.
            </span>
          </div>
          <div className="boost-row">
            <div className="boost-card boost-card--featured" style={{ flex: "1 1 100%" }}>
              <div className="boost-card-head">
                <div className="boost-card-name">Credit balance</div>
                <div className="boost-card-price">
                  {creditBalance == null
                    ? "—"
                    : `$${creditBalance.balance_dollars.toFixed(2)}`}
                </div>
              </div>
              <div className="boost-card-meta">
                {creditBalance == null
                  ? "Loading balance..."
                  : creditBalance.balance > 0
                    ? `${creditBalance.balance.toLocaleString()} credits remaining — chat = 1, image = 5, voice = 2/min, copilot = 1.`
                    : "Buy credits to keep going past your plan caps. 1 USD = 100 credits."}
              </div>
              <button
                type="button"
                className="upgrade-cta-btn boost-card-btn"
                onClick={() => setCreditsModalOpen(true)}
                disabled={!billing.stripeConfigured || !billing.publishableKey}
                title={
                  !billing.stripeConfigured
                    ? "Billing isn't configured on this server yet."
                    : undefined
                }
              >
                Buy credits
              </button>
              {creditToast && (
                <div className="billing-note billing-note--inline" style={{ marginTop: 8 }}>
                  {creditToast}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* v0.1.12 \u2014 The standalone "Boost your account" + "Recurring
            add-on packs" sections were removed here. They duplicated the
            inline ADDONS micro-grid in the plan hero (above) and the
            Credits card (also above) wholesale: same Buy/Add buttons,
            same Stripe wiring, just rendered in two places. The hero
            addons grid handles all add/remove flow now; flexible Credits
            cover one-time top-up needs. */}

        {/* Bottom: invoices, compact — last 3 then expand */}
        <section className="billing-panel billing-panel--dense">
          <div className="billing-section-head">
            <div className="billing-kicker">Recent invoices</div>
            {billing.state.invoices.length > 3 && (
              <button
                type="button"
                className="billing-secondary-btn"
                onClick={() => setShowAllInvoices((v) => !v)}
              >
                {showAllInvoices ? "Show less" : `View all (${billing.state.invoices.length})`}
              </button>
            )}
          </div>
          {billing.state.invoices.length === 0 ? (
            <div className="billing-note">No invoices yet.</div>
          ) : (
            <div className="billing-invoice-list billing-invoice-list--compact">
              {(showAllInvoices
                ? billing.state.invoices
                : billing.state.invoices.slice(0, 3)
              ).map((invoice) => (
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

      {oneTimeBoost && billing.publishableKey && (
        <OneTimeBoostModal
          publishableKey={billing.publishableKey}
          boost={oneTimeBoost}
          onClose={() => setOneTimeBoost(null)}
          onSuccess={async () => {
            setOneTimeBoost(null);
            await refreshWithReset();
          }}
        />
      )}

      {creditsModalOpen && billing.publishableKey && (
        <BuyCreditsModal
          token={token}
          publishableKey={billing.publishableKey}
          onClose={() => setCreditsModalOpen(false)}
          onSuccess={async (dollars) => {
            setCreditsModalOpen(false);
            setCreditToast(`+${dollars * 100} credits added`);
            await refreshWithReset();
          }}
        />
      )}
    </>
  );
}

// v0.1.9 — Buy credits modal.
// Slider for $1–$500 plus five preset buttons ($5/$10/$25/$50/$100).
// Fetches a PaymentIntent client_secret from /api/desktop/billing/credits
// when the user confirms an amount, then renders Stripe Elements for
// the actual payment. On success the parent bumps the credit balance
// via refreshWithReset + shows a toast.
function BuyCreditsModal({
  token,
  publishableKey,
  onClose,
  onSuccess,
}: {
  token: string;
  publishableKey: string;
  onClose: () => void;
  onSuccess: (dollars: number) => Promise<void> | void;
}) {
  const [dollars, setDollars] = useState<number>(10);
  // v0.1.10 — raw text for the custom-amount input. Kept separate
  // from `dollars` so mid-edit values (empty string, "1" before "10",
  // etc.) don't thrash the slider or the "Continue to pay" button.
  const [amountText, setAmountText] = useState<string>("10");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stripeP = useMemo(() => stripePromise(publishableKey), [publishableKey]);

  async function startCheckout() {
    if (dollars < CREDIT_MIN || dollars > CREDIT_MAX) {
      setError(`Pick an amount between $${CREDIT_MIN} and $${CREDIT_MAX.toLocaleString()}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createCreditPurchase(token, dollars);
      setClientSecret(result.clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start credits purchase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BillingModalFrame
      kicker="Credits"
      title="Buy credits"
      subtitle="Pay-as-you-go. 1 USD = 100 credits. Never expires."
      error={error}
      onClose={onClose}
    >
      {!clientSecret ? (
        <div className="billing-form">
          <div className="billing-note">
            You&apos;ll get <strong>{(dollars * 100).toLocaleString()} credits</strong> for ${dollars}.
            Chat = 1, image = 5, voice = 2/min, copilot = 1.
          </div>

          {/* v0.1.13 \u2014 6 small presets in a 2-column wrapping grid
              (5/10 \u2192 25/50 \u2192 100/200), then a wide centered $500 button
              below as the "big buy" affordance. */}
          <div className="boost-row" style={{ marginTop: 4 }}>
            {CREDIT_PRESETS_GRID.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`billing-secondary-btn${dollars === preset ? " active" : ""}`}
                onClick={() => {
                  setDollars(preset);
                  setAmountText(String(preset));
                }}
              >
                ${preset}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              className={`billing-secondary-btn${dollars === CREDIT_PRESET_BIG ? " active" : ""}`}
              style={{ minWidth: 200 }}
              onClick={() => {
                setDollars(CREDIT_PRESET_BIG);
                setAmountText(String(CREDIT_PRESET_BIG));
              }}
            >
              ${CREDIT_PRESET_BIG}
            </button>
          </div>

          {/* v0.1.10 — text input + slider both bound to `dollars`.
              Typing in the field moves the slider and vice versa.
              We hold the raw text in `amountText` so a user can
              clear the field and keep typing without snapping back
              to the previous number on every keystroke; we only
              commit a clamped numeric value to `dollars` once the
              parsed value is a finite integer in [1, 500]. */}
          <label
            className="billing-note"
            htmlFor="credits-amount-input"
            style={{ marginTop: 8, display: "block" }}
          >
            Custom amount:
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
              }}
            >
              <span style={{ opacity: 0.7 }}>$</span>
              <input
                id="credits-amount-input"
                type="number"
                inputMode="numeric"
                min={CREDIT_MIN}
                max={CREDIT_MAX}
                step={1}
                value={amountText}
                onChange={(event) => {
                  const raw = event.target.value;
                  setAmountText(raw);
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed)) {
                    const clamped = Math.max(
                      CREDIT_MIN,
                      Math.min(CREDIT_MAX, Math.floor(parsed)),
                    );
                    setDollars(clamped);
                  }
                }}
                onBlur={() => {
                  // Snap the visible text back to the canonical
                  // clamped value so the field never shows "" or
                  // out-of-range after the user moves on.
                  setAmountText(String(dollars));
                }}
                style={{
                  flex: "0 0 auto",
                  width: 110,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "inherit",
                  font: "inherit",
                }}
              />
              <span style={{ opacity: 0.6, fontSize: "0.85em" }}>
                {`($${CREDIT_MIN}\u2013$${CREDIT_MAX.toLocaleString()})`}
              </span>
            </span>
            <input
              type="range"
              min={CREDIT_MIN}
              max={CREDIT_MAX}
              step={1}
              value={dollars}
              onChange={(event) => {
                const next = Number(event.target.value);
                setDollars(next);
                setAmountText(String(next));
              }}
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>

          <button
            type="button"
            className="upgrade-cta-btn billing-submit"
            onClick={() => void startCheckout()}
            disabled={busy || dollars < CREDIT_MIN || dollars > CREDIT_MAX}
          >
            {busy ? "Preparing..." : `Continue to pay $${dollars.toLocaleString()}`}
          </button>
        </div>
      ) : (
        <Elements
          stripe={stripeP}
          options={{ clientSecret, appearance: billingAppearance }}
        >
          {/* v0.1.10 — restate the amount + credit count above the
              payment form so the user can sanity-check what they're
              about to be charged for. */}
          <div className="billing-note" style={{ marginBottom: 8 }}>
            Paying <strong>${dollars}</strong> for{" "}
            <strong>{(dollars * 100).toLocaleString()} credits</strong>.
          </div>
          <CheckoutForm
            amountLabel={`$${dollars}`}
            submitVerb="Pay"
            onSuccess={() => onSuccess(dollars)}
            onError={setError}
          />
        </Elements>
      )}
    </BillingModalFrame>
  );
}

// v0.1.4 — One-time boost checkout. Wraps Stripe Elements around a
// PaymentIntent client_secret returned by the payment-intent route.
// Mirrors CheckoutModal but uses confirmPayment for a single charge
// rather than a recurring subscription confirmation.
function OneTimeBoostModal({
  publishableKey,
  boost,
  onClose,
  onSuccess,
}: {
  publishableKey: string;
  boost: { key: BillingAddonKey; name: string; price: string; clientSecret: string };
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}) {
  const [error, setError] = useState<string | null>(null);
  const stripeP = useMemo(() => stripePromise(publishableKey), [publishableKey]);

  return (
    <BillingModalFrame
      kicker="One-time top-up"
      title={`Buy ${boost.name}`}
      subtitle="Charged once. No subscription, no auto-renew."
      error={error}
      onClose={onClose}
    >
      <Elements
        stripe={stripeP}
        options={{
          clientSecret: boost.clientSecret,
          appearance: billingAppearance,
        }}
      >
        <CheckoutForm
          amountLabel={boost.price}
          submitVerb="Pay"
          onSuccess={onSuccess}
          onError={setError}
        />
      </Elements>
    </BillingModalFrame>
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
  // v0.1.9 — when set, replaces the default "Subscribe • {amountLabel}"
  // copy. One-time charges (credits, session boost) pass "Pay $X" so
  // we don't say "Subscribe" on a single charge.
  submitVerb = "Subscribe",
  onError,
  onSuccess,
}: {
  amountLabel: string;
  submitVerb?: string;
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
        {submitting ? "Processing..." : `${submitVerb} • ${amountLabel}`}
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

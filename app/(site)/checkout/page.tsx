import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "../../../auth";
import { CheckoutForm } from "../../../components/checkout-form";
import { getSignInPath } from "../../../lib/auth-ui";
import { getPricingPlan, pricingPlanMap } from "../../../lib/pricing";
import { getStripePublishableKey, isStripeConfigured } from "../../../lib/stripe";

export const metadata = {
  title: "Checkout",
  description: "Complete your sansxel subscription.",
};

type SearchParams = {
  plan?: string;
  cycle?: string;
  seats?: string;
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const session = await auth();
  if (!session?.user?.email) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    redirect(getSignInPath(`/checkout?${qs}`));
  }

  if (!isStripeConfigured()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-300">
          Checkout is not configured yet. Contact support.
        </div>
      </div>
    );
  }

  const publishableKey = getStripePublishableKey();
  if (!publishableKey) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-300">
          Checkout is missing a Stripe publishable key.
        </div>
      </div>
    );
  }

  const planKey = (params.plan ?? "").toLowerCase();
  if (!planKey || !(planKey in pricingPlanMap)) notFound();

  const plan = getPricingPlan(planKey as keyof typeof pricingPlanMap);
  if (plan.ctaVariant === "contact") redirect("/contact");
  if (plan.key === "free") redirect("/account");

  const cycle = params.cycle === "yearly" ? "yearly" : "monthly";
  const rawSeats = Number(params.seats);
  const seats = plan.key === "teams"
    ? Math.max(3, Number.isFinite(rawSeats) ? Math.floor(rawSeats) : 3)
    : 1;

  const amountLabel = cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-8 lg:py-20">
      {/* ─── Order summary ──────────────────────────────────────────────── */}
      <section>
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
          Order summary
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {plan.name}
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">{plan.description}</p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-neutral-400">
              {cycle === "yearly" ? "Yearly" : "Monthly"}
            </span>
            <span className="text-2xl font-semibold text-white">{amountLabel}</span>
          </div>
          {plan.key === "teams" && (
            <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-neutral-400">Seats</span>
              <span className="text-sm font-medium text-white">{seats}</span>
            </div>
          )}
          <ul className="mt-6 space-y-2 text-sm text-neutral-200">
            {plan.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-neutral-500">
          Want a different plan?{" "}
          <Link href="/pricing" className="underline decoration-neutral-600 underline-offset-4 hover:text-white">
            Compare all plans
          </Link>
        </p>
      </section>

      {/* ─── Payment form ───────────────────────────────────────────────── */}
      <section>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
            Payment
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">Complete your purchase</h2>
          <p className="mt-2 text-xs text-neutral-500">
            Paying as <span className="text-neutral-300">{session.user.email}</span>
          </p>

          <div className="mt-6">
            <CheckoutForm
              cycle={cycle}
              plan={plan}
              publishableKey={publishableKey}
              seats={seats}
              userEmail={session.user.email}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

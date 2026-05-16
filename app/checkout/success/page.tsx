import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { getSignInPath } from "../../../lib/auth-ui";
import { getPricingPlan, pricingPlanMap } from "../../../lib/pricing";
import { CheckoutSuccessPoller } from "../../../components/checkout-success-poller";

export const metadata = {
  title: "Confirming payment",
  description: "We're verifying your vraelis subscription.",
};

type SearchParams = {
  plan?: string;
  cycle?: string;
  seats?: string;
  /** Stripe appends these on redirect-style payment methods (PayPal, Cash App, bank, 3DS). */
  payment_intent?: string;
  redirect_status?: string;
};

/**
 * Possible Stripe redirect_status values:
 * - "succeeded"       → payment authorized, webhook should activate the sub
 * - "processing"      → async payment (bank debit), treat as likely-success
 * - "requires_payment_method" → user cancelled or payment failed
 * - "requires_action" → user bailed on the auth step
 * - "canceled"        → explicit cancellation
 *
 * Anything that isn't succeeded/processing means the user did NOT actually
 * pay.  We must not show the celebratory success UI in that case.
 */
function isAcceptable(status: string | undefined): boolean {
  return status === undefined || status === "succeeded" || status === "processing";
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const session = await auth();
  if (!session?.user?.email) redirect(getSignInPath("/account"));

  const planKey = (params.plan ?? "").toLowerCase();
  const plan = planKey in pricingPlanMap
    ? getPricingPlan(planKey as keyof typeof pricingPlanMap)
    : pricingPlanMap.free;

  const cycle = params.cycle === "yearly" ? "yearly" : "monthly";
  const failed = !isAcceptable(params.redirect_status);

  // ── Payment did NOT succeed, show failure UI, send user back ──────
  if (failed) {
    const retryHref = `/checkout?plan=${plan.key}&cycle=${cycle}`;
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Payment not completed
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Nothing was charged.
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Your payment was {params.redirect_status === "canceled" ? "canceled" : "not completed"} before it went through.
            You have not been charged and your plan hasn&apos;t changed.
          </p>
          {params.redirect_status && (
            <p className="mt-2 text-xs text-neutral-500">
              Stripe reported: <span className="text-neutral-400">{params.redirect_status}</span>
            </p>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href={retryHref}
              className="VRAELIS-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
            >
              Try again
            </Link>
            <Link
              href="/pricing"
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Pick a different plan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment authorized, verify activation before celebrating ──────
  // Note the copy is deliberately conditional: "Confirming" until the
  // poller flips to "active".  The poller component handles that swap.
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10">
        <CheckoutSuccessPoller
          expectedPlanKey={plan.key}
          planName={plan.name}
          cycle={cycle}
        />

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/account"
            className="VRAELIS-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            Go to account
          </Link>
          <Link
            href="/account/billing"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            Manage billing
          </Link>
        </div>
      </div>
    </div>
  );
}

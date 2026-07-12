import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Refunds & cancellation",
  description: "How credits, subscriptions, and cancellations work at Vraelis: what is refundable, how failed checks are handled, and how to cancel.",
  path: "/refunds",
});

const acc = { color: "var(--acc-deep)" };
const strong = { color: "var(--fg-1)" };

export default function RefundsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Refunds & cancellation"
      updated="Updated July 2026"
      intro="Plain terms for how credits, subscriptions, and cancellations work. This policy is part of the Terms."
    >
      <H>Credits</H>
      <P>Your balance funds Production Passes: real-browser runs of your approved flows that end in a launch decision. <strong style={strong}>Purchased balance is non-refundable once bought</strong>, but it does not expire, so there is no pressure to spend it.</P>
      <P>You are not charged for work you do not get. If a pass cannot start, or no flow executes, the hold is returned to your account automatically. Failures on our infrastructure are never billed to you.</P>

      <H>Subscriptions</H>
      <P>Paid plans renew automatically until you cancel. <strong style={strong}>You can cancel anytime</strong> from your <Link href="/app/billing" style={acc}>billing settings</Link>; your plan stays active until the end of the current billing period, and you are not charged again after that. We do not provide partial or prorated refunds for the current period, and monthly plan credits that expire at the end of a cycle are not refundable.</P>

      <H>Free credits</H>
      <P>Promotional or signup credits are provided at our discretion, have no cash value, and are not refundable or redeemable for money.</P>

      <H>Billing errors</H>
      <P>If something looks wrong, email <a href="mailto:help@vraelis.com" style={acc}>help@vraelis.com</a> and we will look into it. Genuine billing errors are handled case by case, for example:</P>
      <Ul items={[
        "A duplicate or clearly mistaken charge.",
        "Being charged after a confirmed cancellation.",
        "A checkout that took payment but did not deliver the credits it should have.",
      ]} />
      <P>Please contact us before opening a chargeback with your bank, so we can resolve it directly and faster.</P>

      <H>How to cancel</H>
      <P>Cancel or change a plan from your <Link href="/app/billing" style={acc}>billing settings</Link> in the app, in a couple of clicks, with no email or phone call required. You can manage cards and view invoices through the Stripe billing portal linked there.</P>

      <H>Contact</H>
      <P>Questions about a charge or this policy? Email <a href="mailto:help@vraelis.com" style={acc}>help@vraelis.com</a>. See also our <Link href="/terms" style={acc}>Terms</Link> and <Link href="/privacy" style={acc}>Privacy Policy</Link>.</P>
    </LegalShell>
  );
}

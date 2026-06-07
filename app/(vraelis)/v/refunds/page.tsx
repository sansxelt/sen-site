import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — Vraelis",
  description: "How refunds and cancellations work on Vraelis.",
};

const UPDATED = "June 4, 2026";

function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.3rem,2.2vw,1.7rem)", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: "2em 0 0.6em" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--fg-2)", margin: "0 0 1em" }}>{children}</p>;
}

export default function RefundsPage() {
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="eyebrow">Legal</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem,3.4vw,2.8rem)", marginBottom: 8 }}>Refund Policy</h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", marginBottom: 28 }}>Last updated {UPDATED}</p>

        <H>Subscription plans</H>
        <P>You can cancel your plan anytime from your account or through Stripe. Your plan stays active until the end of the current billing period, and you won't be charged again after that. We generally don't refund the unused part of a billing period, though we may make exceptions at our discretion — just reach out.</P>

        <H>Lifetime / one-time plans</H>
        <P>One-time (lifetime) purchases are refundable within 14 days of purchase if you haven't substantially used the service. After that they're non-refundable.</P>

        <H>The Vraelis revenue-share fee</H>
        <P>When a lead pays you through Vraelis, our percentage fee is taken automatically at the time of payment. If you refund that customer, contact us and we'll handle the associated platform fee in line with what Stripe returns to us.</P>

        <H>Payments your customers make to you</H>
        <P>Deposits and payments your customers make through Vraelis are for your services, not ours. If a customer wants a refund for a service or booking, that's between you and your customer — Vraelis isn't a party to it. As the business, you decide and issue those refunds (you can do this from your Stripe dashboard). Customers should contact the business they paid, not Vraelis.</P>

        <H>How to request a refund</H>
        <P>Email <a href="mailto:hello@vraelis.com" style={{ color: "var(--acc-deep)" }}>hello@vraelis.com</a> with your account email and what you'd like refunded. We'll get back to you quickly.</P>
      </div>
    </section>
  );
}

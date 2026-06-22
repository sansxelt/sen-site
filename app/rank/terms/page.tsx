import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Terms",
  description: "The terms for using Vraelis: what it provides, your responsibilities, credits, payments, and prohibited use.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Legal" title="Terms" updated="Updated June 2026">
      <P>These terms cover your use of Vraelis at vraelis.com. By using the product, you agree to them. If you do not agree, do not use the service.</P>

      <H>What Vraelis provides</H>
      <P>Vraelis is a creative evaluation and human preference platform. It includes:</P>
      <Ul items={[
        "Creative testing and human voting.",
        "Vote filtering for quality.",
        "Reports and optional public report links.",
        "Credits and plans.",
        "API keys, webhooks, and data exports.",
      ]} />

      <H>Accounts</H>
      <P>You are responsible for your account and for keeping access to it secure. Provide accurate information when you sign up, and do not misuse the service or let others misuse it through your account.</P>

      <H>Your content</H>
      <P>You are responsible for the content you upload, link, test, or share, and you must have the right to use it. Do not submit content that is illegal, harmful, infringing, deceptive, abusive, or that violates someone&apos;s privacy.</P>

      <H>Credits</H>
      <P>One credit equals one valid judgment. Credits are held when a test launches. Invalid or low-quality votes may be filtered and do not count. Held credits for votes that are never collected are returned when a test completes. Prices, packs, plans, and limits may change over time.</P>

      <H>Reports and results</H>
      <P>Reports are informational feedback based on the votes collected. Vraelis does not guarantee sales, clicks, conversions, revenue, or campaign performance. You are responsible for the business decisions you make from a report. Public report links are optional and can be viewed by anyone who has the link.</P>

      <H>API keys, webhooks, and exports</H>
      <P>API keys are secrets, and you are responsible for keeping them secure. Webhook events may be signed so you can verify them. Handle exported data responsibly. Abuse, scraping, excessive requests, or attempts to bypass limits may be rate-limited or blocked.</P>

      <H>Payments and subscriptions</H>
      <P>Payments are processed by Stripe. Purchases and subscriptions follow the checkout and billing flow shown in the product. Cancellations, billing access, and plan changes happen through the app where available. We do not promise refunds unless a specific refund policy says so.</P>

      <H>Prohibited use</H>
      <Ul items={[
        "Fraud.",
        "Spam.",
        "Bot or automated voting.",
        "Vote manipulation.",
        "Duplicate-voting abuse.",
        "Scraping or attacking the service.",
        "Uploading infringing or illegal content.",
        "Using Vraelis to mislead people.",
        "Attempting to access private reports, API keys, billing, or other users' data without permission.",
      ]} />

      <H>Account deletion</H>
      <P>You can request account deletion from your <a href="/app/account" style={{ color: "var(--acc-deep)" }}>account settings</a> (a confirm-gated request) or by emailing <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>. Requests are reviewed manually, so deletion is not instant. Some records may be retained where required for billing, fraud prevention, security, or legal reasons.</P>

      <H>Availability and changes</H>
      <P>The service may change over time. Features may be added, removed, or updated, and we do not guarantee uninterrupted availability. We may update these terms and will keep this page current.</P>

      <H>Contact</H>
      <P>Questions about these terms? Email <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)" }}>help@vraelis.com</a>.</P>
    </LegalShell>
  );
}

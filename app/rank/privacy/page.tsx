import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Privacy",
  description: "What Vraelis collects, how it is used, and the privacy rights that may apply to you.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy" updated="Updated June 2026">
      <H>Overview</H>
      <P>Vraelis is a human evaluation layer for creative and AI-generated outputs: you submit options, real people evaluate them, and you get a decision report. This page explains how data is handled when you use the website, app, evaluation/voting flow, API, webhooks, exports, and public reports at vraelis.com. We have kept it plain and specific to what the product actually does.</P>

      <H>Data we collect</H>
      <Ul items={[
        "Account details: your name, email, and which sign-in provider you used (email, Google, or GitHub).",
        "Tests you create: titles, categories, settings, and the creative options you upload or link.",
        "Voting data: the votes, rankings, and comments collected on your tests, and the report results generated from them.",
        "Public report settings, including whether sharing is on and the share token for a public link.",
        "API key metadata: a key's name, prefix, scopes, created date, and last-used time. The full key is shown once at creation and stored only as a hash.",
        "Webhook endpoint URLs and delivery logs, including status, timestamps, and response or error details.",
        "Credit, plan, billing, and subscription records, and checkout and payment status.",
        "Support and contact messages you send us.",
        "Usage, security, and abuse-prevention logs.",
        "Hashed IP and device signals used to detect duplicate or automated voting. We do not show raw IP or device data in reports.",
      ]} />

      <H>How we use data</H>
      <Ul items={[
        "Operate the product and your account.",
        "Create and complete tests, collect votes, and filter low-quality votes.",
        "Generate reports and enable sharing, exports, webhooks, and the API.",
        "Manage credits, plans, billing, and checkout.",
        "Prevent spam, duplicate voting, fraud, and abuse.",
        "Keep the service reliable and secure.",
        "Respond to support, privacy, and account requests.",
      ]} />

      <H>Payments</H>
      <P>Payments are processed by Stripe. Vraelis does not store full card numbers. We may retain billing records where needed for accounting, fraud prevention, or legal reasons.</P>

      <H>Public reports</H>
      <Ul items={[
        "Public reports are optional and off by default.",
        "The report owner can turn public sharing on or off at any time.",
        "A public report is read-only.",
        "A public report does not expose your account email, billing data, API key secrets, raw voter identities, raw IP or device data, or private owner fields.",
      ]} />

      <H>API keys and webhooks</H>
      <Ul items={[
        "Treat API keys as secrets. The full key is shown once at creation; after that we display only its metadata (name, prefix, scopes, and dates).",
        "API keys are stored as a hash, not in plain text.",
        "Webhook delivery logs may store the delivery status, timestamps, endpoint URL, and response or error details.",
        "Webhook events are signed so your app can verify they came from Vraelis.",
      ]} />

      <H>Vendors and processors</H>
      <P>We use a small set of service providers to run Vraelis. They process data on our behalf to operate the service. By category:</P>
      <Ul items={[
        "Hosting, database, and storage providers.",
        "Authentication providers, for email, Google, and GitHub sign-in.",
        "Payment processing, handled by Stripe.",
        "Email delivery, for sign-in verification and account messages.",
        "Security, logging, and monitoring tools.",
      ]} />

      <H>California privacy notice</H>
      <P>If you are a California resident, this section describes how Vraelis handles personal information. We are a small product and may not meet the thresholds that trigger every California privacy obligation, but we want to be transparent.</P>
      <Ul items={[
        "Categories of personal information we collect: identifiers such as name and email; account and authentication data; commercial information such as credits, plans, and billing or payment status; internet and usage activity such as test and voting activity and logs; and limited inferences used only for vote quality and abuse detection.",
        "Purposes: to operate the product, run tests and voting, generate reports, manage billing, prevent abuse, and provide support.",
        "Sources: directly from you, automatically as you use the product, and from your sign-in and payment providers.",
        "Service providers and third parties: hosting, database, authentication, payments (Stripe), email, and security or logging providers, used to operate the service.",
        "Rights that may apply: to know or access the personal information we hold, to request deletion, to request correction, to opt out where applicable, to limit the use of sensitive information where applicable, and to not be discriminated against for exercising these rights.",
      ]} />
      <P>Vraelis does not sell personal information or share it for cross-context behavioral advertising.</P>
      <P>If California privacy rights apply to you, you may contact us at <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a> to request access, deletion, correction, or other available rights.</P>

      <H>EU, EEA, and UK privacy rights</H>
      <P>If you are in the EU, EEA, or UK, this section describes your privacy rights. It is a plain explanation of how we handle your data and how to reach us, not a claim of full regulatory compliance.</P>
      <P>Controller and contact: Vraelis, reachable at <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>.</P>
      <P>We process data to provide creative testing, voting, reports, the API, webhooks, exports, billing, and support, and to keep the service secure. In plain terms, the lawful bases we rely on are:</P>
      <Ul items={[
        "Contract, to provide the service you sign up for.",
        "Legitimate interests, to secure the product and prevent abuse.",
        "Consent, where an optional choice requires it.",
        "Legal obligations, for billing, tax, and accounting where needed.",
      ]} />
      <P>Your rights include access, correction, deletion, restriction, portability, objection, withdrawing consent where applicable, and complaining to a supervisory authority. Data may be processed in the United States or by United States based providers.</P>

      <H>Retention</H>
      <Ul items={[
        "Account, test, and report data is kept while your account is active, unless you delete it or ask support to handle a request.",
        "Public report links can be disabled by the owner at any time.",
        "API keys can be deleted, and webhook endpoints can be removed.",
        "Billing records may be kept where required for accounting, fraud prevention, or legal reasons.",
        "Security and abuse logs may be kept for a limited period to protect the service.",
      ]} />

      <H>Contact</H>
      <P>Questions about privacy or your data? Email <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>.</P>
    </LegalShell>
  );
}

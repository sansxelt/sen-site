import Link from "next/link";
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
      <P>Vraelis is production validation for AI-built systems: you connect an application, define what it must do in production, and Vraelis runs those requirements against your exact build and environment and captures the evidence. This page explains how data is handled when you use the website, app, verification runs, API, webhooks, and exports at vraelis.com. We have kept it plain and specific to what the product actually does.</P>

      <H>Data we collect</H>
      <Ul items={[
        "Account details: your name, email, and which sign-in provider you used (email, Google, or GitHub).",
        "Applications you connect: names, deployment URLs, environment and build metadata, and the production requirements and verification flows you define.",
        "Connection data for integrations you link (provider metadata and OAuth tokens), and test-account sign-in credentials you provide for verification runs, stored encrypted (AES-256-GCM) and used only to execute your verifications.",
        "Verification data: the runs Vraelis executes against your application, the evidence they capture, and the results and launch decisions generated from them.",
        "API key metadata: a key's name, prefix, scopes, created date, and last-used time. The full key is shown once at creation and stored only as a hash.",
        "Webhook endpoint URLs and delivery logs, including status, timestamps, and response or error details.",
        "Plan, balance, billing, and subscription records, and checkout and payment status.",
        "Support and contact messages you send us.",
        "Usage, security, and abuse-prevention logs.",
        "Hashed IP and device signals used to detect automated abuse. We do not show raw IP or device data in reports.",
      ]} />

      <H>How we use data</H>
      <Ul items={[
        "Operate the product and your account.",
        "Run verification against your connected applications and capture the resulting evidence.",
        "Generate reports and enable exports, webhooks, and the API.",
        "Manage plans, balance, billing, and checkout.",
        "Prevent spam, fraud, and abuse.",
        "Keep the service reliable and secure.",
        "Respond to support, privacy, and account requests.",
      ]} />

      <H>Payments</H>
      <P>Payments are processed by Stripe. Vraelis does not store full card numbers. We may retain billing records where needed for accounting, fraud prevention, or legal reasons.</P>

      <H>Report access</H>
      <P>Reports are private to your account and team. There are no public report links. A workspace can grant a read-only client-viewer role, which can see reports but cannot change anything or reach private workspace controls. A report never exposes your account email, billing data, API key secrets, raw IP or device data, or private owner fields.</P>

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
        "Categories of personal information we collect: identifiers such as name and email; account and authentication data; commercial information such as plan, balance, and billing or payment status; internet and usage activity such as verification activity and logs; and limited inferences used only for abuse detection.",
        "Purposes: to operate the product, run verification, generate reports, manage billing, prevent abuse, and provide support.",
        "Sources: directly from you, automatically as you use the product, and from your sign-in and payment providers.",
        "Service providers and third parties: hosting, database, authentication, payments (Stripe), email, and security or logging providers, used to operate the service.",
        "Rights that may apply: to know or access the personal information we hold, to request deletion, to request correction, to opt out where applicable, to limit the use of sensitive information where applicable, and to not be discriminated against for exercising these rights.",
      ]} />
      <P>Vraelis does not sell personal information or share it for cross-context behavioral advertising.</P>
      <P>If California privacy rights apply to you, you can submit a request from your <Link href="/account" style={{ color: "var(--acc-deep)" }}>account settings</Link> or contact us at <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a> to request access, deletion, correction, or other available rights. Requests are reviewed manually.</P>

      <H>EU, EEA, and UK privacy rights</H>
      <P>If you are in the EU, EEA, or UK, this section describes your privacy rights. It is a plain explanation of how we handle your data and how to reach us, not a claim of full regulatory compliance.</P>
      <P>Controller and contact: Vraelis, reachable at <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>.</P>
      <P>We process data to provide production verification, reports, the API, webhooks, exports, billing, and support, and to keep the service secure. In plain terms, the lawful bases we rely on are:</P>
      <Ul items={[
        "Contract, to provide the service you sign up for.",
        "Legitimate interests, to secure the product and prevent abuse.",
        "Consent, where an optional choice requires it.",
        "Legal obligations, for billing, tax, and accounting where needed.",
      ]} />
      <P>Your rights include access, correction, deletion, restriction, portability, objection, withdrawing consent where applicable, and complaining to a supervisory authority. Data may be processed in the United States or by United States based providers.</P>

      <H>Retention</H>
      <Ul items={[
        "Account, verification, and report data is kept while your account is active, unless you delete it or ask support to handle a request.",
        "API keys can be deleted, and webhook endpoints can be removed.",
        "Billing records may be kept where required for accounting, fraud prevention, or legal reasons.",
        "Security and abuse logs may be kept for a limited period to protect the service.",
      ]} />

      <H>Contact</H>
      <P>Questions about privacy or your data? Email <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>.</P>
    </LegalShell>
  );
}

import type { ReactNode } from "react";

/* The one copy of the Privacy and Terms text.

   These pages existed only under the rank tree, styled with rank's design tokens. The V6 preview needed
   them too, and the wrong fix would have been to paste the text into a second pair of files: legal copy that
   exists twice drifts, and then the company has two different sets of terms.

   So the words live here once, and each surface supplies its own primitives. Rank passes its tokens, V6
   passes V6 classes, and neither owns the text. Nothing here is new: it is the shipped copy, moved. */

export type LegalPrims = {
  H: (p: { children: ReactNode }) => ReactNode;
  P: (p: { children: ReactNode }) => ReactNode;
  Ul: (p: { items: ReactNode[] }) => ReactNode;
  /** A link, styled by the surface. Internal and mailto both come through here. */
  A: (p: { href: string; children: ReactNode }) => ReactNode;
  /** Emphasis inside a paragraph, styled by the surface. */
  S: (p: { children: ReactNode }) => ReactNode;
};

export const PRIVACY_UPDATED = "Updated June 2026";
export const SUBPROCESSORS_UPDATED = "Updated July 2026";
export const SUBPROCESSORS_INTRO = "The third-party services Vraelis relies on to run the product. Verification runs against your connected application use our hosting and browser-execution infrastructure, and any AI assessment is sent to the AI model provider.";

/** The vendors the product actually calls. Referenced by a customer DPA, so it stays in one place. */
export const SUBPROCESSORS: { name: string; purpose: string; data: string; region: string }[] = [
  { name: "Anthropic", purpose: "AI model that plans each verification's requirements and flows", data: "The deployment and claim you submit for a verification", region: "United States" },
  { name: "Browserbase", purpose: "Browser-execution infrastructure for verification runs", data: "Deployment URL, approved flows, and run-supplied test credentials", region: "United States" },
  { name: "Supabase", purpose: "Database, storage, and authentication", data: "Account, verifications, balance, content", region: "United States" },
  { name: "Vercel", purpose: "Application hosting and delivery", data: "Request and app traffic", region: "United States / global edge" },
  { name: "Cloudflare", purpose: "DNS, CDN, and DDoS protection", data: "Request metadata", region: "Global edge" },
  { name: "Stripe", purpose: "Payments and subscription billing", data: "Billing details, payment status", region: "United States" },
  { name: "Resend", purpose: "Transactional email (verification, receipts)", data: "Email address, message content", region: "United States" },
  { name: "Google / GitHub", purpose: "Optional single sign-on", data: "Email and basic profile, only if you use it", region: "United States" },
];
export const TERMS_UPDATED = "Updated July 2026";
export const REFUNDS_UPDATED = "Updated July 2026";
export const REFUNDS_INTRO = "Plain terms for how your balance, subscriptions, and cancellations work. This policy is part of the Terms.";

export function PrivacyBody({ H, P, Ul, A }: LegalPrims) {
  return (
    <>
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
      <P>If California privacy rights apply to you, you can submit a request from your <A href="/account">account settings</A> or contact us at <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A> to request access, deletion, correction, or other available rights. Requests are reviewed manually.</P>

      <H>EU, EEA, and UK privacy rights</H>
      <P>If you are in the EU, EEA, or UK, this section describes your privacy rights. It is a plain explanation of how we handle your data and how to reach us, not a claim of full regulatory compliance.</P>
      <P>Controller and contact: Vraelis, reachable at <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>.</P>
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
      <P>Questions about privacy or your data? Email <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>.</P>
    </>
  );
}

export function TermsBody({ H, P, Ul, A, S }: LegalPrims) {
  return (
    <>
      <P>These terms cover your use of Vraelis at vraelis.com. By creating an account or using the product, you agree to them. If you do not agree, do not use the service.</P>

      <H>What Vraelis provides</H>
      <P>Vraelis is production validation for AI-built systems. You connect an application, define what it must do in production, and Vraelis returns a structured result:</P>
      <Ul items={[
        "A verification: your requirements executed against your exact build and environment, with the evidence captured from each run.",
        "A truthful production decision and the issues found, tracked across releases.",
        "Plans, an account balance, and a developer API with keys, webhooks, and data exports.",
      ]} />

      <H>Accounts</H>
      <P>You are responsible for your account and for keeping access to it secure. Provide accurate information when you sign up, and do not misuse the service or let others misuse it through your account. Accounts are for one person or organization; do not create multiple accounts to obtain additional free allowances.</P>

      <H>Your content</H>
      <P>You are responsible for the applications, requirements, and content you connect, verify, or share, and you must have the right to use them and to authorize Vraelis to test them. You grant Vraelis a limited license to process that content to provide the service, which includes sending it to our subprocessors (for example, our hosting and browser-execution infrastructure that runs a verification, and the AI model provider that produces an AI assessment). Do not submit content that is illegal, infringing, deceptive, or abusive, and do not submit regulated or highly sensitive personal data you are not permitted to share.</P>

      <H>Balance and payments</H>
      <P>Your account balance funds verifications, which are charged when they execute. New accounts start with a free promotional verification allowance, which has no cash value. Payments are processed by Stripe. If a verification cannot start, or no flow executes, the hold is returned to your account automatically.</P>
      <P>Subscriptions renew automatically until cancelled, and you can cancel anytime from the app; access continues until the end of the current billing period. Prices, packs, plans, and limits may change over time. Our <A href="/refunds">Refund and Cancellation policy</A> explains what is and is not refundable.</P>

      <H>How to read a verification result</H>
      <P><S>A Vraelis result is evidence from a verification run. It is informational and directional, not a guarantee, a certification, or professional, legal, or financial advice.</S> A production decision reflects how your exact build behaved against the requirements you defined, under the scenarios that were run; it does not certify that a system is bug-free, safe, or universally production-ready. You are solely responsible for the decisions you make and for anything you choose to ship. Do not rely on a Vraelis result as the sole basis for a decision, and do not present it as a guarantee of quality, safety, performance, or any business outcome.</P>

      <H>API keys, webhooks, and exports</H>
      <P>API access is available on the Scale plan. API keys are secrets, and you are responsible for keeping them secure. Webhook events are signed so you can verify them. Handle exported data responsibly. Abuse, scraping, excessive requests, or attempts to bypass rate limits or entitlements may be throttled or blocked.</P>

      <H>Prohibited use</H>
      <Ul items={[
        "Fraud, spam, or deceptive use.",
        "Bot or automated abuse, or attempts to manipulate verification results.",
        "Creating multiple or alias accounts to farm free allowances.",
        "Scraping, probing, or attacking the service, or attempting to bypass rate limits or plan entitlements.",
        "Submitting infringing, illegal, or regulated content you are not permitted to share.",
        "Using Vraelis to mislead people or to present its output as a guarantee.",
        "Attempting to access private reports, API keys, billing, or other users' data without permission.",
      ]} />

      <H>Disclaimer of warranties</H>
      <P><S>The service and all outputs are provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, whether express or implied, including the implied warranties of MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, and NON-INFRINGEMENT.</S> We do not warrant that the service will be uninterrupted or error-free, or that any score, recommendation, or flag is accurate, complete, or reliable.</P>

      <H>Limitation of liability</H>
      <P><S>To the maximum extent permitted by law, Vraelis will not be liable for any indirect, incidental, special, consequential, or exemplary damages, or for any lost profits, revenue, data, or goodwill. Our total aggregate liability for any claim will not exceed the amount you paid Vraelis in the twelve months before the event giving rise to the claim.</S> Nothing in these terms limits liability that cannot be limited under applicable law, including liability for fraud, gross negligence, or willful misconduct.</P>

      <H>Indemnification</H>
      <P>You will defend, indemnify, and hold Vraelis harmless from claims, damages, and costs arising out of the content you submit, your use of any output, or your violation of these terms or of applicable law.</P>

      <H>Account deletion</H>
      <P>You can request account deletion from your <A href="/account">account settings</A> (a confirm-gated request) or by emailing <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>. Requests are reviewed manually, so deletion is not instant. Some records may be retained where required for billing, fraud prevention, security, or legal reasons.</P>

      <H>Availability and changes</H>
      <P>The service may change over time. Features may be added, removed, or updated, and we do not guarantee uninterrupted availability. We may update these terms and will keep this page current; material changes take effect when posted, and continued use means you accept them.</P>

      <H>Governing law</H>
      <P>These terms are governed by the laws of the State of California, without regard to its conflict-of-laws rules. For any dispute not otherwise resolved, you agree to the exclusive jurisdiction and venue of the state and federal courts located in California.</P>

      <H>Contact</H>
      <P>Questions about these terms? Email <A href="mailto:help@vraelis.com">help@vraelis.com</A>.</P>
    </>
  );
}

export function SubprocessorsTail({ H, P, A }: LegalPrims) {
  return (
    <>
      <H>Data location and transfers</H>
      <P>Several subprocessors process data in the United States. Where personal data is transferred internationally, the transfer relies on the subprocessors&apos; own standard contractual clauses and safeguards. Each subprocessor is engaged under its own data-processing terms.</P>

      <H>Changes</H>
      <P>We may add or replace a subprocessor as the product evolves. When we make a material change we will update this page. If you need advance notice of new subprocessors for a contract, contact us and we can arrange it.</P>

      <H>Contact</H>
      <P>Questions about a subprocessor or a data-processing agreement? Email <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>. See also our <A href="/dev-preview/v6/privacy">Privacy Policy</A>.</P>
    </>
  );
}

export function RefundsBody({ H, P, Ul, A, S }: LegalPrims) {
  return (
    <>
      <H>Account balance</H>
      <P>Your balance funds verifications: real-browser runs of your approved flows that end in a launch decision. <S>Purchased balance is non-refundable once bought</S>, but it does not expire, so there is no pressure to spend it.</P>
      <P>You are not charged for work you do not get. If a verification cannot start, or no flow executes, the hold is returned to your account automatically. Failures on our infrastructure are never billed to you.</P>

      <H>Subscriptions</H>
      <P>Paid plans renew automatically until you cancel. <S>You can cancel anytime</S> from your <A href="/billing">billing settings</A>; your plan stays active until the end of the current billing period, and you are not charged again after that. We do not provide partial or prorated refunds for the current period, and a plan&apos;s monthly included allowance that expires at the end of a cycle is not refundable.</P>

      <H>Promotional balance</H>
      <P>Promotional or signup balance is provided at our discretion, has no cash value, and is not refundable or redeemable for money.</P>

      <H>Billing errors</H>
      <P>If something looks wrong, email <A href="mailto:help@vraelis.com">help@vraelis.com</A> and we will look into it. Genuine billing errors are handled case by case, for example:</P>
      <Ul items={[
        "A duplicate or clearly mistaken charge.",
        "Being charged after a confirmed cancellation.",
        "A checkout that took payment but did not deliver the balance it should have.",
      ]} />
      <P>Please contact us before opening a chargeback with your bank, so we can resolve it directly and faster.</P>

      <H>How to cancel</H>
      <P>Cancel or change a plan from your <A href="/billing">billing settings</A> in the app, in a couple of clicks, with no email or phone call required. You can manage cards and view invoices through the Stripe billing portal linked there.</P>

      <H>Contact</H>
      <P>Questions about a charge or this policy? Email <A href="mailto:help@vraelis.com">help@vraelis.com</A>. See also our <A href="/terms">Terms</A> and <A href="/privacy">Privacy Policy</A>.</P>
    </>
  );
}

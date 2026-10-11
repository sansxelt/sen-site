import { v8meta } from "../_kit/meta";
import { LegalPage, OperatorSection, V8_LEGAL_PRIMS } from "../_legal/legal";
import { PrivacyBody } from "@/app/_content/legal";

const { H, P, A } = V8_LEGAL_PRIMS;

export const metadata = v8meta({
  title: "Privacy",
  description: "What this site collects through the contact form and the documentation assistant, what the earlier browser-testing product collected, and the privacy rights that may apply to you.",
  path: "/privacy",
});

/** The abuse line of the shared list, as it is true for what v8 runs: the contact form keeps the IP address (and
 *  the email address) as rate-limit keys, not hashed signals. */
const ABUSE_SIGNALS = "IP addresses used to limit abuse. The contact form keeps the IP address as a rate-limit key, as described under Contact form below. We do not show raw IP or device data in reports.";

// The shared privacy text (app/_content/legal.tsx), with v8's opt-in switches: the closed console's self-service
// routes become an email address, and the abuse line says what v8 keeps. It describes accounts, sign-in, billing and
// API keys of the earlier product, so the page carries the review note above it. The contact form and the
// documentation assistant are v8's own, so their sections are here rather than in the shared text the other
// surfaces render. Both were written from the code (app/api/contact/route.ts, lib/vraelis-ratelimit.ts and the docs
// ask route) on 2026-10-11. Retention states current practice only (founder, 2026-10-11): no deletion period is
// promised until a purge job actually runs.
export default function V8PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="Updated October 2026" review>
      <OperatorSection controller />
      <PrivacyBody {...V8_LEGAL_PRIMS} abuseSignals={ABUSE_SIGNALS} />
      <H>Contact form</H>
      <P>The contact form collects your email address, your name if you give it, the topic you pick and your message. If you write for an organization, it also collects the organization, its country and your role. Resend delivers the message to our inbox and sends you one confirmation email. To limit abuse, your IP address and your email address are kept as rate-limit keys in our database (Supabase), each with a count and a start time. These keys are not deleted automatically at present; a key is reset when the same address is used again after its time window. Your message is kept in our support inbox, and Resend keeps its own record of the delivery.</P>
      <H>Documentation assistant</H>
      <P>Ask AI on the documentation (docs.vraelis.com) answers questions about the docs. By default it answers on our hosting (Vercel) by quoting the matching documentation, and sends nothing to an AI provider. If Vraelis switches on generated answers (the Ask AI panel says so when it does), the question, up to six earlier messages of that conversation and the documentation sections retrieved for it are sent to Anthropic, the AI model provider, to write the answer. Either way, Vraelis does not log the question text and keeps no conversation after the page is closed; your IP address is held in memory for up to an hour to limit abuse. Do not put personal or confidential information in a question. Providers are listed on <A href="/subprocessors">Subprocessors</A>.</P>
    </LegalPage>
  );
}

import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Terms",
  description: "The terms for using Vraelis: what it provides, credits and payments, how to read a Production Pass result, refunds, warranties, liability, and governing law.",
  path: "/terms",
});

const acc = { color: "var(--acc-deep)" };
const strong = { color: "var(--fg-1)" };

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Legal" title="Terms" updated="Updated July 2026">
      <P>These terms cover your use of Vraelis at vraelis.com. By creating an account or using the product, you agree to them. If you do not agree, do not use the service.</P>

      <H>What Vraelis provides</H>
      <P>Vraelis is production validation for AI-built systems. You connect an application, define what it must do in production, and Vraelis returns a structured result:</P>
      <Ul items={[
        "A Production Pass: your requirements executed against your exact build and environment, with the evidence captured from each run.",
        "A truthful production decision and the issues found, tracked across releases.",
        "Plans, an account balance, and a developer API with keys, webhooks, and data exports.",
      ]} />

      <H>Accounts</H>
      <P>You are responsible for your account and for keeping access to it secure. Provide accurate information when you sign up, and do not misuse the service or let others misuse it through your account. Accounts are for one person or organization; do not create multiple accounts to obtain additional free allowances.</P>

      <H>Your content</H>
      <P>You are responsible for the applications, requirements, and content you connect, verify, or share, and you must have the right to use them and to authorize Vraelis to test them. You grant Vraelis a limited license to process that content to provide the service, which includes sending it to our subprocessors (for example, our hosting and browser-execution infrastructure that runs a verification, and the AI model provider that produces an AI assessment). Do not submit content that is illegal, infringing, deceptive, or abusive, and do not submit regulated or highly sensitive personal data you are not permitted to share.</P>

      <H>Balance and payments</H>
      <P>Your account balance funds Production Passes, which are charged when they execute. New accounts start with a free promotional pass allowance, which has no cash value. Payments are processed by Stripe. If a pass cannot start, or no flow executes, the hold is returned to your account automatically.</P>
      <P>Subscriptions renew automatically until cancelled, and you can cancel anytime from the app; access continues until the end of the current billing period. Prices, packs, plans, and limits may change over time. Our <Link href="/refunds" style={acc}>Refund and Cancellation policy</Link> explains what is and is not refundable.</P>

      <H>How to read a Production Pass result</H>
      <P><strong style={strong}>A Vraelis result is evidence from a verification run. It is informational and directional, not a guarantee, a certification, or professional, legal, or financial advice.</strong> A production decision reflects how your exact build behaved against the requirements you defined, under the scenarios that were run; it does not certify that a system is bug-free, safe, or universally production-ready. You are solely responsible for the decisions you make and for anything you choose to ship. Do not rely on a Vraelis result as the sole basis for a decision, and do not present it as a guarantee of quality, safety, performance, or any business outcome.</P>

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
      <P><strong style={strong}>The service and all outputs are provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind, whether express or implied, including the implied warranties of MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, and NON-INFRINGEMENT.</strong> We do not warrant that the service will be uninterrupted or error-free, or that any score, recommendation, or flag is accurate, complete, or reliable.</P>

      <H>Limitation of liability</H>
      <P><strong style={strong}>To the maximum extent permitted by law, Vraelis will not be liable for any indirect, incidental, special, consequential, or exemplary damages, or for any lost profits, revenue, data, or goodwill. Our total aggregate liability for any claim will not exceed the amount you paid Vraelis in the twelve months before the event giving rise to the claim.</strong> Nothing in these terms limits liability that cannot be limited under applicable law, including liability for fraud, gross negligence, or willful misconduct.</P>

      <H>Indemnification</H>
      <P>You will defend, indemnify, and hold Vraelis harmless from claims, damages, and costs arising out of the content you submit, your use of any output, or your violation of these terms or of applicable law.</P>

      <H>Account deletion</H>
      <P>You can request account deletion from your <Link href="/account" style={acc}>account settings</Link> (a confirm-gated request) or by emailing <a href="mailto:privacy@vraelis.com" style={acc}>privacy@vraelis.com</a>. Requests are reviewed manually, so deletion is not instant. Some records may be retained where required for billing, fraud prevention, security, or legal reasons.</P>

      <H>Availability and changes</H>
      <P>The service may change over time. Features may be added, removed, or updated, and we do not guarantee uninterrupted availability. We may update these terms and will keep this page current; material changes take effect when posted, and continued use means you accept them.</P>

      <H>Governing law</H>
      <P>These terms are governed by the laws of the State of California, without regard to its conflict-of-laws rules. For any dispute not otherwise resolved, you agree to the exclusive jurisdiction and venue of the state and federal courts located in California.</P>

      <H>Contact</H>
      <P>Questions about these terms? Email <a href="mailto:help@vraelis.com" style={acc}>help@vraelis.com</a>.</P>
    </LegalShell>
  );
}

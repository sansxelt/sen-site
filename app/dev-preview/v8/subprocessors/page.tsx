import { v8meta } from "../_kit/meta";
import { LegalPage, LegalTable, V8_LEGAL_PRIMS, type LegalCol } from "../_legal/legal";
import { SUBPROCESSORS, SubprocessorsTail } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Subprocessors",
  description: "The third-party services this site and its documentation use, and the ones only the earlier browser-testing product used.",
  path: "/subprocessors",
});

const { P, A } = V8_LEGAL_PRIMS;

// Four columns: the table keeps to the body's measure. The rows are SUBPROCESSORS, the one list a customer DPA
// refers to (app/_content/legal.tsx, unchanged for v6). v8 shows them as they stand for this site (2026-10-11 audit):
// what each one does for the site today, written from the code (Resend and Supabase: app/api/contact/route.ts and
// lib/vraelis-ratelimit.ts; Anthropic: the docs ask route, off by default), with the earlier product's use kept after
// "Earlier product:". A vendor only the earlier product used is marked so. Any other row is shown as the shared list
// has it.
const COLS: LegalCol[] = [{ label: "Subprocessor", kind: "name" }, { label: "Purpose" }, { label: "Data" }, { label: "Region", kind: "nowrap" }];

const EARLIER = "Earlier product: ";
const V8_ROWS: Record<string, { purpose: string; data: string }> = {
  Anthropic: {
    purpose: `Generated Ask AI answers on the documentation, only if they are switched on (off by default). ${EARLIER}the AI model that planned each verification.`,
    data: `Your question, earlier messages of that conversation and the documentation sections retrieved for it. ${EARLIER}the deployment and claim submitted for a verification.`,
  },
  Supabase: {
    purpose: `Contact form rate limiting. ${EARLIER}database, storage, and authentication.`,
    data: `IP address and email address, kept as rate-limit keys. ${EARLIER}account, verifications, balance, content.`,
  },
  Vercel: { purpose: "Hosting", data: "Request and site traffic" },
  Resend: {
    purpose: `Contact form delivery and the confirmation email. ${EARLIER}transactional email (verification, receipts).`,
    data: "Email address, message content",
  },
  Stripe: {
    purpose: "Payment records and payment-event handling for the retired browser-testing product. New product checkout is closed.",
    data: "Billing details, payment status and payment-event records",
  },
};
const EARLIER_ONLY = new Set(["Browserbase", "Google / GitHub"]);

const ROWS = SUBPROCESSORS.map((s) => {
  const v8 = V8_ROWS[s.name];
  const purpose = v8?.purpose ?? (EARLIER_ONLY.has(s.name) ? `${EARLIER}${s.purpose}` : s.purpose);
  return { key: s.name, cells: [s.name, purpose, v8?.data ?? s.data, s.region] };
});
// The retained PayPal webhook authenticates events with PayPal and reads subscription records
// (app/api/paypal/webhook/route.ts, lib/paypal.ts); a closed checkout does not remove that data flow.
ROWS.push({ key: "PayPal", cells: ["PayPal", "Payment records and payment-event handling for the retired browser-testing product. New product checkout is closed.", "Payment and subscription identifiers, status and event records", "United States and other countries"] });

export default function V8SubprocessorsPage() {
  return (
    <LegalPage title="Subprocessors" updated="Updated October 2026" review>
      <P>The third-party services used by this website and documentation, and services associated with former browser-testing users. A purpose marked earlier product concerns that retired product. Payment-event handling remains separate from new checkout, which is closed.</P>
      <LegalTable label="Subprocessors Vraelis uses" cols={COLS} rows={ROWS} />
      <P>Payment providers also describe their own processing. PayPal may process data in the United States and other countries; see its <A href="https://www.paypal.com/us/legalhub/paypal/privacy-full">privacy statement</A>.</P>
      <P>Documentation assistant: by default Ask AI on the documentation quotes the docs and uses no AI provider. Only if Vraelis switches on generated answers (the Ask AI panel says so when it does) does it send your question, the earlier messages of that conversation and the documentation sections retrieved for it to Anthropic to write the answer. Vraelis does not log the question text.</P>
      <SubprocessorsTail {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}

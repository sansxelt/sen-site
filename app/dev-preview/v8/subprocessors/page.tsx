import { v8meta } from "../_kit/meta";
import { LegalPage, LegalTable, V8_LEGAL_PRIMS, type LegalCol } from "../_legal/legal";
import { SUBPROCESSORS, SubprocessorsTail } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Subprocessors",
  description: "The third-party services this site and its documentation use, and the ones only the earlier browser-testing product used.",
  path: "/subprocessors",
});

const { P } = V8_LEGAL_PRIMS;

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
};
const EARLIER_ONLY = new Set(["Browserbase", "Stripe", "Google / GitHub"]);

const ROWS = SUBPROCESSORS.map((s) => {
  const v8 = V8_ROWS[s.name];
  const purpose = v8?.purpose ?? (EARLIER_ONLY.has(s.name) ? `${EARLIER}${s.purpose}` : s.purpose);
  return { key: s.name, cells: [s.name, purpose, v8?.data ?? s.data, s.region] };
});

export default function V8SubprocessorsPage() {
  return (
    <LegalPage title="Subprocessors" updated="Updated October 2026" review>
      <P>The third-party services Vraelis relies on. A purpose marked earlier product is what the service did for the earlier browser-testing product, which is not on sale.</P>
      <LegalTable label="Subprocessors Vraelis uses" cols={COLS} rows={ROWS} />
      <P>Documentation assistant: by default Ask AI on the documentation quotes the docs and uses no AI provider. Only if Vraelis switches on generated answers (the Ask AI panel says so when it does) does it send your question, the earlier messages of that conversation and the documentation sections retrieved for it to Anthropic to write the answer. Vraelis does not log the question text.</P>
      <SubprocessorsTail {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}

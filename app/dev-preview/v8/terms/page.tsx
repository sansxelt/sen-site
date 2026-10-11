import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";
import { TermsBody, TERMS_UPDATED } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Terms",
  description: "The terms for using Vraelis: what it provides, balance and payments, how to read a verification result, refunds, warranties, liability, and governing law.",
  path: "/terms",
});

// The shared terms (app/_content/legal.tsx), unchanged. Accounts, balance and payments, and API keys describe
// the earlier product, so the page carries the review note above them.
export default function V8TermsPage() {
  return (
    <LegalPage title="Terms" updated={TERMS_UPDATED} review>
      <TermsBody {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}

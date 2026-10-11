import { v8meta } from "../_kit/meta";
import { LegalPage, OperatorSection, V8_LEGAL_PRIMS } from "../_legal/legal";
import { TermsBody, TERMS_UPDATED } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Terms",
  description: "The terms written for the earlier Vraelis browser-testing product, still in force for its users while its retirement is resolved. Vraelis Contour is in private development and nothing is on sale.",
  path: "/terms",
});

// The shared terms (app/_content/legal.tsx), unchanged. Accounts, balance and payments, and API keys describe
// the earlier product, so the page carries the review note above them.
export default function V8TermsPage() {
  return (
    <LegalPage title="Terms" updated={TERMS_UPDATED} review>
      <OperatorSection />
      <TermsBody {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}

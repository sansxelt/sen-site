import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";
import { TermsBody, TERMS_UPDATED } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Terms",
  description: "The terms for using Vraelis: what it provides, balance and payments, how to read a verification result, refunds, warranties, liability, and governing law.",
  path: "/terms",
  type: "website",
});

export default function V6TermsPage() {
  return (
    <LegalPage title="Terms" updated={TERMS_UPDATED}>
      <TermsBody {...V6_LEGAL_PRIMS} />
    </LegalPage>
  );
}

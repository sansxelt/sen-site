import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";

export const metadata = v6meta({
  title: "Trademark",
  description: "How the Vraelis name and mark may be used, and the one use that is never permitted: implying that Vraelis verified something it did not.",
  path: "/trademark",
  type: "website",
});

const { H, P, A } = V6_LEGAL_PRIMS;

// A legal page like the others since 2026-10-02 (plan T13): it was a product-page layout with three cards. The
// rules are the ones it had, word for word, and they last changed in July 2026 (git log of this file), so the
// date says July. The contact address is a mailto link of its own (see the note in data-rights/page.tsx).
export default function V6TrademarkPage() {
  return (
    <LegalPage title="Trademark" updated="Updated July 2026">
      <P>Vraelis and the Vraelis mark are trademarks of Vraelis. The usage rules are short, because only one of them is really load bearing.</P>

      <H>You may say you use Vraelis</H>
      <P>Reference the name in plain text to describe that your system is verified with Vraelis. No permission needed, no logo licence required.</P>

      <H>You may link to a verification you own</H>
      <P>A verification record you own may be shared or linked. It carries its own decision, evidence and date, so it speaks for itself.</P>

      <H>You may not imply a verification that did not happen</H>
      <P>This is the one that matters. Do not present the Vraelis name, mark, or any verified-style badge in a way that suggests Vraelis checked something it did not, or that a decision was stronger than the record says. A verification claim that is not backed by a record is exactly the failure this company exists to prevent.</P>

      <H>Contact</H>
      <P>Questions about a specific use, including press and partner materials: <A href="mailto:help@vraelis.com">help@vraelis.com</A>.</P>
    </LegalPage>
  );
}

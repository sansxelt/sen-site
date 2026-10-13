import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";

export const metadata = v8meta({
  title: "Trademark",
  description: "How the names Vraelis and Vraelis Contour may be used, and the one use that is never permitted: suggesting that Vraelis has checked, endorsed or partnered with you or your product.",
  path: "/trademark",
});

const { H, P, A } = V8_LEGAL_PRIMS;

// Ported from app/dev-preview/v6/trademark/page.tsx. The 2026-10-11 audit replaced v6's two sections about saying
// "verified with Vraelis" with one plain rule about the names, since nothing is verified for anyone today. The
// section about a verification record concerns the earlier product, so the page carries the review note like the
// other legal pages. The contact address is a mailto link of its own (see A in _legal/legal.tsx).
export default function V8TrademarkPage() {
  return (
    <LegalPage title="Trademark" updated="Updated October 2026" review>
      <P>Vraelis and the Vraelis mark are trademarks of Vraelis. The usage rules are short, because only one of them is really load bearing.</P>

      <H>Using the names</H>
      <P>You may refer to Vraelis and Vraelis Contour by name in plain text. Do not use the names, or our logo, to suggest that Vraelis has checked, endorsed or partnered with you or your product.</P>

      <section data-nosnippet aria-label="Earlier verification records">
        <H>You may link to a verification you own</H>
        <P>This refers to records from the retired browser-testing product. A verification record you own may be shared or linked. It carries its own decision, evidence and date; it is not a Contour certification or an endorsement. The public site does not offer a verification-record sharing service.</P>
      </section>

      <H>Contact</H>
      <P>Questions about a specific use, including press and partner materials: <A href="mailto:help@vraelis.com">help@vraelis.com</A>.</P>
    </LegalPage>
  );
}

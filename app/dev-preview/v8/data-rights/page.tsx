import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";

export const metadata = v8meta({
  title: "Data rights",
  description: "How to ask Vraelis by email for access to your data, an export, a correction or a deletion, and what deletion cannot undo.",
  path: "/data-rights",
});

const { H, P, A } = V8_LEGAL_PRIMS;

// Ported from app/dev-preview/v6/data-rights/page.tsx (its sections live in that page file, not in the shared legal
// text), word for word except Deletion, which says to email instead of naming the closed console's account settings
// (2026-10-11 audit). It describes accounts and account deletion of the earlier product, so the page carries
// the review note above it. Every address is the only text of its own mailto link (see A in _legal/legal.tsx).
export default function V8DataRightsPage() {
  return (
    <LegalPage title="Data rights" updated="Updated October 2026" review>
      <P>You can ask for access, an export, a correction or deletion of personal data held about you. For this website, that may include an inquiry you sent, its delivery record and contact-form rate-limit records. Vraelis Contour is in private development; sending an inquiry does not create a product account.</P>

      <H>Access and export</H>
      <P>Write to <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A> to request the personal data held about you. For former browser-testing users, this also covers account details, connected systems, verifications and their evidence.</P>

      <H>Correction</H>
      <P>Ask us to correct inaccurate personal data. For former browser-testing users, account details can be corrected. The earlier product&rsquo;s verification records were not editable: a new verification superseded a prior record rather than rewriting it. That describes the retired product, not an available Contour workflow.</P>

      <H>Deletion</H>
      <P>Email <A href="mailto:help@vraelis.com">help@vraelis.com</A> (<A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A> for deletion requests). Requests are reviewed manually, so deletion is not instant. Some records may be retained where required for billing, fraud prevention, security, or legal reasons.</P>

      <section data-nosnippet aria-label="Earlier product data handling">
        <P>The following evidence and connection provisions concern the retired browser-testing product&rsquo;s records, not data collected by the public Contour website.</P>
        <H>Evidence is private by default</H>
        <P>Screenshots and traces live in a private bucket. No public URL is ever produced for them. Reads go through short-lived signed URLs that only an authorized owner can mint.</P>

        <H>Secrets are not held as text</H>
        <P>Credentials you connect are encrypted at rest and never returned to the browser. Deleting a connection removes them.</P>

        <H>What deletion cannot reach</H>
        <P>If you deliberately shared a verification record with someone outside your account, deleting your data removes the record here but cannot recall a copy someone already saved. Said plainly, because the alternative is implying a guarantee that no system can make.</P>
      </section>

      <H>Contact</H>
      <P>To exercise any of this, email <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>. The full terms are in our <A href="/privacy">Privacy Policy</A>, and the processors involved are listed on <A href="/subprocessors">Subprocessors</A>.</P>
    </LegalPage>
  );
}

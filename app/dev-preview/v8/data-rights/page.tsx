import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";

export const metadata = v8meta({
  title: "Data rights",
  description:
    "Access, export and deletion: what Vraelis holds, what leaving actually removes, and the one thing deletion cannot undo, which is a verification record someone else already relied on.",
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
      <P>What is held, and what leaving actually removes: access, export, correction and deletion, in specifics rather than in the abstract, including the one thing deletion cannot undo.</P>

      <H>Access and export</H>
      <P>Ask and you get what is held about you: your account, your connected systems, your verifications and their evidence. Write to <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>.</P>

      <H>Correction</H>
      <P>Anything wrong in your account details can be corrected. A verification record cannot be edited, because a record that can be rewritten after the fact is not evidence. It can be superseded by a new verification, and both remain readable.</P>

      <H>Deletion</H>
      <P>Email <A href="mailto:help@vraelis.com">help@vraelis.com</A> (<A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A> for deletion requests). Requests are reviewed manually, so deletion is not instant. Some records may be retained where required for billing, fraud prevention, security, or legal reasons.</P>

      <H>Evidence is private by default</H>
      <P>Screenshots and traces live in a private bucket. No public URL is ever produced for them. Reads go through short-lived signed URLs that only an authorized owner can mint.</P>

      <H>Secrets are not held as text</H>
      <P>Credentials you connect are encrypted at rest and never returned to the browser. Deleting a connection removes them.</P>

      <H>What deletion cannot reach</H>
      <P>If you deliberately shared a verification record with someone outside your account, deleting your data removes the record here but cannot recall a copy someone already saved. Said plainly, because the alternative is implying a guarantee that no system can make.</P>

      <H>Contact</H>
      <P>To exercise any of this, email <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>. The full terms are in our <A href="/privacy">Privacy Policy</A>, and the processors involved are listed on <A href="/subprocessors">Subprocessors</A>.</P>
    </LegalPage>
  );
}

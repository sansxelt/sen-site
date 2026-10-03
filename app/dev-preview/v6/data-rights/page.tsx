import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";

export const metadata = v6meta({
  title: "Data rights",
  description:
    "Access, export and deletion: what Vraelis holds, what leaving actually removes, and the one thing deletion cannot undo, which is a verification record someone else already relied on.",
  path: "/data-rights",
  type: "website",
});

const { H, P, A } = V6_LEGAL_PRIMS;

// A legal page like the others since 2026-10-02 (plan T13): it was a product-page layout with two styles of card.
// The words are the ones it had, with one correction. Deletion said the product removes everything at once ("the
// rows go"); the product takes a confirm-gated REQUEST that a person reviews (app/api/v/account/delete), so that
// section now says what the Terms already say about account deletion.
//
// THE REACT #418 THIS PAGE THREW ON vraelis.com. The closing note had privacy@vraelis.com as plain text in a
// paragraph that also held two links. Cloudflare's email obfuscation rewrites an address in the HTML into a
// placeholder that its script turns back into text, which leaves the address as a text node of its own, and React
// then found ". To exercise any of this: " where it expected the whole sentence. Every address on this page is
// now the only text of its own mailto link (A in _system/legal.tsx), which hydrates by comparing the element's
// whole text and is unaffected.
export default function V6DataRightsPage() {
  return (
    <LegalPage title="Data rights" updated="Updated October 2026">
      <P>What is held, and what leaving actually removes: access, export, correction and deletion, in specifics rather than in the abstract, including the one thing deletion cannot undo.</P>

      <H>Access and export</H>
      <P>Ask and you get what is held about you: your account, your connected systems, your verifications and their evidence. Write to <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>.</P>

      <H>Correction</H>
      <P>Anything wrong in your account details can be corrected. A verification record cannot be edited, because a record that can be rewritten after the fact is not evidence. It can be superseded by a new verification, and both remain readable.</P>

      <H>Deletion</H>
      <P>You can request account deletion from your <A href="/account">account settings</A> (a confirm-gated request) or by emailing <A href="mailto:privacy@vraelis.com">privacy@vraelis.com</A>. Requests are reviewed manually, so deletion is not instant. Some records may be retained where required for billing, fraud prevention, security, or legal reasons.</P>

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

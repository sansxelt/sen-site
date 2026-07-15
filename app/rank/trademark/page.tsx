import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Trademark",
  description: "How the Vraelis name and logo may be used.",
  path: "/trademark",
});

export default function TrademarkPage() {
  return (
    <LegalShell eyebrow="Legal" title="Trademark" intro="Vraelis is the brand name of our production verification product for AI-built applications and systems. These guidelines explain how the name and logo may be used.">
      <H>Using the Vraelis name</H>
      <Ul items={[
        "Vraelis is our brand name. We may show it as Vraelis™ to indicate that we claim the mark.",
        "We do not use the registered trademark symbol, because the mark is not registered.",
        "Do not imply partnership, sponsorship, endorsement, or approval by Vraelis without our written permission.",
        "Do not modify the Vraelis name or logo.",
        "Do not use Vraelis branding in a way that could confuse people about who made something.",
        "Do not use Vraelis marks in a competing product, in misleading ads, or to impersonate us.",
        "When you refer to Vraelis, use the name clearly and accurately.",
      ]} />

      <H>Contact</H>
      <P>Questions about brand use? Email <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)" }}>help@vraelis.com</a>.</P>
    </LegalShell>
  );
}

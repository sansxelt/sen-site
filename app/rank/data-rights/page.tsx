import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Data rights",
  description: "How to access, correct, delete, or export your data on Vraelis.",
  path: "/data-rights",
});

export default function DataRightsPage() {
  return (
    <LegalShell eyebrow="Privacy" title="Data rights" intro="Manage your data on Vraelis. Signed-in users can submit requests from account settings; you can also email privacy@vraelis.com.">
      <H>Submit a request</H>
      <P>From <Link href="/app/account" style={{ color: "var(--acc-deep)" }}>account settings</Link>, signed-in users can submit a request to:</P>
      <Ul items={[
        "Export the account data we hold about you.",
        "Correct your account information.",
        "Delete your account and data (a confirm-gated request).",
      ]} />
      <P>Prefer email? Write to <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a> and we will handle it the same way.</P>

      <H>Self-serve controls</H>
      <Ul items={[
        "Disable a public report link from that report's controls.",
        "Delete API keys you no longer use.",
        "Remove webhook endpoints you have added.",
        "Export any completed report as JSON or CSV.",
      ]} />

      <H>How requests are handled</H>
      <Ul items={[
        "Requests are reviewed manually. Account deletion is not instant.",
        "Some billing, security, and legal records may be retained where required.",
        "Public report links may be disabled while a deletion request is processed.",
        "Raw participant, IP, and device data is never shown in reports or exports.",
      ]} />
      <P>This is an honest description of our process, not a claim of automated regulatory compliance. See the <Link href="/privacy" style={{ color: "var(--acc-deep)" }}>Privacy</Link> page for what we collect and why.</P>
    </LegalShell>
  );
}

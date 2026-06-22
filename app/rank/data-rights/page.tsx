import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Data rights",
  description: "How to access, correct, delete, or export your data on Vraelis.",
  path: "/data-rights",
});

export default function DataRightsPage() {
  return (
    <LegalShell eyebrow="Privacy" title="Data rights" intro="Here is how to manage your data on Vraelis, or request a change. For anything that is not self-serve, email privacy@vraelis.com.">
      <H>What you can do</H>
      <Ul items={[
        "Request access to the account data we hold about you.",
        "Request a correction to your account information.",
        "Request deletion of your account and data.",
        "Disable a public report link from that report's controls.",
        "Delete API keys you no longer use.",
        "Remove webhook endpoints you have added.",
        "Export your test and report data as JSON or CSV, where available.",
        "Contact support to delete your account. For safety, deletion may be handled manually.",
      ]} />

      <H>Good to know</H>
      <Ul items={[
        "Billing records may be retained where required for accounting, fraud prevention, or legal reasons.",
        "Raw voter, IP, and device data is never shown in reports.",
      ]} />

      <H>Contact</H>
      <P>To make a request, email <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>. For more detail on what we collect and why, see the <a href="/privacy" style={{ color: "var(--acc-deep)" }}>Privacy</a> page.</P>
    </LegalShell>
  );
}

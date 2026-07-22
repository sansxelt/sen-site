import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { H, P, LegalShell } from "../_components/legal-ui";

export const metadata = ogMeta({
  title: "Subprocessors",
  description: "The third-party services Vraelis uses to run the product, what each one does, and where they process data.",
  path: "/subprocessors",
});

const acc = { color: "var(--acc-deep)" };

// Named subprocessors. Keep this in sync with the vendors the product actually calls; it's
// what B2B/enterprise buyers and a customer DPA reference.
const SUBS: { name: string; purpose: string; data: string; region: string }[] = [
  { name: "Anthropic", purpose: "AI model that runs each verification", data: "The deployment and claim you submit for a verification", region: "United States" },
  { name: "Supabase", purpose: "Database, storage, and authentication", data: "Account, checks, credits, content", region: "United States" },
  { name: "Vercel", purpose: "Application hosting and delivery", data: "Request and app traffic", region: "United States / global edge" },
  { name: "Cloudflare", purpose: "DNS, CDN, and DDoS protection", data: "Request metadata", region: "Global edge" },
  { name: "Stripe", purpose: "Payments and subscription billing", data: "Billing details, payment status", region: "United States" },
  { name: "Resend", purpose: "Transactional email (verification, receipts)", data: "Email address, message content", region: "United States" },
  { name: "Google / GitHub", purpose: "Optional single sign-on", data: "Email and basic profile, only if you use it", region: "United States" },
];

const th = { textAlign: "left" as const, fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "var(--fg-4)", padding: "0 14px 10px 0", fontWeight: 600 };
const td = { fontSize: 14, color: "var(--fg-2)", padding: "12px 14px 12px 0", borderTop: "1px solid var(--line-1)", verticalAlign: "top" as const, lineHeight: 1.5 };

export default function SubprocessorsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Subprocessors"
      updated="Updated July 2026"
      intro="The third-party services Vraelis relies on to run the product. Verification runs against your connected application use our hosting and browser-execution infrastructure, and any AI assessment is sent to the AI model provider."
    >
      <div style={{ overflowX: "auto", margin: "6px 0 8px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={th}>Subprocessor</th>
              <th style={th}>Purpose</th>
              <th style={th}>Data</th>
              <th style={th}>Region</th>
            </tr>
          </thead>
          <tbody>
            {SUBS.map((s) => (
              <tr key={s.name}>
                <td style={{ ...td, color: "var(--fg-1)", fontWeight: 600, whiteSpace: "nowrap" }}>{s.name}</td>
                <td style={td}>{s.purpose}</td>
                <td style={td}>{s.data}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{s.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>Data location and transfers</H>
      <P>Several subprocessors process data in the United States. Where personal data is transferred internationally, the transfer relies on the subprocessors&apos; own standard contractual clauses and safeguards. Each subprocessor is engaged under its own data-processing terms.</P>

      <H>Changes</H>
      <P>We may add or replace a subprocessor as the product evolves. When we make a material change we will update this page. If you need advance notice of new subprocessors for a contract, contact us and we can arrange it.</P>

      <H>Contact</H>
      <P>Questions about a subprocessor or a data-processing agreement? Email <a href="mailto:privacy@vraelis.com" style={acc}>privacy@vraelis.com</a>. See also our <Link href="/privacy" style={acc}>Privacy Policy</Link> and <Link href="/data-rights" style={acc}>Data rights</Link>.</P>
    </LegalShell>
  );
}

import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Privacy",
  description: "How Vraelis handles your data.",
  path: "/privacy",
});

function H({ children }: { children: ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.2rem, 2vw, 1.5rem)", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: "1.8em 0 0.5em" }}>{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--fg-2)", margin: "0 0 1em" }}>{children}</p>;
}

export default function PrivacyPage() {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(28px, 4vw, 52px)" }}>
        <p className="eyebrow">Legal</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 3.4vw, 2.8rem)", marginBottom: 8 }}>Privacy</h1>
        <p style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 24 }}>Updated June 2026</p>

        <P>This page explains what data Vraelis collects and how we use it. It applies to the website and app at vraelis.com.</P>

        <H>What we store</H>
        <P>Your account details (name and email), the tests and options you create, the votes and comments collected on your tests, and your billing records. We store this to run the product and show you your results.</P>

        <H>Vote quality</H>
        <P>To keep feedback honest, we filter low-quality votes. This may use hashed device and IP signals to detect duplicate or automated voting. We do not show raw device or IP data in your reports.</P>

        <H>Payments</H>
        <P>Payments are processed by Stripe. Card details are handled by Stripe, not stored by Vraelis.</P>

        <H>Sharing</H>
        <P>Reports are private by default. If you turn on a public report link, anyone with that link can view a read-only version. It never includes your account, billing, or voter identity data.</P>

        <H>Contact</H>
        <P>Questions about privacy? Email <a href="mailto:privacy@vraelis.com" style={{ color: "var(--acc-deep)" }}>privacy@vraelis.com</a>.</P>
      </div>
    </section>
  );
}

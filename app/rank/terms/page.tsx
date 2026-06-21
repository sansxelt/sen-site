import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Terms",
  description: "The terms for using Vraelis.",
  path: "/terms",
});

function H({ children }: { children: ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.2rem, 2vw, 1.5rem)", letterSpacing: "-0.02em", color: "var(--fg-1)", margin: "1.8em 0 0.5em" }}>{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--fg-2)", margin: "0 0 1em" }}>{children}</p>;
}

export default function TermsPage() {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(28px, 4vw, 52px)" }}>
        <p className="eyebrow">Legal</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 3.4vw, 2.8rem)", marginBottom: 8 }}>Terms</h1>
        <p style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 24 }}>Updated June 2026</p>

        <P>These terms cover your use of Vraelis. By using the product you agree to them.</P>

        <H>What Vraelis does</H>
        <P>Vraelis lets you test creative options with real people and get a report. It includes voting, reports, a public API, webhooks, data exports, and credit-based testing.</P>

        <H>Your content</H>
        <P>You are responsible for the content you upload or test. Do not upload anything you do not have the right to use, or anything illegal or harmful.</P>

        <H>Credits</H>
        <P>Credits pay for valid human judgments. One credit equals one valid judgment. Invalid votes may be filtered and do not count. Credits held for votes that are never collected are refunded when a test completes.</P>

        <H>Changes</H>
        <P>The product may change over time as we add and improve features. We may update these terms, and we will keep this page current.</P>

        <H>Contact</H>
        <P>Questions about these terms? Email <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)" }}>help@vraelis.com</a>.</P>
      </div>
    </section>
  );
}

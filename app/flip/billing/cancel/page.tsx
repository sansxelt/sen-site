import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Checkout canceled — Flip Engine" };

export default function FlipBillingCancel() {
  return (
    <main style={{ background: "#FBFAF8", color: "#16130F", minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 780, letterSpacing: "-0.02em", margin: "0 0 8px" }}>No worries.</h1>
        <p style={{ color: "#6B6258", fontSize: 15, lineHeight: 1.55, margin: "0 0 22px" }}>Checkout was canceled — nothing was charged. Your free listings are still here whenever you want them.</p>
        <Link href="/flip/app" style={{ display: "inline-flex", padding: "12px 22px", borderRadius: 12, border: "1px solid #E0DACF", background: "#fff", color: "#16130F", fontWeight: 650, textDecoration: "none" }}>Back to the tool</Link>
      </div>
    </main>
  );
}

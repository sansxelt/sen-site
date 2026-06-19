import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "You're Pro — Flip Engine" };

export default function FlipBillingSuccess() {
  return (
    <main style={{ background: "#FBFAF8", color: "#16130F", minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(14,138,79,0.1)", border: "1px solid rgba(14,138,79,0.3)", color: "#0E8A4F", display: "grid", placeItems: "center", margin: "0 auto 18px", fontSize: 24 }}>✓</div>
        <h1 style={{ fontSize: 24, fontWeight: 780, letterSpacing: "-0.02em", margin: "0 0 8px" }}>You&apos;re Pro.</h1>
        <p style={{ color: "#6B6258", fontSize: 15, lineHeight: 1.55, margin: "0 0 22px" }}>Unlimited listings are unlocked. Go list everything.</p>
        <Link href="/flip/app" style={{ display: "inline-flex", padding: "12px 22px", borderRadius: 12, background: "#0E8A4F", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Back to the tool →</Link>
      </div>
    </main>
  );
}

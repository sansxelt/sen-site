import type { Metadata } from "next";
import { reconcileSessionById } from "@/lib/vraelis-payment-settle";

export const metadata: Metadata = {
  title: "Payment — Vraelis",
  robots: { index: false, follow: false },
};

export default async function PayThanksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const canceled = Boolean(params.canceled);
  // Self-heal: if the buyer lands here with a session id, settle it now in
  // case the webhook is delayed or was dropped. Idempotent — a no-op once the
  // webhook (or a prior visit) already recorded the payment.
  const sessionId = String(Array.isArray(params.session_id) ? params.session_id[0] : params.session_id ?? "");
  if (sessionId && !canceled) {
    await reconcileSessionById(sessionId);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F7F6F1", padding: 24, fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 20px", display: "grid", placeItems: "center", background: canceled ? "#EFE9E1" : "#0E9E6C", color: canceled ? "#8A7F70" : "#fff", fontSize: 26 }}>
          {canceled ? "×" : "✓"}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: "#1A1A17", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          {canceled ? "Payment canceled" : "Payment received"}
        </h1>
        <p style={{ fontSize: 15, color: "#5C564C", lineHeight: 1.6, margin: 0 }}>
          {canceled
            ? "No charge was made. You can close this tab, or use your payment link again whenever you're ready."
            : "Thank you — your payment went through and a receipt is on its way to your email. You're all set."}
        </p>
        <p style={{ fontSize: 12.5, color: "#9A9182", marginTop: 24, fontFamily: "'JetBrains Mono', monospace" }}>
          Powered by Vraelis
        </p>
      </div>
    </main>
  );
}

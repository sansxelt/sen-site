// Danger-zone placeholder. Self-serve account deletion is intentionally NOT wired
// yet — real deletion needs a dedicated data-safety pass (Stripe records, public
// reports, billing retention, credits, keys, webhooks). For now this drafts the UX
// and routes the request to support. No destructive action runs from the client.

export function DeleteAccount() {
  return (
    <div className="card" style={{ borderColor: "rgba(220,38,38,0.28)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Delete account</div>
          <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2, maxWidth: 480, lineHeight: 1.5 }}>Deleting your account permanently removes your tests, reports, credits, API keys, and webhooks. To request deletion, email us and we&apos;ll process it. Self-serve deletion is coming soon.</div>
        </div>
        <a href="mailto:help@vraelis.com?subject=Delete%20my%20Vraelis%20account" className="btn btn--ghost" style={{ color: "var(--err)", borderColor: "rgba(220,38,38,0.3)", whiteSpace: "nowrap" }}>Request deletion</a>
      </div>
    </div>
  );
}

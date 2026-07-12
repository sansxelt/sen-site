// The ONLY place raw provider identifiers may render (V1.1 rule: no raw Stripe IDs in normal UI).
// A collapsed disclosure at the bottom of the billing page for support conversations; everything a
// normal user needs lives in the native cards above it.

export function TechnicalDetails({ items }: { items: [label: string, value: string][] }) {
  const rows = items.filter(([, v]) => Boolean(v));
  if (rows.length === 0) return null;
  return (
    <details style={{ marginTop: 26 }}>
      <summary style={{ cursor: "pointer", fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)" }}>
        Technical details
      </summary>
      <div style={{ marginTop: 10, border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)", background: "var(--bg-2)", padding: "10px 14px", display: "grid", gap: 6 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)", minWidth: 150 }}>{label}</span>
            <code style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-3)", wordBreak: "break-all" }}>{value}</code>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
        Reference these identifiers when writing to help@vraelis.com about a billing question.
      </p>
    </details>
  );
}

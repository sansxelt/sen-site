// Provenance chip for a contract requirement (S7): "From your prompt", "From Stripe connection",
// "Vraelis inference", "Added manually"... Inferred requirements render muted (dashed hairline, quieter
// ink) with an explicit "inferred" qualifier so a presence-signal suggestion can never masquerade as an
// observed fact. Pure presentational, no hooks: usable from the read-only server page and the client
// editor alike. Labels come from sourceChipInfo (labels.ts), which maps every machine value to a human
// phrase; no raw enum ever reaches the UI.
import { sourceChipInfo } from "./labels";

export function ProvenanceChip({ source, origin }: { source: string | null | undefined; origin?: string | null }) {
  const { label, inferred, qualifier } = sourceChipInfo(source, origin);
  return (
    <span
      className="pill"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11,
        color: inferred ? "var(--fg-4)" : "var(--fg-3)",
        borderColor: "var(--line-2)",
        borderStyle: inferred ? "dashed" : "solid",
        background: inferred ? "transparent" : "var(--bg-2)",
      }}
    >
      {label}
      {qualifier ? (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)" }}>
          {qualifier}
        </span>
      ) : null}
    </span>
  );
}

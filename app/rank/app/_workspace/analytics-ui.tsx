import type { ReactNode } from "react";

export function SectionHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, margin: "0 0 12px" }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>{children}</div>
      {right}
    </div>
  );
}

// Horizontal bars for breakdowns (category, project, filter reasons).
export function Bars({ rows, unit = "" }: { rows: { label: string; value: number; sub?: string }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, gap: 10 }}>
            <span style={{ color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}{r.sub ? <span style={{ color: "var(--fg-4)", marginLeft: 8, fontSize: 11.5 }}>{r.sub}</span> : null}</span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-1)", fontWeight: 600, flex: "none" }}>{r.value.toLocaleString()}{unit}</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "var(--bg-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((r.value / max) * 100)}%`, background: "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// 30-day trend as vertical mini-bars (no dependency).
export function Spark({ data, caption }: { data: number[]; caption?: string }) {
  const max = Math.max(1, ...data);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 46 }} aria-hidden>
        {data.map((v, i) => (
          <div key={i} title={String(v)} style={{ flex: 1, minWidth: 2, height: `${Math.max(4, Math.round((v / max) * 100))}%`, background: v > 0 ? "var(--acc)" : "var(--line-2)", opacity: v > 0 ? 0.9 : 0.45, borderRadius: 2 }} />
        ))}
      </div>
      {caption ? <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)", marginTop: 7 }}>{caption}</div> : null}
    </div>
  );
}

// Segmented distribution bar + legend (confidence / signal quality).
export function Dist({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((a, i) => a + i.value, 0);
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: "var(--bg-2)", marginBottom: 12 }}>
        {total > 0 ? items.filter((i) => i.value > 0).map((i) => <div key={i.label} title={`${i.label}: ${i.value}`} style={{ width: `${(i.value / total) * 100}%`, background: i.color }} />) : null}
      </div>
      <div style={{ display: "flex", gap: "10px 18px", flexWrap: "wrap" }}>
        {items.map((i) => (
          <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--fg-3)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: i.color, flex: "none" }} />{i.label} <b style={{ color: "var(--fg-1)" }}>{i.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// Distribution palettes (shared so /app/data, projects, and quality match).
export const CONF_COLORS = { Strong: "var(--acc-deep)", Moderate: "var(--acc)", Tentative: "#C9A227", Inconclusive: "var(--line-3)" };
export const SIGNAL_COLORS = { Clean: "var(--acc)", Limited: "var(--money)", NeedsMore: "var(--line-3)" };

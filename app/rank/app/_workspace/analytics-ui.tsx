import type { ReactNode } from "react";
import { healthTone, type HealthState } from "@/lib/v-intelligence";

const HEALTH_BG: Record<string, string> = { good: "var(--acc-soft)", warn: "var(--bg-1)", bad: "rgba(220,38,38,0.10)", neutral: "var(--bg-1)" };
const HEALTH_FG: Record<string, string> = { good: "var(--acc-deep)", warn: "var(--money)", bad: "var(--err)", neutral: "var(--fg-3)" };

// Evaluation-health pill (Ready to decide / Needs more judgments / Noisy signal / …).
export function HealthBadge({ state }: { state: string }) {
  const tone = healthTone(state as HealthState);
  return <span className="pill" style={{ background: HEALTH_BG[tone], color: HEALTH_FG[tone], borderColor: "var(--line-2)", fontSize: 10.5 }}>{state}</span>;
}

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

// 30-day trend as vertical mini-bars (no dependency). Kept for any lightweight
// inline use; the fuller /app/data trend cards use <TrendChart> below.
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

// Clean number for a headline / axis label: 1200 -> "1.2k", 34000 -> "34k".
function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n < 1000) return n.toLocaleString();
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

// Round a peak up to a clean axis bound (1/2/5 x 10^k) so the tallest bar sits
// below the labeled cap and the Y-axis label reads cleanly (10, 20, 50, 100…).
function niceMax(peak: number): number {
  if (peak <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(peak)));
  const frac = peak / pow;
  const step = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return step * pow;
}

// Framed 30-day trend: vertical bars over a real baseline axis, a clean labeled
// Y-max, faint gridlines, an x-axis span, and a headline total + honest delta.
// Honest at 1 event (bar sits full-height under a Y-max of 1, 29 gray zero-stubs
// rest on the baseline) and honest at 0 events (flat gray line, "new" chip, note).
// data = 30 daily buckets, index 0 = 29 days ago, index 29 = today. No invention.
// The caller keeps its own <SectionHead>{label}</SectionHead>; this is the body.
export function TrendChart({ data, label, caption, tone = "acc" }: { data: number[]; label: string; caption?: string; tone?: "acc" | "money" }) {
  const H = 104; // plot height in px
  // guard: drop non-finite, clamp negatives, a stray null/NaN day can't break the chart.
  const series = data.slice(0, 30).map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const peak = Math.max(0, ...series);
  const total = series.reduce((a, v) => a + v, 0);
  const last7 = series.slice(-7).reduce((a, v) => a + v, 0);
  const first = series.slice(0, 15).reduce((a, v) => a + v, 0);
  const recent = series.slice(15).reduce((a, v) => a + v, 0);
  const hasData = total > 0;
  const axisMax = niceMax(peak);

  // honest delta: "new" when there's no prior-half activity to compare against —
  // a single fresh event reads "new", not a misleading "+100%".
  const isNew = first === 0;
  const delta = isNew ? 0 : Math.round(((recent - first) / first) * 100);
  const deltaUp = !isNew && delta > 0;
  const deltaDown = !isNew && delta < 0;
  const deltaText = !hasData || isNew ? "new" : delta === 0 ? "flat" : `${deltaUp ? "+" : ""}${delta}%`;
  const deltaColor = deltaUp ? "var(--acc-deep)" : deltaDown ? "var(--err)" : "var(--fg-4)";
  const deltaBg = deltaUp ? "var(--acc-soft)" : deltaDown ? "rgba(255,100,112,0.08)" : "var(--bg-1)";

  const barColor = tone === "money" ? "var(--money)" : "var(--acc)";
  const barTop = tone === "money" ? "var(--warn)" : "var(--acc-line-2)";
  const mono = { fontFamily: "var(--font-mono)" } as const;
  const grids = [0.25, 0.5, 0.75];

  return (
    <div>
      {/* headline: 30-day total + honest delta chip */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 27, fontWeight: 600, color: "var(--fg-1)", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(total)}</div>
        <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>in last 30 days</div>
        <span title={hasData && !isNew ? `Second half vs first half of the window: ${deltaText}` : "No prior activity to compare against yet"}
          style={{ ...mono, marginLeft: "auto", fontSize: 10, fontWeight: 600, letterSpacing: "0.02em", padding: "3px 8px", borderRadius: 99, color: deltaColor, background: deltaBg, border: "1px solid var(--line-2)", whiteSpace: "nowrap" }}>
          {deltaText} <span style={{ color: "var(--fg-5)", fontWeight: 400 }}>vs prior 15d</span>
        </span>
      </div>

      {/* framed plot: Y-max gutter + gridded bar field over a baseline */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ ...mono, width: 28, height: H, position: "relative", flex: "none", fontSize: 9.5, color: "var(--fg-5)", textAlign: "right" }} aria-hidden>
          <span style={{ position: "absolute", top: -4, right: 0, lineHeight: 1 }}>{fmt(axisMax)}</span>
          <span style={{ position: "absolute", bottom: -4, right: 0, lineHeight: 1 }}>0</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: "relative", height: H }}>
            {grids.map((g) => (
              <div key={g} aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: `${g * 100}%`, height: 1, background: "var(--line-2)" }} />
            ))}
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: "var(--line-3)" }} />
            <div role="img" aria-label={hasData ? `${label}: ${total} over 30 days, peak ${peak} in a day` : `${label}: no activity in the last 30 days`}
              style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 2 }}>
              {series.map((v, i) => {
                const daysAgo = series.length - 1 - i;
                const day = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
                const active = v > 0;
                const pct = active ? Math.max(8, Math.round((v / (axisMax || 1)) * 100)) : 0;
                return (
                  <div key={i} title={`${v.toLocaleString()} | ${day}`}
                    style={{ flex: 1, minWidth: 2, height: active ? `${pct}%` : 2, background: active ? `linear-gradient(180deg, ${barTop}, ${barColor})` : "var(--line-2)", opacity: active ? 1 : 0.55, borderRadius: active ? "2px 2px 0 0" : 1 }} />
                );
              })}
            </div>
          </div>
          <div style={{ ...mono, display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--fg-5)", marginTop: 6 }} aria-hidden>
            <span>30d ago</span><span>today</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
        <span style={{ ...mono, fontSize: 10.5, color: "var(--fg-4)" }}>{fmt(last7)} in last 7 days</span>
        {caption ? <><span style={{ color: "var(--fg-5)" }}>|</span><span style={{ ...mono, fontSize: 10.5, color: "var(--fg-4)" }}>{caption}</span></> : null}
      </div>

      {!hasData ? (
        <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 8, lineHeight: 1.5 }}>Nothing recorded in this window yet, bars fill in here as activity lands.</div>
      ) : null}
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

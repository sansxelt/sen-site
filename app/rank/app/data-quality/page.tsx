import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { dataQuality } from "@/lib/v-analytics";
import { SectionHead, Bars } from "../_workspace/analytics-ui";

export const metadata: Metadata = { title: "Data quality" };

export default async function DataQualityPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fdata-quality");
  const q = await dataQuality(email);
  const hasData = q.responses > 0;

  return (
    <div className="wrap" style={{ maxWidth: 900, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Signal quality</p>
          <h1 className="display">Data quality</h1>
          <p>Vraelis filters low-quality responses before they influence your decision reports — so the recommendation reflects clean human signal, not noise.</p>
        </div>
        <a href="/app/data" className="btn btn--ghost">← Analytics</a>
      </div>

      {!hasData ? (
        <div className="card" style={{ textAlign: "center", padding: "clamp(32px, 6vw, 64px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 8 }}>No signal yet</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.55 }}>Run an evaluation and collect judgments to see how much low-quality signal Vraelis filters out for you — too-fast responses, duplicates, and spam.</p>
          <a href="/app/new" className="btn btn--lg">Create an evaluation →</a>
        </div>
      ) : (
        <>
          <div className="tile-grid cols-4" style={{ marginBottom: 26 }}>
            <div className="stat"><div className="stat__l">Valid judgments</div><div className="stat__v tnum">{q.valid.toLocaleString()}</div><div className="stat__s">counted in reports</div></div>
            <div className="stat"><div className="stat__l">Filtered out</div><div className="stat__v tnum">{q.filtered.toLocaleString()}</div><div className="stat__s">never influenced a result</div></div>
            <div className="stat"><div className="stat__l">Filter rate</div><div className="stat__v tnum">{q.filterRate}%</div><div className="stat__s">of {q.responses.toLocaleString()} responses</div></div>
            <div className="stat"><div className="stat__l">Clean signal</div><div className="stat__v tnum">{q.cleanPct}%</div><div className="stat__s">valid share</div></div>
          </div>

          <div className="tile-grid cols-2" style={{ marginBottom: 26 }}>
            <div className="card">
              <SectionHead>Why responses were filtered</SectionHead>
              {q.reasons.length > 0 ? <Bars rows={q.reasons.map((r) => ({ label: r.label, value: r.count }))} /> : <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>No responses have been filtered yet — your collected signal has been clean.</p>}
              <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Too-fast, duplicate, source-velocity, device-limit, and low-reputation responses are rejected automatically. Raw voter, IP, and device data is never shown.</p>
            </div>
            <div className="card">
              <SectionHead>Signal across evaluations</SectionHead>
              <Bars rows={[
                { label: "Clean signal", value: q.clean },
                { label: "Limited signal", value: q.limited },
                { label: "Needs more judgments", value: q.needsMore },
              ]} unit=" evals" />
              <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
                <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Completion rate</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{q.completionRate}%</div></div>
                <div><div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>In progress</div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{q.active}</div></div>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: "var(--bg-2)" }}>
            <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: 0, lineHeight: 1.6 }}><strong style={{ color: "var(--fg-1)" }}>Vraelis is a signal-quality layer, not a poll.</strong> Every decision report is built only from valid human judgments — low-quality responses are detected and filtered before they can move a recommendation.</p>
          </div>
        </>
      )}
    </div>
  );
}

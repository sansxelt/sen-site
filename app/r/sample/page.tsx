import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { FREE_REPORT_URL } from "@/lib/links";

// Public, static sample human-validation report, linked from the home "See a real
// report" CTA. It mirrors the real /r/[token] report structure with illustrative
// data, and says so plainly. No real evaluation, no real people, no live numbers.
export const metadata = ogMeta({
  title: "Sample validation report",
  description: "A sample human validation report with real structure and illustrative data. See how real people read back your AI output: the recommendation, why they judged that way, what to change, and an honest method note.",
  path: "/r/sample",
});

const CANDIDATES: [string, string, boolean][] = [
  ["A", "Welcome! You're all set. Start creating and let us know if you need anything.", false],
  ["B", "Welcome. Your workspace is ready. Here's the one thing to do first: import a project, and we'll walk you through the rest. Nothing to set up, and you can undo anything.", true],
];

const BREAKDOWN: [string, number, boolean][] = [["A", 37, false], ["B", 63, true]];

const THEMES: [string, string, string][] = [
  ["B tells people what to do next", "78% of B's reasons mentioned the clear next step.", "“B actually told me what to do first. A just said ‘you're set’ and left me guessing.”"],
  ["A read as dismissive", "A's most common complaint was feeling rushed or unsupported.", "“‘Let us know if you need anything’ feels like being handed the keys and shown the door.”"],
  ["Reassurance mattered", "‘Nothing to set up’ and ‘you can undo anything’ lowered the stakes.", "“Knowing I couldn't break something made me willing to just try it.”"],
];

const CHANGES: string[] = [
  "Ship Version B, but trim it. Two people found it slightly long, so cut to the next step plus the ‘you can undo anything’ reassurance.",
  "Keep one concrete first action (‘import a project’). It out-performed the open-ended ‘start creating.’",
  "Avoid ‘let us know if you need anything’ as the closer; it read as dismissive to a meaningful minority.",
];

const box = { border: "1px solid var(--line-1)", borderRadius: "var(--r-lg)", background: "var(--bg-1)" } as const;
const kicker = { fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

export default function SampleReport() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-2)" }}>
      <div className="wrap" style={{ maxWidth: 760, paddingTop: "clamp(28px, 4vw, 52px)", paddingBottom: 72 }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <Link href="/" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--fg-1)", textDecoration: "none", letterSpacing: "-0.01em" }}>Vraelis</Link>
          <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)" }}>Sample report · illustrative data</span>
        </div>

        {/* header */}
        <p className="eyebrow">Human validation</p>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", margin: "6px 0 10px" }}>Which onboarding message should we ship?</h1>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", ...kicker, marginBottom: 24 }}>
          <span>Complete</span><span>·</span><span>118 qualified judgments</span><span>·</span><span>12 filtered for quality</span>
        </div>

        {/* recommendation */}
        <div className="card card--acc" style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none", display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}>B</div>
          <div>
            <div style={{ ...kicker, color: "var(--acc-deep)" }}>Recommendation</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: "var(--fg-1)" }}>Ship Version B</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2 }}>Preferred by 63% of qualified judgments · directional confidence: strong</div>
            <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.5 }}><strong style={{ color: "var(--fg-1)" }}>99% chance</strong> this is genuinely the preferred version, based on the 118 judgments collected (95% range: 54% to 71% preference). A decision aid, not a guarantee.</div>
          </div>
        </div>

        {/* candidates */}
        <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
          <div style={{ ...kicker, marginBottom: 12 }}>The two versions judged</div>
          <div style={{ display: "grid", gap: 12 }}>
            {CANDIDATES.map(([l, text, win]) => (
              <div key={l} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ flex: "none", width: 26, height: 26, borderRadius: 8, background: win ? "var(--acc-soft)" : "var(--bg-2)", border: `1px solid ${win ? "var(--acc-line)" : "var(--line-2)"}`, color: win ? "var(--acc-deep)" : "var(--fg-4)", display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: 12, fontWeight: 600 }}>{l}</span>
                <p style={{ fontSize: 13.5, color: win ? "var(--fg-1)" : "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* preference breakdown */}
        <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
          <div style={{ ...kicker, marginBottom: 12 }}>Preference breakdown</div>
          <div style={{ display: "grid", gap: 10 }}>
            {BREAKDOWN.map(([l, pct, win]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", width: 14 }}>{l}</span>
                <span style={{ flex: 1, height: 10, borderRadius: 999, background: "var(--bg-2)", border: "1px solid var(--line-1)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${pct}%`, background: win ? "linear-gradient(90deg, var(--acc), var(--acc-deep))" : "var(--line-2)" }} />
                </span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: win ? "var(--acc-deep)" : "var(--fg-4)", width: 36, textAlign: "right" }}>{pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* why people judged */}
        <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
          <div style={{ ...kicker, marginBottom: 14 }}>Why people judged this way</div>
          <div style={{ display: "grid", gap: 16 }}>
            {THEMES.map(([t, stat, quote]) => (
              <div key={t}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>{t}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "2px 0 6px" }}>{stat}</div>
                <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--acc-line-2)" }}>{quote}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "14px 0 0" }}>Themes summarized by AI from real human reasoning. Quotes are verbatim from real judgments. The recommendation and every number come from the human judgments, not the summary.</p>
        </div>

        {/* what to change */}
        <div style={{ ...box, padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
          <div style={{ ...kicker, marginBottom: 12 }}>What to change</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {CHANGES.map((c) => (
              <li key={c} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, alignItems: "flex-start" }}>
                <span style={{ color: "var(--acc-deep)", marginTop: 1 }}>→</span>{c}
              </li>
            ))}
          </ul>
        </div>

        {/* honest method note */}
        <div style={{ ...box, background: "var(--bg-2)", padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 26 }}>
          <div style={{ ...kicker, marginBottom: 8 }}>How to read this</div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.7, margin: 0 }}>
            This is a <strong style={{ color: "var(--fg-2)" }}>sample report with illustrative data</strong> to show the format. In a real run: it&apos;s directional guidance from the human judgments collected, after low-quality responses are filtered out and refunded. The confidence label is derived from the vote distribution, not a statistical guarantee. Evaluators are real people completing evaluation tasks, not vetted experts. It informs your decision; it isn&apos;t a promise of business outcomes.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--fg-1)", marginBottom: 12 }}>Want this on your own output?</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/app/checks/new" className="btn btn--lg">Check your AI output <span aria-hidden>→</span></Link>
            <a href={FREE_REPORT_URL} className="btn btn--ghost btn--lg">Validate on real people</a>
          </div>
        </div>
      </div>
    </div>
  );
}

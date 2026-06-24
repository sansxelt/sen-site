import { ImageResponse } from "next/og";
import { getSharedReport, OPTION_LETTERS } from "@/lib/v-db";

// Per-report 1200×630 social card for shared public reports (/r/<token>). Renders
// ONLY public-safe fields — test title, winner letter, percentage, vote counts —
// never owner/account data. Unknown/disabled/non-viewable tokens fall back to the
// generic Vraelis card, so the image can't be used to probe private state.
export const contentType = "image/png";

const BG = "linear-gradient(135deg, #06140E 0%, #0B2418 52%, #0A7B54 150%)";
const SIZE = { width: 1200, height: 630 };
const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function Card({ eyebrow, title, verdict, metric, accent }: { eyebrow: string; title: string; verdict: string; metric?: string; accent?: boolean }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "sans-serif", color: "#fff", background: BG }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#16C081" }} />
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>Vraelis</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", fontSize: 22, color: "#16C081", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 600 }}>{eyebrow}</div>
        <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 1010 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: accent ? "#7DF0C0" : "rgba(255,255,255,0.85)" }}>{verdict}</div>
          {metric ? <div style={{ display: "flex", fontSize: 29, color: "rgba(255,255,255,0.6)" }}>{metric}</div> : null}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: "rgba(255,255,255,0.6)" }}>
        <div style={{ display: "flex" }}>Real people evaluated. Vraelis reports what wins.</div>
        <div style={{ display: "flex" }}>vraelis.com</div>
      </div>
    </div>
  );
}

const generic = () => <Card eyebrow="Vraelis" title="Evaluate creative and AI outputs with real people." verdict="Get a decision package before you ship." />;

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const data = token ? await getSharedReport(token).catch(() => null) : null;
  const headers = { "cache-control": "public, max-age=300, s-maxage=300" };

  // Fallback for unknown/disabled/non-viewable — identical to a missing token, so
  // the card never reveals whether a private/draft test exists.
  if (!data || (data.test.status !== "active" && data.test.status !== "complete")) {
    return new ImageResponse(generic(), { ...SIZE, headers });
  }
  const { test, report } = data;
  const title = clamp(test.title || "Vraelis report", 92);

  if (test.status === "active") {
    return new ImageResponse(<Card eyebrow="Collecting judgments" title={title} verdict="Real people are evaluating now" metric={`${test.votes_valid}/${test.votes_target} judgments`} accent />, { ...SIZE, headers });
  }
  if (report) {
    const r = report.results;
    const win = r.winner_option_id ? r.ranked.find((x) => x.id === r.winner_option_id) : null;
    if (win) return new ImageResponse(<Card eyebrow="Real-user verdict" title={title} verdict={`Option ${OPTION_LETTERS[win.position]} wins`} metric={`${win.pct}% of ${r.total} judgment${r.total === 1 ? "" : "s"}`} accent />, { ...SIZE, headers });
    return new ImageResponse(<Card eyebrow="Real-user verdict" title={title} verdict="Too close to call" metric={`${r.total} judgment${r.total === 1 ? "" : "s"}`} accent />, { ...SIZE, headers });
  }
  // complete but no report → generic (nothing to show)
  return new ImageResponse(generic(), { ...SIZE, headers });
}

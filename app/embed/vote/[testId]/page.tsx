import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTestWithOptions } from "@/lib/v-db";
import { humanEvalEnabled } from "@/lib/v-entitlements";
import { screeningQuestionsForTest } from "@/lib/v-screening";
import { EmbedVote } from "./embed-vote";
import { EmbedStage } from "./embed-stage";

export const metadata: Metadata = { title: "Vraelis", robots: { index: false, follow: false } };

// Standalone, self-contained evaluation widget meant to be iframed on any site (see /embed.js). Inline
// styles so it renders cleanly regardless of host CSS. This is part of the RETIRED human-evaluation
// product: it stays gated behind the same flag as /vote and the eval ingress — when the flag is off (the
// default and current production state), the widget is a clean 404 so the retired participant surface can
// never render publicly. Code preserved for a future evaluator panel.
export default async function EmbedVotePage({ params }: { params: Promise<{ testId: string }> }) {
  if (!humanEvalEnabled()) notFound();
  const { testId } = await params;
  const data = await getTestWithOptions(testId);
  const live = data && data.test.status === "active";
  // qualifying_options is intentionally NOT sent to the participant (server decides).
  const screening = live ? (await screeningQuestionsForTest(testId)).map((q) => ({ id: q.id, question: q.question, options: q.options, is_required: q.is_required })) : [];

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: "#0d1411", boxSizing: "border-box" }}>
      {/* EmbedStage adds a centered warm backdrop only when opened standalone; when
          iframed on a host site it stays flat/transparent so it never fights the host. */}
      <EmbedStage>
        {/* Lifted stage card — soft depth, subtle accent frame, white top inset. */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #e6efe9", padding: "clamp(20px, 4vw, 30px)", boxSizing: "border-box", boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset, 0 24px 60px -28px rgba(20,40,34,0.30), 0 0 0 1px rgba(14,158,108,0.06), 0 0 44px -14px rgba(14,158,108,0.18)" }}>
          {live ? (
            <EmbedVote testId={testId} title={data!.test.title} options={data!.options} screening={screening} />
          ) : (
            <div style={{ textAlign: "center", padding: "32px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>This evaluation isn&apos;t open right now.</div>
              <p style={{ color: "#5b6b63", fontSize: 13, marginTop: 6 }}>It may have finished collecting responses.</p>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="https://vraelis.com" target="_blank" rel="noopener" style={{ fontSize: 11, color: "#0E9E6C", textDecoration: "none", fontWeight: 600 }}>Powered by Vraelis ↗</a>
        </div>
      </EmbedStage>
    </div>
  );
}

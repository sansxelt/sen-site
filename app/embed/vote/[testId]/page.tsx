import type { Metadata } from "next";
import { getTestWithOptions } from "@/lib/v-db";
import { EmbedVote } from "./embed-vote";

export const metadata: Metadata = { title: "Evaluate — Vraelis", robots: { index: false, follow: false } };

// Standalone, self-contained evaluation widget meant to be iframed on any site
// (see /embed.js). Inline styles so it renders cleanly regardless of host CSS.
export default async function EmbedVotePage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const data = await getTestWithOptions(testId);
  const live = data && data.test.status === "active";

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif", background: "#fff", color: "#0d1411", padding: 18, boxSizing: "border-box", maxWidth: 440, margin: "0 auto" }}>
      {live ? (
        <EmbedVote testId={testId} title={data!.test.title} options={data!.options} />
      ) : (
        <div style={{ textAlign: "center", padding: "32px 12px" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>This evaluation isn&apos;t open right now.</div>
          <p style={{ color: "#5b6b63", fontSize: 13, marginTop: 6 }}>It may have finished collecting responses.</p>
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <a href="https://vraelis.com" target="_blank" rel="noopener" style={{ fontSize: 11, color: "#0E9E6C", textDecoration: "none", fontWeight: 600 }}>Powered by Vraelis ↗</a>
      </div>
    </div>
  );
}

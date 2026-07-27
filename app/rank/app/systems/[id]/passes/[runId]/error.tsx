"use client";

import Link from "next/link";
import { useEffect } from "react";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

// Error boundary for the run report. Nothing technical is rendered; the error
// goes to the console only. Next 16.2 passes unstable_retry (re-fetches the
// segment), so retry prefers it over reset.
export default function RunReportError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error("Run report error:", error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="empty">
        <EmptyIcon d={I.alert} />
        <h3>The report could not be loaded.</h3>
        <p>Your run data is safe. This page just failed to render on our side. Try again, or head back to the overview.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => retry()}>Try again</button>
          <Link href="/app" className="btn btn--ghost">Back to overview</Link>
        </div>
      </div>
    </div>
  );
}

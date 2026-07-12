"use client";

import Link from "next/link";
import { useEffect } from "react";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

// Error boundary for the signed-in app segment. Friendly and quiet: nothing
// technical is rendered; the error goes to the console only. Next 16.2 passes
// unstable_retry (re-fetches the segment), so retry prefers it over reset.
export default function AppError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="wrap" style={{ maxWidth: 960, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="empty">
        <EmptyIcon d={I.alert} />
        <h3>Something went wrong loading this page.</h3>
        <p>This is on our side, not yours. Your account and data are unaffected. Try again, or head back to the overview.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => retry()}>Try again</button>
          <Link href="/app" className="btn btn--ghost">Back to overview</Link>
        </div>
      </div>
    </div>
  );
}

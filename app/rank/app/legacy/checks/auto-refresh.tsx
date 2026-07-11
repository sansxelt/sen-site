"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Poll the server while something on the page is still running (a check being evaluated).
// router.refresh() re-runs the server component, so a running row flips to complete/failed
// with no manual reload. Mounted only when there is a running check; unmounts when done.
export function AutoRefresh({ intervalMs = 3500 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}

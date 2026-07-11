"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While a run is still in flight, re-run the server component on an interval so a queued/running run flips to
// its final decision with no manual reload. Mounted only when the run is non-terminal; unmounts on completion.
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}

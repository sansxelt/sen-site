"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Server actions in this app call revalidatePath() to invalidate the cached
 * server data, but that alone does NOT update an already-mounted client view —
 * the user would have to manually refresh. This hook bridges that gap: when a
 * useActionState result flips to a successful state, it calls router.refresh()
 * once, which re-runs the server component with the fresh data (the dashboard
 * cards, capability chips, checklist, onboarding gate, lead list, etc.).
 *
 * router.refresh() is a SOFT refresh: it re-fetches server components but keeps
 * client component state and in-progress input intact, so editing forms don't
 * lose what the user typed.
 *
 * Pass the action result (or just its `.ok`). The effect fires only on the
 * transition into success (tracked by result identity), never in a loop.
 */
export function useRefreshOnSuccess(result: { ok: boolean } | null | undefined): void {
  const router = useRouter();
  const lastHandled = useRef<unknown>(null);

  useEffect(() => {
    if (result?.ok && lastHandled.current !== result) {
      lastHandled.current = result;
      router.refresh();
    }
  }, [result, router]);
}

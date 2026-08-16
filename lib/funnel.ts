// THE FIVE THINGS WORTH KNOWING BEFORE THERE ARE CUSTOMERS.
//
//   visit  ->  signup  ->  verification started  ->  verification completed  ->  came back
//
// Three of those five were not recorded anywhere. A run being QUEUED was (preflight_run_queued, written by
// the acceptance path), and nothing else was: no visit, no account creation, and nothing at all when a run
// finished, because the worker that finalizes a run lives in a different process and had never logged an
// event. So the one question the next few weeks have to answer, which of these steps people fall out of,
// could not be answered from the data at all.
//
// THE STAGE NAMES LIVE HERE AND NOWHERE ELSE. Each writer imports its own constant from this file and the
// reader below derives every number from the same list. An analytics funnel whose writers and reader each
// carry their own copy of the event names is one rename away from silently reporting zero, and reporting
// zero is indistinguishable from nobody showing up, which is exactly the thing being measured.
//
// WHAT IS DELIBERATELY NOT COLLECTED. No IP, no user agent, no referrer URL, no query strings, no email in
// metadata. logEvent (lib/v-events.ts) already strips keys that look like any of those, and this module
// never tries to pass them. A visit records a path and nothing else. That is enough to answer "how many
// people reached the site and how many started" and not enough to follow anybody around.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { toPublicDecision } from "./preflight/public-decision";

/** A visit to a public marketing page. Anonymous: user_id is null. Written once per browser tab session. */
export const EV_VISIT = "site_visit";
/** An account came into existence. Written where the profile row is first inserted, so every sign-up route
 *  and every OAuth path is covered by one call rather than by remembering to instrument each. */
export const EV_SIGNUP = "account_created";
/** A verification was accepted and queued. Already written by the acceptance path before this module. */
export const EV_RUN_STARTED = "preflight_run_queued";
/** A verification finished and has a decision. Written by the worker at finalize. */
export const EV_RUN_COMPLETED = "preflight_run_completed";

export const FUNNEL_EVENTS = [EV_VISIT, EV_SIGNUP, EV_RUN_STARTED, EV_RUN_COMPLETED] as const;

export type FunnelStage = {
  key: "visit" | "signup" | "started" | "completed" | "repeat";
  label: string;
  /** Total events. For "repeat" this is the number of people, not events. */
  count: number;
  /** Distinct accounts. Null for visits, which are anonymous by design. */
  people: number | null;
};

export type FunnelSummary = {
  stages: FunnelStage[];
  /** Completed runs split by the decision they ended on. */
  decisions: Record<string, number>;
  sinceIso: string;
  /** True when the read hit its row cap, so the numbers are a floor rather than a total. Surfaced rather
   *  than hidden: a truncated count that looks exact is worse than one that says it is truncated. */
  truncated: boolean;
};

// Rows pulled per event type. At the volume this exists to measure (the first handful of users) the whole
// table is far below this, and the cap only matters later, at which point `truncated` says so out loud.
const ROW_CAP = 5000;

/**
 * The funnel, over a window. Counts distinct accounts per stage in JS rather than in SQL because the
 * deployment has no RPC for it and the row counts here are tiny; when that stops being true this is the
 * function to move into a view, and `truncated` is the flag that will say when.
 *
 * ADMIN-ONLY: this reads across every user. Callers must gate with isAdmin() server-side, exactly as
 * recentAuditEvents does.
 */
export async function funnelSummary(days = 30): Promise<FunnelSummary> {
  const sinceIso = new Date(Date.now() - days * 86400e3).toISOString();
  const empty: FunnelSummary = {
    stages: [
      { key: "visit", label: "Visited the site", count: 0, people: null },
      { key: "signup", label: "Created an account", count: 0, people: 0 },
      { key: "started", label: "Started a verification", count: 0, people: 0 },
      { key: "completed", label: "Got a decision", count: 0, people: 0 },
      { key: "repeat", label: "Came back for another", count: 0, people: 0 },
    ],
    decisions: {},
    sinceIso,
    truncated: false,
  };
  if (!isDatabaseConfigured()) return empty;

  try {
    const s = getSupabaseAdminClient();
    const pull = async (eventType: string) => {
      const { data, error } = await s.from("v_events" as never)
        .select("user_id,metadata")
        .eq("event_type", eventType)
        .gte("created_at", sinceIso)
        .limit(ROW_CAP);
      if (error) return [] as { user_id: string | null; metadata: Record<string, unknown> }[];
      return (data as unknown as { user_id: string | null; metadata: Record<string, unknown> }[]) ?? [];
    };

    const [visits, signups, started, completed] = await Promise.all(FUNNEL_EVENTS.map(pull));

    const people = (rows: { user_id: string | null }[]) =>
      new Set(rows.map((r) => r.user_id).filter((u): u is string => !!u)).size;

    // "Came back" is the honest version of retention at this size: an account that got a decision on more
    // than one verification. One completed run is a trial; two is somebody choosing to do it again.
    const perUser = new Map<string, number>();
    for (const r of completed) if (r.user_id) perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + 1);
    const repeatPeople = [...perUser.values()].filter((n) => n >= 2).length;

    // Reported in the product's OWN three words, translated through the one function that owns that
    // mapping. The event records the internal decision ("ready", "blocked", "needs_review"); a second copy
    // of the translation here is how an admin page comes to disagree with the API and the CI gate about
    // what a run said. The state is always "completed", because that is the only point this event is
    // written from.
    const decisions: Record<string, number> = {};
    for (const r of completed) {
      const d = toPublicDecision("completed", String(r.metadata?.decision ?? "")) ?? "unknown";
      decisions[d] = (decisions[d] ?? 0) + 1;
    }

    return {
      stages: [
        { key: "visit", label: "Visited the site", count: visits.length, people: null },
        { key: "signup", label: "Created an account", count: signups.length, people: people(signups) },
        { key: "started", label: "Started a verification", count: started.length, people: people(started) },
        { key: "completed", label: "Got a decision", count: completed.length, people: people(completed) },
        { key: "repeat", label: "Came back for another", count: repeatPeople, people: repeatPeople },
      ],
      decisions,
      sinceIso,
      truncated: [visits, signups, started, completed].some((r) => r.length >= ROW_CAP),
    };
  } catch {
    return empty;
  }
}

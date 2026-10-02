// ONBOARDING ANSWERS: the three one-tap questions a new account is asked once ("Set up Vraelis" on the
// Overview), and what the product does with them (console audit, onboarding design, 2026-10-01).
//
// STORED AS AN EVENT, not a column. The design called for a v_profiles.onboarding column, which needs a
// migration; the event log already holds per-user facts with a JSON payload, and "the person answered
// these on this date" is exactly an event. The newest onboarding_answered event is the current answer, a
// skip is an event with every answer null (so the card never comes back), and the log keeps the history.
// It is not in v-audit's AUDIT_LABELS, so it never appears in Records.
//
// EVERY OPTION IS HELD TO WHAT IS REAL. The surfaces mirror _content/coverage.ts: a web app and a device's
// web control panel are Live; a desktop or mobile app is Next, and choosing it records interest and says
// so, never pretending it can be checked.
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";

export const ONBOARDING_EVENT = "onboarding_answered";

export const SURFACES = ["web", "panel", "native"] as const;
export const BUILDERS = ["lovable", "bolt", "replit", "v0", "cursor", "claude_code", "codex", "copilot", "windsurf", "own"] as const;
export const AUDIENCES = ["me", "team", "client"] as const;

export type Onboarding = {
  surface: (typeof SURFACES)[number] | null;
  builder: (typeof BUILDERS)[number] | null;
  audience: (typeof AUDIENCES)[number] | null;
  answeredAt: string;
};

/** Builders that are coding agents: for them, connecting the agent is the second thing to do, not the last. */
export const AGENT_BUILDERS: ReadonlySet<string> = new Set(["cursor", "claude_code", "codex", "copilot", "windsurf"]);

const pick = <T extends readonly string[]>(list: T, v: unknown): T[number] | null =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;

/** Parses an untrusted body into answers. Anything outside the lists becomes null, never an error. */
export function parseOnboarding(raw: unknown): Omit<Onboarding, "answeredAt"> {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { surface: pick(SURFACES, b.surface), builder: pick(BUILDERS, b.builder), audience: pick(AUDIENCES, b.audience) };
}

/** The person's current answers, or null when they have never answered or skipped. */
export async function readOnboarding(email: string): Promise<Onboarding | null> {
  if (!email || !isDatabaseConfigured()) return null;
  try {
    const { data } = await getSupabaseAdminClient().from("v_events" as never)
      .select("metadata, created_at").eq("user_id", email.trim().toLowerCase()).eq("event_type", ONBOARDING_EVENT)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const row = data as { metadata: Record<string, unknown> | null; created_at: string } | null;
    if (!row) return null;
    return { ...parseOnboarding(row.metadata ?? {}), answeredAt: row.created_at };
  } catch { return null; }
}

export async function saveOnboarding(email: string, answers: Omit<Onboarding, "answeredAt">): Promise<void> {
  await logEvent({
    userId: email.trim().toLowerCase(), eventType: ONBOARDING_EVENT, actorType: "owner", source: "app",
    route: "/api/v/onboarding", metadata: { ...answers },
  });
}

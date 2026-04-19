import { getSupabaseAdminClient } from "./supabase-admin";

export type UsageKind =
  | "chat"
  | "copilot"
  | "voice_transcribe"
  | "voice_speak"
  | "image"
  | "summary";

export type UsageSurface = "web" | "desktop";

export type UsageEvent = {
  email: string;
  kind: UsageKind;
  model?: string | null;
  surface?: UsageSurface | null;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  audio_seconds?: number | null;
  duration_ms?: number | null;
};

// Fire-and-forget — usage logging should never block a request, and a
// failed insert should never bubble back to the user. Caller can
// optionally `await` if they care.
export async function recordUsage(event: UsageEvent): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const input = event.input_tokens ?? 0;
    const output = event.output_tokens ?? 0;
    const total = event.total_tokens ?? input + output;
    const { error } = await supabase
      .from("usage_events" as never)
      .insert([
        {
          email: event.email,
          kind: event.kind,
          model: event.model ?? null,
          surface: event.surface ?? null,
          input_tokens: input,
          output_tokens: output,
          total_tokens: total,
          audio_seconds: event.audio_seconds ?? null,
          duration_ms: event.duration_ms ?? null,
        },
      ] as never);
    if (error) {
      console.warn("recordUsage insert failed:", error.message);
    }
  } catch (err) {
    console.warn("recordUsage threw:", err);
  }
}

export type UsageSummary = {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  chat_requests: number;
  copilot_requests: number;
  voice_transcribe_requests: number;
  voice_speak_requests: number;
};

const ZERO_SUMMARY: UsageSummary = {
  total_requests: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_tokens: 0,
  chat_requests: 0,
  copilot_requests: 0,
  voice_transcribe_requests: 0,
  voice_speak_requests: 0,
};

export async function getUsageSummary(
  email: string,
  since: Date,
): Promise<UsageSummary> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("usage_summary" as never, {
      p_email: email,
      p_since: since.toISOString(),
    } as never);
    if (error) {
      console.warn("usage_summary rpc failed:", error.message);
      return ZERO_SUMMARY;
    }
    const rowsAny = data as unknown as Record<string, unknown>[] | Record<string, unknown> | null;
    const row = (Array.isArray(rowsAny) ? rowsAny[0] : rowsAny) as
      | Record<string, unknown>
      | null;
    if (!row) return ZERO_SUMMARY;
    const num = (k: string) => Number((row[k] as unknown) ?? 0);
    return {
      total_requests: num("total_requests"),
      total_input_tokens: num("total_input_tokens"),
      total_output_tokens: num("total_output_tokens"),
      total_tokens: num("total_tokens"),
      chat_requests: num("chat_requests"),
      copilot_requests: num("copilot_requests"),
      voice_transcribe_requests: num("voice_transcribe_requests"),
      voice_speak_requests: num("voice_speak_requests"),
    };
  } catch (err) {
    console.warn("getUsageSummary threw:", err);
    return ZERO_SUMMARY;
  }
}

export type UsageRow = {
  id: string;
  kind: UsageKind;
  model: string | null;
  surface: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  audio_seconds: number | null;
  duration_ms: number | null;
  created_at: string;
};

export async function listRecentUsage(
  email: string,
  limit = 25,
): Promise<UsageRow[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("usage_events" as never)
      .select(
        "id, kind, model, surface, input_tokens, output_tokens, total_tokens, audio_seconds, duration_ms, created_at",
      )
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("listRecentUsage failed:", error.message);
      return [];
    }
    return (data ?? []) as unknown as UsageRow[];
  } catch (err) {
    console.warn("listRecentUsage threw:", err);
    return [];
  }
}

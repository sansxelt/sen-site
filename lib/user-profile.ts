// cache() removed — it deduplicated within a React render pass but caused
// stale null returns in auth callbacks where the profile is created mid-flow.
import type { ReleaseChannel, SummaryStyle } from "./account-session";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type UserProfileRecord = {
  created_at: string;
  display_name: string | null;
  early_access_requested_at: string | null;
  email: string;
  focus_area: string | null;
  release_channel: ReleaseChannel;
  summary_style: SummaryStyle;
  updated_at: string;
  work_style: string | null;
};

type UserProfileUpdate = {
  displayName?: string | null;
  earlyAccessRequestedAt?: string | null;
  focusArea?: string | null;
  releaseChannel?: ReleaseChannel;
  summaryStyle?: SummaryStyle;
  workStyle?: string | null;
};

type UserIdentityInput = {
  email: string;
  name?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeSummaryStyle(value: unknown): SummaryStyle {
  return value === "concise" || value === "detailed" ? value : "balanced";
}

function normalizeReleaseChannel(value: unknown): ReleaseChannel {
  return value === "preview" ? "preview" : "stable";
}

function normalizeProfileRecord(data: Partial<UserProfileRecord> & { email: string }) {
  return {
    created_at: typeof data.created_at === "string" ? data.created_at : new Date().toISOString(),
    display_name:
      typeof data.display_name === "string" ? data.display_name : null,
    early_access_requested_at:
      typeof data.early_access_requested_at === "string"
        ? data.early_access_requested_at
        : null,
    email: normalizeEmail(data.email),
    focus_area: typeof data.focus_area === "string" ? data.focus_area : null,
    release_channel: normalizeReleaseChannel(data.release_channel),
    summary_style: normalizeSummaryStyle(data.summary_style),
    updated_at: typeof data.updated_at === "string" ? data.updated_at : new Date().toISOString(),
    work_style: typeof data.work_style === "string" ? data.work_style : null,
  } satisfies UserProfileRecord;
}

export async function getUserProfileByEmail(
  email: string | null | undefined,
): Promise<UserProfileRecord | null> {
  if (!email || !isDatabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_profiles" as never)
      .select(
        "created_at, display_name, early_access_requested_at, email, focus_area, release_channel, summary_style, updated_at, work_style",
      )
      .eq("email", normalizeEmail(email))
      .maybeSingle();

    if (error) {
      console.error("Profile lookup failed:", error);
      return null;
    }

    return data ? normalizeProfileRecord(data) : null;
  } catch (error) {
    console.error("Profile lookup threw:", error);
    return null;
  }
}

export async function upsertUserProfile(
  email: string,
  updates: UserProfileUpdate,
) {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();

  const payload = {
    display_name: updates.displayName?.trim() || null,
    early_access_requested_at: updates.earlyAccessRequestedAt ?? null,
    email: normalizedEmail,
    focus_area: updates.focusArea?.trim() || null,
    release_channel: updates.releaseChannel ?? "stable",
    summary_style: updates.summaryStyle ?? "balanced",
    updated_at: now,
    work_style: updates.workStyle?.trim() || null,
  };

  const { data, error } = await supabase
    .from("user_profiles" as never)
    .upsert(payload as never, {
      onConflict: "email",
    })
    .select(
      "created_at, display_name, early_access_requested_at, email, focus_area, release_channel, summary_style, updated_at, work_style",
    )
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfileRecord(data);
}

export async function syncUserProfileIdentity(input: UserIdentityInput) {
  if (!input.email || !isDatabaseConfigured()) {
    return null;
  }

  const existingProfile = await getUserProfileByEmail(input.email);
  const normalizedName = input.name?.trim() || null;

  return upsertUserProfile(input.email, {
    displayName: existingProfile?.display_name || normalizedName,
    earlyAccessRequestedAt: existingProfile?.early_access_requested_at ?? null,
    focusArea: existingProfile?.focus_area,
    releaseChannel: existingProfile?.release_channel,
    summaryStyle: existingProfile?.summary_style,
    workStyle: existingProfile?.work_style,
  });
}

export async function saveEarlyAccessRequest(
  email: string,
  input: {
    focusArea?: string;
    name?: string;
    source?: string;
  },
) {
  const supabase = getSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  const { error } = await supabase.from("early_access_signups" as never).upsert(
    [
      {
        email: normalizedEmail,
        focus_area: input.focusArea?.trim() || null,
        name: input.name?.trim() || null,
        source: input.source ?? "website",
        updated_at: now,
      },
    ] as never,
    { onConflict: "email" },
  );

  if (error) {
    throw error;
  }

  return now;
}

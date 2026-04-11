import type { User } from "@supabase/supabase-js";

export type SummaryStyle = "concise" | "balanced" | "detailed";
export type ReleaseChannel = "stable" | "preview";

export type SessionState = {
  displayName: string;
  earlyAccessRequestedAt: string | null;
  email: string | null;
  emailConfirmed: boolean;
  focusArea: string;
  releaseChannel: ReleaseChannel;
  signInMethod: string;
  summaryStyle: SummaryStyle;
  workStyle: string;
};

function isSummaryStyle(value: unknown): value is SummaryStyle {
  return value === "concise" || value === "balanced" || value === "detailed";
}

function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return value === "stable" || value === "preview";
}

export function readSessionState(
  user: User | null,
  providerLabels: Record<string, string>,
): SessionState | null {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "email";

  return {
    displayName:
      typeof metadata.display_name === "string" ? metadata.display_name : "",
    earlyAccessRequestedAt:
      typeof metadata.early_access_requested_at === "string"
        ? metadata.early_access_requested_at
        : null,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    focusArea:
      typeof metadata.focus_area === "string" ? metadata.focus_area : "",
    releaseChannel: isReleaseChannel(metadata.release_channel)
      ? metadata.release_channel
      : "stable",
    signInMethod: provider === "email" ? "Email" : providerLabels[provider] ?? provider,
    summaryStyle: isSummaryStyle(metadata.summary_style)
      ? metadata.summary_style
      : "balanced",
    workStyle:
      typeof metadata.work_style === "string" ? metadata.work_style : "",
  };
}

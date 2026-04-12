import type { Session } from "next-auth";
import { providerLabels } from "./auth-ui";
import type { UserProfileRecord } from "./user-profile";

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
  session: Session | null,
  profile: UserProfileRecord | null,
): SessionState | null {
  const user = session?.user;
  const email = user?.email ?? null;

  if (!email || !user) {
    return null;
  }

  const provider =
    typeof user.provider === "string" ? user.provider : "oauth";
  const profileDisplayName = profile?.display_name ?? "";
  const sessionDisplayName =
    typeof user.name === "string" ? user.name : "";

  return {
    displayName: profileDisplayName || sessionDisplayName,
    earlyAccessRequestedAt: profile?.early_access_requested_at ?? null,
    email,
    emailConfirmed: Boolean(email),
    focusArea: profile?.focus_area ?? "",
    releaseChannel: isReleaseChannel(profile?.release_channel)
      ? profile.release_channel
      : "stable",
    signInMethod: providerLabels[provider as keyof typeof providerLabels] ?? "OAuth",
    summaryStyle: isSummaryStyle(profile?.summary_style)
      ? profile.summary_style
      : "balanced",
    workStyle: profile?.work_style ?? "",
  };
}

export type AccountContext = {
  email: string;
  name: string;
  requestedAt: string | null;
} | null;

export function readAccountContext(
  session: Session | null,
  profile: UserProfileRecord | null,
): AccountContext {
  const user = session?.user;
  const email = user?.email ?? null;

  if (!email || !user) {
    return null;
  }

  return {
    email,
    name:
      profile?.display_name ??
      (typeof user.name === "string" ? user.name : "") ??
      "",
    requestedAt: profile?.early_access_requested_at ?? null,
  };
}

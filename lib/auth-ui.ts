export const providerLabels = {
  github: "GitHub",
  google: "Google",
} as const;

export type OauthProvider = keyof typeof providerLabels;
export type AuthMessageContext = "account" | "provider" | "profile" | "signout";

export const oauthProviders: Array<{
  description: string;
  enabled: boolean;
  label: string;
  provider: OauthProvider;
}> = [
  {
    description: "Use your Google account to continue with sansxel.",
    enabled: true,
    label: "Google",
    provider: "google",
  },
  {
    description: "Use your GitHub account to continue with sansxel.",
    enabled: true,
    label: "GitHub",
    provider: "github",
  },
];

export function getSafeRedirectPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

export function getSignInPath(callbackUrl = "/account") {
  const safeCallbackUrl = getSafeRedirectPath(callbackUrl);
  const searchParams = new URLSearchParams({
    callbackUrl: safeCallbackUrl,
  });

  return `/auth/signin?${searchParams.toString()}`;
}

export function getAuthUnavailableMessage() {
  return "Secure sign-in is not fully configured in this environment yet.";
}

export function getAuthErrorMessage(
  error: unknown,
  context: AuthMessageContext,
) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === "string"
        ? error.toLowerCase()
        : "";

  if (
    message.includes("configuration") ||
    message.includes("missingsecret") ||
    message.includes("invalidprovider") ||
    message.includes("untrustedhost")
  ) {
    return "Authentication is not fully configured yet. Please try again shortly.";
  }

  if (message.includes("accessdenied")) {
    return "That sign-in request was declined.";
  }

  if (message.includes("callbackrouteerror") || message.includes("oauth")) {
    return "We couldn't finish that sign-in. Please try again.";
  }

  switch (context) {
    case "signout":
      return "We couldn't sign you out right now. Please try again.";
    case "profile":
      return "We couldn't save your workspace settings right now. Please try again.";
    case "provider":
      return "We couldn't open that sign-in option right now. Please try again.";
    default:
      return "We couldn't load your account right now. Please try again.";
  }
}

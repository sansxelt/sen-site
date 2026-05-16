export const providerLabels = {
  credentials: "Email",
  github: "GitHub",
  google: "Google",
} as const;

export type OauthProvider = Exclude<keyof typeof providerLabels, "credentials">;
export type AuthMessageContext =
  | "account"
  | "provider"
  | "profile"
  | "signin"
  | "signout"
  | "signup";

export const oauthProviders: Array<{
  description: string;
  enabled: boolean;
  label: string;
  provider: OauthProvider;
}> = [
  {
    description: "Use your Google account to continue with VRAELIS.",
    enabled: true,
    label: "Google",
    provider: "google",
  },
  {
    description: "Use your GitHub account to continue with VRAELIS.",
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

  return `/signin?${searchParams.toString()}`;
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

  if (
    message.includes("credentialssignin") ||
    message.includes("invalid login credentials")
  ) {
    return "We couldn't verify that email and password. Please try again.";
  }

  if (
    message.includes("already has a VRAELIS account") ||
    message.includes("already exists")
  ) {
    return "That email already has a VRAELIS account. Sign in instead.";
  }

  if (message.includes("at least 8 characters")) {
    return "Use a password with at least 8 characters.";
  }

  if (message.includes("callbackrouteerror") || message.includes("oauth")) {
    return "We couldn't finish that sign-in. Please try again.";
  }

  switch (context) {
    case "signup":
      return "We couldn't create your account right now. Please try again.";
    case "signin":
      return "We couldn't sign you in right now. Please try again.";
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

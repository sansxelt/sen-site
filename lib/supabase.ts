import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const oauthRolloutEnabled = isEnabled(process.env.NEXT_PUBLIC_AUTH_OAUTH_ENABLED);

let browserClient: SupabaseClient | null = null;

function isEnabled(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(value ?? "");
}

export const providerLabels = {
  azure: "Microsoft",
  github: "GitHub",
  google: "Google",
} as const;

export type OauthProvider = keyof typeof providerLabels;
export type AuthMessageContext =
  | "account"
  | "callback"
  | "provider"
  | "signin"
  | "signout"
  | "signup";

export const oauthProviders: Array<{
  description: string;
  enabled: boolean;
  label: string;
  provider: OauthProvider;
}> = [
  // TODO(google): Add the real Google OAuth client ID and client secret in
  // the auth provider settings before enabling Google sign-in for this build.
  {
    description: "Use your Google account to continue with sansxel.",
    enabled:
      oauthRolloutEnabled &&
      isEnabled(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED),
    label: "Google",
    provider: "google",
  },
  // TODO(github): Add the real GitHub OAuth app client ID and client secret
  // before enabling GitHub sign-in for this build.
  {
    description: "Use your GitHub account to continue with sansxel.",
    enabled:
      oauthRolloutEnabled &&
      isEnabled(process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED),
    label: "GitHub",
    provider: "github",
  },
  // TODO(microsoft): Add the real Microsoft / Azure app client ID and client
  // secret before enabling Microsoft sign-in for this build.
  {
    description: "Use your Microsoft account to continue with sansxel.",
    enabled:
      oauthRolloutEnabled &&
      isEnabled(process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED),
    label: "Microsoft",
    provider: "azure",
  },
];

export const appleAuthOption = {
  // TODO(apple): Add the real Apple Sign In credentials before enabling Apple
  // sign-in for this build.
  description:
    "Apple sign-in will appear once this workspace is ready for it.",
  label: "Apple",
};

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function isProviderEnabled(provider: OauthProvider) {
  return oauthProviders.find((option) => option.provider === provider)?.enabled;
}

export function getAuthUnavailableMessage() {
  return "Secure account access is not available in this environment yet.";
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
    message.includes("unsupported provider") ||
    message.includes("provider is not enabled") ||
    message.includes("validation_failed")
  ) {
    return "That sign-in option is not available yet in this build. Use email for now.";
  }

  if (message.includes("invalid login credentials")) {
    return "We couldn't verify that email and password. Please try again.";
  }

  if (message.includes("email not confirmed")) {
    return "Check your inbox to confirm your email, then sign in.";
  }

  if (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already registered")
  ) {
    return "That email already has a sansxel account. Sign in instead.";
  }

  if (message.includes("password") && message.includes("at least")) {
    return "Use a password with at least 8 characters.";
  }

  if (message.includes("signup is disabled")) {
    return "Account creation is not open in this build yet.";
  }

  if (message.includes("rate limit")) {
    return "Too many attempts right now. Please wait a moment and try again.";
  }

  switch (context) {
    case "signup":
      return "We couldn't create your account right now. Please try again.";
    case "signin":
      return "We couldn't sign you in right now. Please try again.";
    case "signout":
      return "We couldn't sign you out right now. Please try again.";
    case "provider":
      return "We couldn't start that sign-in option right now. Use email for now or try again later.";
    case "callback":
      return "We couldn't finish sign-in. Please go back and try again.";
    default:
      return "We couldn't complete that account action right now. Please try again.";
  }
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
      },
    });
  }

  return browserClient;
}

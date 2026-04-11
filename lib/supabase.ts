import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const productionAppOrigin = "https://sansxel.ai";

let browserClient: SupabaseClient | null = null;

export const providerLabels = {
  apple: "Apple",
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
  // TODO(microsoft): Enable this after the Azure provider is configured in Supabase.
  {
    description: "Use your Microsoft account to continue with sansxel.",
    enabled: false,
    label: "Microsoft",
    provider: "azure",
  },
  // TODO(apple): Enable this after the Apple provider is configured in Supabase.
  {
    description: "Use your Apple account to continue with sansxel.",
    enabled: false,
    label: "Apple",
    provider: "apple",
  },
];

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    anonKey: supabaseAnonKey,
    url: supabaseUrl,
  };
}

export function getAppOrigin() {
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return origin;
    }
  }

  return productionAppOrigin;
}

export function getAuthCallbackUrl(next = "/account") {
  const searchParams = new URLSearchParams({ next });

  return `${getAppOrigin()}/auth/callback?${searchParams.toString()}`;
}

export function isProviderEnabled(provider: OauthProvider) {
  return oauthProviders.find((option) => option.provider === provider)?.enabled ?? false;
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
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }

  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.anonKey, {
      auth: {
        flowType: "pkce",
      },
    });
  }

  return browserClient;
}

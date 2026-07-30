// Display vocabulary for the connection graph, shared by the settings pages and the connection
// management surface. PURE module (no DB, no JSX, no server imports) so the test suite can exercise
// the state mapping and the copy stays in one honest place.
//
// State model (explicit, per the S2 program spec): connected / connected_manually / needs_attention /
// verification_failed / revoked / disconnected. The last two are terminal: a revoked or disconnected
// connection's ROW is deleted (which also destroys any sealed credential), so those states never render
// on a card — they exist in the model so the mapping is total and the tests can assert the vocabulary.

export type ConnectionState =
  | "connected"            // a credential Vraelis actually holds (sealed test account)
  | "connected_manually"   // owner-entered metadata; no OAuth exists yet and we never pretend it does
  | "needs_attention"      // pending / unknown status
  | "verification_failed"  // the last health check could not reach or confirm the target
  | "revoked"              // terminal: row deleted, ciphertext destroyed (never rendered)
  | "disconnected";        // terminal: row deleted (never rendered)

// status column (pending | connected | error) + provider (+ meta) -> the state a card renders. A connection
// backed by a real held credential (a sealed test_account, or an OAuth token where meta.oauth === true)
// renders "Connected"; owner-entered metadata renders "Connected manually" so the card never overstates.
export function connectionState(provider: string, status: string, meta?: { oauth?: boolean } | null): ConnectionState {
  const s = (status || "").trim().toLowerCase();
  if (s === "revoked") return "revoked";
  if (s === "disconnected") return "disconnected";
  if (s === "error") return "verification_failed";
  if (s === "connected") return (provider === "test_account" || meta?.oauth === true) ? "connected" : "connected_manually";
  return "needs_attention"; // pending / unknown: honest, never optimistic
}

export const STATE_LABELS: Record<ConnectionState, string> = {
  connected: "Connected",
  connected_manually: "Connected manually",
  needs_attention: "Needs attention",
  verification_failed: "Verification failed",
  revoked: "Revoked",
  disconnected: "Disconnected",
};
export function stateLabel(state: ConnectionState): string { return STATE_LABELS[state]; }

export const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub", vercel: "Vercel", custom_deploy: "Custom deployment",
  supabase: "Supabase", custom_auth: "Custom auth", stripe_test: "Stripe",
  sentry: "Sentry", openapi: "OpenAPI", webhook: "Webhook", slack: "Slack", test_account: "Test account",
};
export const PROVIDER_GROUP: Record<string, string> = {
  github: "Source", vercel: "Deployment", custom_deploy: "Deployment",
  supabase: "Data", custom_auth: "Auth", stripe_test: "Billing",
  sentry: "Monitoring", openapi: "Services", webhook: "Services", slack: "Notifications", test_account: "Credentials",
};

// Which Vraelis features actually use each connection today. Truthful only: nothing here claims a
// capability that is not built. A provider is "wired" when a live consumer reads it — deployment
// identity for the URL under test, or a discovery signal that seeds requirements (see
// CONNECTION_SIGNAL_REQUIREMENTS in discover-synthesis.ts). The rest are STORED_NOT_YET_USED: the
// metadata is saved, but no verification step consumes it yet, and we say exactly that.
export const FEATURE_USE: Record<string, string> = {
  github: "Deployment identity and naming context for the Production Contract.",
  custom_deploy: "Deployment identity for the URL under test.",
  vercel: "Deployment identity for the URL under test.",
  supabase: "Seeds a persistence requirement (created data survives a refresh and a new session).",
  stripe_test: "Seeds a billing-flow requirement verified in Stripe test mode.",
  sentry: "Seeds a reliability requirement (core flows complete without unhandled errors).",
  custom_auth: "Stored as application context. Not yet read during verification.",
  webhook: "Receives the decision when a verification run finishes (signed POST).",
  slack: "Posts the decision to your Slack channel when a verification run finishes.",
  openapi: "Stored as application context. Not yet read during verification.",
  // This said "coming later" while worker/preflight/execute-run.ts has been signing in with these
  // credentials for real. Understating a shipped capability is the same defect as overstating one.
  test_account: "Signing in as this role inside your approved flows. Credentials stay sealed and are never displayed, logged, or screenshotted.",
};
// Some providers can be connected two ways, and the two ways reach different amounts of data. Pasting a
// Supabase project URL is metadata; authorizing Supabase over OAuth hands Vraelis a management-API token.
// Describing both with one line would understate the second, so the OAuth variant is written separately and
// selected off meta.oauth. Only providers whose OAuth reach differs need an entry here.
const FEATURE_USE_OAUTH: Record<string, string> = {
  supabase: "Reads your project list over the Supabase Management API to identify the project under test, and seeds a persistence requirement (created data survives a refresh and a new session).",
};
const NEVER_ACCESSES_OAUTH: Record<string, string> = {
  supabase: "No database password, no direct database connection, no table rows. The token is read-only against the Management API and can be revoked from your Supabase account at any time.",
};

export function featureUse(provider: string, meta?: { oauth?: boolean } | null): string {
  if (meta?.oauth === true && FEATURE_USE_OAUTH[provider]) return FEATURE_USE_OAUTH[provider];
  return FEATURE_USE[provider] ?? "Recorded as application context.";
}

// Providers whose metadata is saved but which no verification step consumes yet. The card renders a
// quiet "Stored, not yet used in verification" chip for these so a connected-but-inert integration
// never reads as if it were actively feeding a pass. Kept in sync with the honest FEATURE_USE copy
// above; if a live consumer is wired later, remove the provider here and update its FEATURE_USE line.
export const STORED_NOT_YET_USED = new Set<string>(["custom_auth", "openapi"]);
export function isStoredNotYetUsed(provider: string): boolean {
  return STORED_NOT_YET_USED.has(provider);
}

// The "Data Vraelis never accesses" line, per provider. This is a promise, so it is written down once.
export const NEVER_ACCESSES: Record<string, string> = {
  github: "No code write access; repository metadata only today.",
  vercel: "No Vercel tokens; project and deployment metadata only.",
  custom_deploy: "No provider credentials; deployment metadata only.",
  supabase: "No database credentials, no rows; the project URL only.", // manual connection; see NEVER_ACCESSES_OAUTH for the authorized one
  custom_auth: "No credentials; descriptive metadata only.",
  stripe_test: "No live keys, no card data; a test-mode label only.",
  sentry: "No Sentry auth tokens; the DSN is a public identifier.",
  webhook: "No signing secrets; the endpoint URL only.",
  slack: "No Slack workspace access; the incoming-webhook URL you paste, used only to post run results.",
  openapi: "No API keys; schema metadata only.",
  test_account: "Credentials are sealed with AES-256-GCM and never displayed, logged, or screenshotted.",
};
export function neverAccesses(provider: string, meta?: { oauth?: boolean } | null): string {
  if (meta?.oauth === true && NEVER_ACCESSES_OAUTH[provider]) return NEVER_ACCESSES_OAUTH[provider];
  return NEVER_ACCESSES[provider] ?? "Only the metadata shown on this card.";
}

// The manual kinds the management surface offers for "Add connection" (same set the connect workspace
// offers). test_account is deliberately absent: sealed credentials go through the secrets route only.
export const MANUAL_ADD_KINDS = [
  "github", "vercel", "custom_deploy", "supabase", "custom_auth", "stripe_test", "sentry", "webhook", "slack",
] as const;

// Field definitions for the manual metadata forms (add + edit share these). github uses its own
// validated form component; everything else renders through the generic field list.
export const MANUAL_FIELDS: Record<string, { fields: [string, string, string][]; requiredKey?: string }> = {
  vercel: { fields: [["project", "Project name", "my-app"], ["deployment_url", "Deployment URL (optional)", "https://my-app-abc.vercel.app"]], requiredKey: "project" },
  custom_deploy: { fields: [["provider_name", "Provider", "Railway / Netlify / Fly / other"], ["branch", "Branch (optional)", "main"], ["commit", "Commit SHA (optional)", "40 hex characters"]], requiredKey: "provider_name" },
  supabase: { fields: [["project_url", "Project URL", "https://xyzcompany.supabase.co"]], requiredKey: "project_url" },
  custom_auth: { fields: [["system", "Auth system", "e.g. NextAuth email links"], ["notes", "Notes for testing (optional)", "e.g. magic links go to the inbox"]], requiredKey: "system" },
  stripe_test: { fields: [["account_label", "Account label (optional)", "e.g. Acme test account"]] },
  sentry: { fields: [["dsn", "DSN", "https://examplePublicKey@o0.ingest.sentry.io/0"]], requiredKey: "dsn" },
  webhook: { fields: [["url", "Endpoint URL", "https://hooks.example.com/orders"]], requiredKey: "url" },
  slack: { fields: [["url", "Slack incoming webhook URL", "https://hooks.slack.com/services/T000/B000/xxxx"], ["channel", "Channel label (optional)", "#launches"]], requiredKey: "url" },
};

// Providers that exist in the world but not in the product yet. Rendered as compact chips only,
// never as buttons (program plan section 11: no fake integrations).
export const COMING_LATER_PROVIDERS = [
  "GitHub OAuth", "Vercel OAuth", "Railway", "Netlify", "Supabase OAuth", "Firebase",
  "Clerk", "Auth0", "Better Auth", "Lemon Squeezy", "Paddle", "Resend", "Twilio", "PostHog",
];

function hostnameOf(u: string): string {
  try { return new URL(u).hostname; } catch { return u; }
}

// The safe one-line summary of a connection's metadata (metadata is the non-secret half by contract).
// Null when the row carries nothing displayable.
export function metaSummary(provider: string, meta: Record<string, unknown>): string | null {
  const s = (k: string): string => (typeof meta[k] === "string" ? (meta[k] as string).trim() : "");
  switch (provider) {
    case "github": {
      const repo = s("repo");
      return repo ? `${repo}${s("branch") ? ` @ ${s("branch")}` : ""}${s("commit") ? ` (${s("commit").slice(0, 10)})` : ""}` : null;
    }
    case "vercel": {
      const project = s("project");
      return project ? `${project}${s("deployment_url") ? `, ${hostnameOf(s("deployment_url"))}` : ""}` : null;
    }
    case "custom_deploy": {
      const name = s("provider_name");
      return name ? `${name}${s("branch") ? `, ${s("branch")}` : ""}${s("commit") ? ` (${s("commit").slice(0, 10)})` : ""}` : null;
    }
    case "supabase": return s("project_url") || null;
    case "custom_auth": return s("system") || null;
    case "stripe_test": return s("account_label") ? `Test mode, ${s("account_label")}` : "Test mode";
    case "sentry": return s("dsn") ? hostnameOf(s("dsn")) : null;
    case "webhook": return s("url") || null;
    case "slack": return s("channel") || (s("url") ? "Incoming webhook" : null);
    case "openapi": return s("name") || null;
    default: return null;
  }
}

// Stable UTC render (no hydration mismatch): "2026-07-02 14:31 UTC".
export function whenUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

// Human labels for the connection audit trail (v_events).
export const CONNECTION_EVENT_LABELS: Record<string, string> = {
  connection_added: "Connection added",
  connection_updated: "Metadata updated",
  connection_verified: "Health check run",
  connection_removed: "Connection removed",
};

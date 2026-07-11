import { createClient } from "@supabase/supabase-js";

type SupabaseSchemaMap = Record<string, never>;

// Read env LAZILY (at call time), not at module import. Standalone tsx processes (the local worker, verify
// scripts) load .env.local via loadLocalEnv() AFTER this module is imported; reading at import time would
// capture undefined and leave isDatabaseConfigured() permanently false. In Next, env is already set at
// request time, so lazy reading is equivalent there.
function readEnv(): { url: string | undefined; key: string | undefined } {
  return {
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

let adminClient: ReturnType<typeof createClient<SupabaseSchemaMap>> | null = null;

export function isDatabaseConfigured() {
  const { url, key } = readEnv();
  return Boolean(url && key);
}

export function getSupabaseAdminClient() {
  const { url, key } = readEnv();
  if (!url || !key) {
    throw new Error(
      "Database access is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the environment.",
    );
  }

  if (!adminClient) {
    adminClient = createClient<SupabaseSchemaMap>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

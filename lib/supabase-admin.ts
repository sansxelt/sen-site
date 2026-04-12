import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type SupabaseSchemaMap = Record<string, never>;

let adminClient: ReturnType<typeof createClient<SupabaseSchemaMap>> | null = null;

export function isDatabaseConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

export function getSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Database access is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the environment.",
    );
  }

  if (!adminClient) {
    adminClient = createClient<SupabaseSchemaMap>(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      },
    );
  }

  return adminClient;
}

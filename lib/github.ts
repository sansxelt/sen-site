import { getSupabaseAdminClient } from "./supabase-admin";

export type GitHubIntegration = {
  email: string;
  access_token: string;
  scope: string;
  github_login: string | null;
  github_id: number | null;
  connected_at: string;
};

const GITHUB_INTEGRATION_COLUMNS =
  "email, access_token, scope, github_login, github_id, connected_at";

export async function getGithubIntegration(
  email: string,
): Promise<GitHubIntegration | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("github_integrations" as never)
    .select(GITHUB_INTEGRATION_COLUMNS)
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as GitHubIntegration) ?? null;
}

export async function deleteGithubIntegration(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("github_integrations" as never)
    .delete()
    .eq("email", email);
  if (error) throw error;
}

export async function upsertGithubIntegration(
  integration: Omit<GitHubIntegration, "connected_at">,
): Promise<GitHubIntegration> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("github_integrations" as never)
    .upsert(
      [
        {
          email: integration.email,
          access_token: integration.access_token,
          scope: integration.scope,
          github_login: integration.github_login,
          github_id: integration.github_id,
          connected_at: new Date().toISOString(),
        },
      ] as never,
      { onConflict: "email" },
    )
    .select(GITHUB_INTEGRATION_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as GitHubIntegration;
}

// The Supabase consumer: resolve the real project a run is checking against from an account Supabase token,
// instead of trusting a project URL someone pasted months ago. This is what the Supabase OAuth token is FOR;
// without it the connection would be a token with no reader, which we don't ship.
//
// EXECUTOR-ONLY (uses a real token via freshAccountToken). READ-ONLY calls to the Management API only:
// GET /v1/projects, nothing else. No database connection, no SQL, no rows, ever. That is the promise written
// on the connection card (NEVER_ACCESSES_OAUTH.supabase) and this file is the only thing that could break it.
//
// Fails soft everywhere: any gap (no link, no token, API error, project gone) returns null and the caller
// falls back to the manually-entered project URL. A Supabase hiccup must never block a verification run.
import { safeFetch } from "../../safe-fetch";
import { freshAccountToken } from "./refresh";
import { resolveAppConnection } from "../connection-links-db";
import { openAccountToken } from "../account-connections-db";

const SUPABASE_API = "https://api.supabase.com";

export type SupabaseProject = { ref: string; name: string; url: string; region?: string };

// List the projects this token can see. Read-only; returns [] on any failure.
export async function listSupabaseProjects(owner: string): Promise<SupabaseProject[]> {
  const token = await freshAccountToken(owner, "supabase");
  if (!token) return [];
  try {
    const res = await safeFetch(`${SUPABASE_API}/v1/projects`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json", "user-agent": "vraelis" },
    });
    if (!res.ok) return [];
    const j = (await res.json().catch(() => null)) as { id?: string; name?: string; region?: string }[] | null;
    if (!Array.isArray(j)) return [];
    return j
      .filter((p) => typeof p.id === "string" && p.id)
      .map((p) => ({
        ref: p.id as string,
        name: typeof p.name === "string" ? p.name : (p.id as string),
        url: `https://${p.id}.supabase.co`,
        ...(typeof p.region === "string" ? { region: p.region } : {}),
      }));
  } catch {
    return [];
  }
}

// The run-route consumer: if an application is LINKED to a Supabase account connection with a project ref
// selected, resolve that project's live URL from the token. Null when anything is missing, so the caller
// keeps using whatever the owner entered by hand.
export async function linkedSupabaseProjectUrl(owner: string, applicationId: string): Promise<string | null> {
  const link = await resolveAppConnection(owner, applicationId, "supabase");
  if (!link) return null;
  const ref = typeof link.selection.project_ref === "string" ? link.selection.project_ref : "";
  if (!ref) return null;
  const tok = await openAccountToken(owner, { connectionId: link.accountConnectionId });
  if (!tok) return null;
  // Confirm the ref still exists on the account before handing it to a run; a deleted project should fall
  // back rather than send the run at a dead host.
  const projects = await listSupabaseProjects(owner);
  return projects.find((p) => p.ref === ref)?.url ?? null;
}

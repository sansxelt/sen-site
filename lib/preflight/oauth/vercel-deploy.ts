// The Vercel consumer: resolve the real current production deployment URL for a project from an account
// Vercel token. This is where a stored OAuth token first EARNS its keep — instead of a user pasting a
// deployment URL that may be stale, Vraelis reads the live one from Vercel.
//
// EXECUTOR-ONLY (uses a real token via freshAccountToken). Read-only Vercel API calls through safeFetch.
// Fails soft: any error returns null and the caller falls back to the manually-entered URL.
//
// NOTE: this helper is ready but only becomes reachable once applications LINK to an account Vercel
// connection (the per-app link + selection lands in the next step). It is written now so the token has a
// real consumer to point at.
import { safeFetch } from "../../safe-fetch";
import { freshAccountToken } from "./refresh";
import { resolveAppConnection } from "../connection-links-db";
import { openAccountToken } from "../account-connections-db";

const VERCEL_API = "https://api.vercel.com";

// Resolve the current READY production deployment URL for a Vercel project (by name or id). `teamId` scopes
// the lookup when the connection is team-scoped. Returns an https URL or null.
export async function resolveVercelProductionUrl(
  owner: string,
  project: string,
  opts?: { teamId?: string },
): Promise<string | null> {
  const token = await freshAccountToken(owner, "vercel");
  if (!token || !project) return null;

  const params = new URLSearchParams({ projectId: project, target: "production", state: "READY", limit: "1" });
  if (opts?.teamId) params.set("teamId", opts.teamId);

  try {
    const res = await safeFetch(`${VERCEL_API}/v6/deployments?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json", "user-agent": "vraelis" },
    });
    if (!res.ok) return null;
    const j = (await res.json().catch(() => ({}))) as { deployments?: { url?: string; readyState?: string }[] };
    const dep = j.deployments?.[0];
    if (!dep?.url) return null;
    // Vercel returns a bare host; make it a full https URL.
    return dep.url.startsWith("http") ? dep.url : `https://${dep.url}`;
  } catch {
    return null;
  }
}

// The run-route consumer: if an application is LINKED to a Vercel account connection with a project selected,
// resolve the live current production URL from the token; else null (caller falls back to the stored/entered
// URL). This is the first place an account OAuth token actually changes what a run does. Fail-soft: any gap
// (no link, no project, no token, API error) returns null and never blocks a run.
export async function linkedVercelDeploymentUrl(owner: string, applicationId: string): Promise<string | null> {
  const link = await resolveAppConnection(owner, applicationId, "vercel");
  if (!link) return null;
  const project = typeof link.selection.project === "string" ? link.selection.project : "";
  if (!project) return null;
  // teamId is stored on the account connection's meta.account or the link selection when team-scoped.
  const teamId = typeof link.selection.teamId === "string" ? link.selection.teamId : undefined;
  // The token must exist for the linked account connection.
  const tok = await openAccountToken(owner, { connectionId: link.accountConnectionId });
  if (!tok) return null;
  return resolveVercelProductionUrl(owner, project, teamId ? { teamId } : undefined);
}

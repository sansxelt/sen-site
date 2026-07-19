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

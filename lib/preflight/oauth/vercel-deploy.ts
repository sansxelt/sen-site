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

/** Which of a project's production aliases is the host a customer actually visits.
 *
 *  Pure, so the choice is testable without a Vercel account. Vercel lists several aliases for a production
 *  target: the custom domain, the canonical project.vercel.app, and generated branch/deployment variants.
 *
 *  A branch alias (project-git-main-team.vercel.app) is not production, so it is dropped outright. A custom
 *  domain wins when present, because that is what a customer types. Among equals the shortest wins, which
 *  picks the canonical name over a longer generated variant. */
export function preferredProductionHost(aliases: unknown): string | null {
  const list = Array.isArray(aliases) ? aliases : [];
  const clean = list
    .map((a) => (typeof a === "string" ? a : (a as { domain?: string })?.domain ?? ""))
    .map((a) => String(a).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean)
    .filter((a) => !a.includes("-git-"));
  if (!clean.length) return null;
  const custom = clean.filter((a) => !a.endsWith(".vercel.app"));
  const pool = custom.length ? custom : clean;
  return pool.slice().sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? null;
}

// THE URL A CUSTOMER ACTUALLY GETS, NOT THE NEWEST BUILD.
//
// This asked /v6/deployments?target=production&state=READY&limit=1 and returned deployments[0].url. That
// list is ordered by CREATION, not by what the production domain serves, and `url` is the deployment's own
// immutable host — project-hash.vercel.app — which no customer ever visits.
//
// So after a rollback, a staged promotion, or an alias assignment that failed, the newest READY deployment
// is a healthy build that is serving nobody, while the production domain serves the broken one. The run
// exercised the healthy build and the guarantee printed that hash-host as "Last proven on". A verdict
// presented as current production health, measured somewhere else.
//
// The project's production ALIAS is the answer: it is by definition what the domain resolves to right now.
// Absent, this returns null and the caller falls back to the stored URL — never to a host nobody uses.
export async function resolveVercelProductionUrl(
  owner: string,
  project: string,
  opts?: { teamId?: string },
): Promise<string | null> {
  const token = await freshAccountToken(owner, "vercel");
  if (!token || !project) return null;

  const params = new URLSearchParams();
  if (opts?.teamId) params.set("teamId", opts.teamId);
  const qs = params.toString();

  try {
    const res = await safeFetch(`${VERCEL_API}/v9/projects/${encodeURIComponent(project)}${qs ? `?${qs}` : ""}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json", "user-agent": "vraelis" },
    });
    if (!res.ok) return null;
    const j = (await res.json().catch(() => ({}))) as { targets?: { production?: { alias?: unknown } } };
    const host = preferredProductionHost(j.targets?.production?.alias);
    if (!host) return null;
    return `https://${host}`;
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

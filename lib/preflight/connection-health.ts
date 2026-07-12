// Health-check PLANNING for connections: pure decisions only (which URL, if any, a cheap read-only
// reachability check may touch), so the verify route stays a thin executor and the tests can cover
// every branch without a network. The route must still call unsafeHttpsUrlReason on any planned URL
// BEFORE fetching, and fetch only through safeFetch (DNS-pinned) with a strict timeout.
//
// Invariants:
//   - Only URLs already stored in the connection's own sanitized metadata are ever planned. Nothing
//     from a request body reaches a plan.
//   - Sentry DSNs are reduced to their HOST (fetch rejects userinfo URLs, and the key is not needed
//     for a reachability check).
//   - Kinds without a checkable URL (test_account, custom_auth, custom_deploy, stripe_test, openapi)
//     plan a metadata-only check: no remote call at all.

export type CheckPlan =
  //   rootProbe: the URL is a HOST ROOT (supabase project host, sentry ingest host, vercel deployment
  //   root) where any HTTP response proves reachability; a webhook URL is a real endpoint (404 = failure).
  | { kind: "url"; url: string; rootProbe: boolean } // HEAD/GET reachability on a stored https URL
  | { kind: "github"; repo: string }    // unauthenticated GitHub API repo lookup (public repos only)
  | { kind: "metadata_only" };          // no remote check for this connection kind

// owner/name where NEITHER segment is pure dots: "." and ".." would URL-normalize the GitHub API path
// onto a different endpoint entirely (a stored repo like "../orgs" must never reach the probe).
const REPO_RE = /^(?!\.+\/)[\w.-]+\/(?!\.+$)[\w.-]+$/;

export function planHealthCheck(provider: string, meta: Record<string, unknown>): CheckPlan {
  const s = (k: string): string => (typeof meta[k] === "string" ? (meta[k] as string).trim() : "");
  switch (provider) {
    case "github": {
      const repo = s("repo");
      return REPO_RE.test(repo) ? { kind: "github", repo } : { kind: "metadata_only" };
    }
    case "supabase": {
      const url = s("project_url");
      return url ? { kind: "url", url, rootProbe: true } : { kind: "metadata_only" };
    }
    case "vercel": {
      const url = s("deployment_url");
      return url ? { kind: "url", url, rootProbe: true } : { kind: "metadata_only" };
    }
    case "webhook": {
      // NOT a root probe: a webhook URL is a concrete endpoint the app depends on, so a 404 there
      // is a real problem the owner must see.
      const url = s("url");
      return url ? { kind: "url", url, rootProbe: false } : { kind: "metadata_only" };
    }
    case "sentry": {
      // Reachability of the ingest host only; the DSN's public key never rides the check.
      const dsn = s("dsn");
      if (!dsn) return { kind: "metadata_only" };
      try {
        const host = new URL(dsn).hostname;
        return host ? { kind: "url", url: `https://${host}/`, rootProbe: true } : { kind: "metadata_only" };
      } catch { return { kind: "metadata_only" }; }
    }
    // No checkable URL by design: stripe_test is a label, openapi is schema metadata, and
    // test_account / custom_auth / custom_deploy carry no remote target we may probe.
    default:
      return { kind: "metadata_only" };
  }
}

// Reachability classification for a URL check. Endpoint probes (webhook URLs): 2xx/3xx is up; 401/403
// means the host answered and is simply auth-walled, which counts as reachable; everything else (404,
// 5xx) is a verification failure the owner should look at. Root probes (supabase project host, sentry
// ingest host, vercel deployment root): ANY HTTP response counts as reachable — healthy Supabase and
// Sentry hosts legitimately return 404 at "/" — because a root probe proves TLS + HTTP only, never
// project validity.
export function healthStatusFromHttp(code: number, probe: "root" | "endpoint" = "endpoint"): "connected" | "error" {
  if (probe === "root") return "connected";
  return (code >= 200 && code < 400) || code === 401 || code === 403 ? "connected" : "error";
}

// Every note the verify route can write is composed here from FIXED strings plus at most an HTTP status
// number or a short reason code — never a raw provider error, never a URL, never metadata values.
export const CHECK_NOTES = {
  metadataOnly: "Metadata only; no remote check for this connection kind.",
  unsafeUrl: (reason: string) => `Stored URL failed safety checks (${reason}); it was not fetched.`,
  reachable: (code: number) => `Reachable (HTTP ${code}).`,
  reachableRoot: (code: number) => `Host responded (HTTP ${code}); TLS and HTTP reachability confirmed.`,
  badStatus: (code: number) => `The host responded HTTP ${code}.`,
  network: "Network failure or timeout; the host did not respond within 5 seconds.",
  githubPublic: "Repository is public and reachable.",
  githubNotFound: "Repository is private or not found; GitHub OAuth connection coming later.",
  githubRateLimited: "GitHub API rate limit reached; try again later.",
  githubBadStatus: (code: number) => `GitHub API responded HTTP ${code}.`,
  githubNetwork: "Network failure or timeout reaching the GitHub API.",
} as const;

export const CHECK_TIMEOUT_MS = 5000;

// Direct Browserbase REST transport for the WRITES the worker performs: create a session and release it.
// We deliberately use native `fetch` here instead of @browserbasehq/sdk for these POSTs. The SDK
// (v2.15.0 on the current undici) sets an invalid Content-Length on POST bodies and throws
// `UND_ERR_INVALID_ARG: invalid content-length header` before the request is even sent, so session
// creation fails. Native fetch computes Content-Length itself from the string body, which avoids the bug.
// (The non-mutating projects.list() reachability GET has no body and works fine through the SDK.)
//
// Browserbase is replaceable infrastructure; this module is the ONLY place that speaks its HTTP write API.
// It never logs the API key, connectUrl, or signing key. Errors carry sanitized fields only.

const BB_BASE = "https://api.browserbase.com/v1";

export type BrowserbaseSession = {
  id: string;
  status: string;
  connectUrl: string;
  signingKey?: string;
  seleniumRemoteUrl?: string;
};

export type CreateSessionConfig = {
  userMetadata?: Record<string, string>;
  timeout?: number; // seconds; bounded auto-end so a session can never run forever
  region?: string;
};

// A Browserbase API error carrying ONLY sanitized fields (status, a redacted body excerpt, request id).
// Never carries the api key, headers, or any session URL. Shaped so the smoke's describeError picks up
// `.status` and `.request_id`.
export class BrowserbaseApiError extends Error {
  status: number;
  request_id?: string;
  constructor(status: number, excerpt: string, requestId?: string) {
    super(`browserbase_api_${status}${excerpt ? `: ${excerpt}` : ""}`.slice(0, 400));
    this.name = "BrowserbaseApiError";
    this.status = status;
    this.request_id = requestId;
  }
}

// Drop undefined so we never serialize `"x": undefined`-shaped noise; the caller gets {} when nothing is set.
function compact(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

// One POST. Headers are X-BB-API-Key + Content-Type only — NO manual Content-Length (fetch computes it).
async function bbPost(apiKey: string, path: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BB_BASE}${path}`, {
    method: "POST",
    headers: { "X-BB-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) {
    let excerpt = "";
    try { excerpt = (await res.text()).slice(0, 300); } catch { /* body may be empty/unreadable */ }
    if (apiKey) excerpt = excerpt.split(apiKey).join("[redacted-key]"); // defensive: never echo the key
    const reqId = res.headers.get("x-bb-request-id") || res.headers.get("x-request-id") || undefined;
    throw new BrowserbaseApiError(res.status, excerpt, reqId);
  }
  try {
    return await res.json();
  } catch {
    throw new Error("browserbase_bad_response: response was not valid JSON");
  }
}

// Create a session. `projectId` is intentionally omitted — Browserbase infers the project from the key.
// Validates that the response carries an id + connectUrl before returning (a malformed response fails safely
// rather than handing back an unusable session).
export async function createBrowserbaseSession(apiKey: string, cfg: CreateSessionConfig = {}): Promise<BrowserbaseSession> {
  const payload = compact({ userMetadata: cfg.userMetadata, timeout: cfg.timeout, region: cfg.region });
  const data = (await bbPost(apiKey, "/sessions", payload)) as Record<string, unknown> | null;
  const id = typeof data?.id === "string" ? data.id : "";
  const connectUrl = typeof data?.connectUrl === "string" ? data.connectUrl : "";
  if (!id || !connectUrl) throw new Error("browserbase_bad_response: missing id or connectUrl");
  return {
    id,
    status: typeof data?.status === "string" ? data.status : "",
    connectUrl,
    signingKey: typeof data?.signingKey === "string" ? data.signingKey : undefined,
    seleniumRemoteUrl: typeof data?.seleniumRemoteUrl === "string" ? data.seleniumRemoteUrl : undefined,
  };
}

// Release a session (REQUEST_RELEASE) so it stops billing before its timeout. Best-effort at the call site.
export async function releaseBrowserbaseSession(apiKey: string, sessionId: string): Promise<void> {
  await bbPost(apiKey, `/sessions/${encodeURIComponent(sessionId)}`, { status: "REQUEST_RELEASE" });
}

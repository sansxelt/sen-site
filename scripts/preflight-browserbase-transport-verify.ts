// Tests for the Browserbase REST transport (worker/preflight/providers/browserbase-api.ts). Mocks global
// fetch — no network, no real session. Proves the fix for the SDK's POST content-length bug: create/release
// send valid JSON with NO manual Content-Length, omit undefined config, validate the response, sanitize
// errors, and never leak the api key / connectUrl into logs.
import { createBrowserbaseSession, releaseBrowserbaseSession, BrowserbaseApiError } from "../worker/preflight/providers/browserbase-api";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

type FetchCall = { url: string; init: RequestInit };
type MockResult = { status: number; body?: unknown; text?: string; headers?: Record<string, string> };
const origFetch = global.fetch;
let calls: FetchCall[] = [];

function mockFetch(handler: (url: string, init: RequestInit) => MockResult): void {
  calls = [];
  global.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const r = handler(url, init ?? {});
    const hdrs = r.headers ?? {};
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (k: string) => hdrs[k] ?? hdrs[k.toLowerCase()] ?? null },
      json: async () => (r.text !== undefined ? JSON.parse(r.text) : r.body),
      text: async () => (r.text !== undefined ? r.text : JSON.stringify(r.body)),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}
const restore = () => { global.fetch = origFetch; };
const hdr = (i: RequestInit) => (i.headers ?? {}) as Record<string, string>;
const hasContentLength = (i: RequestInit) => Object.keys(hdr(i)).some((h) => h.toLowerCase() === "content-length");

const KEY = "bb_test_secretkey_123";
const CONNECT = "wss://connect.browserbase.com/abcdef";

async function main(): Promise<void> {
  // 1. create: valid JSON, POST /v1/sessions, correct headers, NO manual Content-Length.
  mockFetch(() => ({ status: 200, body: { id: "sess_1", status: "RUNNING", connectUrl: CONNECT, signingKey: "sign_abc" } }));
  const s = await createBrowserbaseSession(KEY, { userMetadata: { run_id: "r1" }, timeout: 300 });
  const c0 = calls[0];
  ok("create -> POST https://api.browserbase.com/v1/sessions", c0.init.method === "POST" && c0.url === "https://api.browserbase.com/v1/sessions");
  ok("sends X-BB-API-Key header", hdr(c0.init)["X-BB-API-Key"] === KEY);
  ok("sends Content-Type application/json", hdr(c0.init)["Content-Type"] === "application/json");
  ok("NO manual Content-Length header on create", !hasContentLength(c0.init));
  let body0: Record<string, unknown> | null = null, validJson = true;
  try { body0 = JSON.parse(c0.init.body as string); } catch { validJson = false; }
  ok("create body is valid JSON", validJson);
  ok("create body carries userMetadata + timeout", (body0?.userMetadata as { run_id?: string })?.run_id === "r1" && body0?.timeout === 300);
  ok("returns validated session (id/status/connectUrl)", s.id === "sess_1" && s.status === "RUNNING" && s.connectUrl === CONNECT);

  // 2. undefined config omitted; empty body serializes to {}.
  mockFetch(() => ({ status: 200, body: { id: "sess_2", status: "RUNNING", connectUrl: CONNECT } }));
  await createBrowserbaseSession(KEY, { userMetadata: undefined, timeout: undefined, region: undefined });
  const body2 = JSON.parse(calls[0].init.body as string);
  ok("undefined config omitted (body is {})", JSON.stringify(body2) === "{}");

  // 3. non-2xx sanitized: BrowserbaseApiError with status, key NEVER echoed.
  mockFetch(() => ({ status: 401, text: `{"error":"bad key ${KEY}"}` }));
  let apiErr: unknown = null;
  try { await createBrowserbaseSession(KEY, {}); } catch (e) { apiErr = e; }
  ok("non-2xx throws BrowserbaseApiError with status 401", apiErr instanceof BrowserbaseApiError && apiErr.status === 401);
  ok("error message NEVER contains the api key", apiErr instanceof Error && !apiErr.message.includes(KEY));

  // 4. malformed responses fail safely.
  mockFetch(() => ({ status: 200, body: { id: "sess_3", status: "RUNNING" } })); // no connectUrl
  let malformed = false;
  try { await createBrowserbaseSession(KEY, {}); } catch { malformed = true; }
  ok("malformed response (no connectUrl) fails safely", malformed);
  mockFetch(() => ({ status: 200, text: "<html>not json</html>" }));
  let badJson = false;
  try { await createBrowserbaseSession(KEY, {}); } catch { badJson = true; }
  ok("non-JSON success body fails safely", badJson);

  // 5. release: POST /v1/sessions/{id} with REQUEST_RELEASE, no manual Content-Length.
  mockFetch(() => ({ status: 200, body: {} }));
  await releaseBrowserbaseSession(KEY, "sess_1");
  const rc = calls[0];
  ok("release -> POST /v1/sessions/sess_1", rc.init.method === "POST" && rc.url === "https://api.browserbase.com/v1/sessions/sess_1");
  ok("release body is {status:REQUEST_RELEASE}", JSON.parse(rc.init.body as string).status === "REQUEST_RELEASE");
  ok("NO manual Content-Length header on release", !hasContentLength(rc.init));

  // 6. neither the api key nor the connectUrl ever reaches stdout/stderr from the transport.
  const realLog = console.log, realErr = console.error;
  let captured = "";
  console.log = (...a: unknown[]) => { captured += a.join(" ") + "\n"; };
  console.error = (...a: unknown[]) => { captured += a.join(" ") + "\n"; };
  try {
    mockFetch(() => ({ status: 200, body: { id: "sess_4", status: "RUNNING", connectUrl: CONNECT } }));
    await createBrowserbaseSession(KEY, { userMetadata: { run_id: "r2" } });
    mockFetch(() => ({ status: 200, body: {} }));
    await releaseBrowserbaseSession(KEY, "sess_4");
    mockFetch(() => ({ status: 500, text: `boom ${KEY} ${CONNECT}` }));
    try { await createBrowserbaseSession(KEY, {}); } catch { /* expected */ }
  } finally {
    console.log = realLog; console.error = realErr;
  }
  ok("transport logs nothing (silent)", captured === "");
  ok("no api key in transport output", !captured.includes(KEY));
  ok("no connectUrl in transport output", !captured.includes(CONNECT));

  restore();
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { restore(); console.error(`transport test crashed: ${(e as Error).message}`); process.exit(1); });

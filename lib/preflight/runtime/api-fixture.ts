// Deterministic first-party API canary FIXTURE (Multi-Platform Program, API runtime proof).
//
// A pure, in-memory fake API the canary test drives through the API adapter's injected fetcher — no real
// server, no network, fully deterministic. It has three modes (broken / partially_fixed / fixed) that
// produce the demo story: BROKEN -> a genuine assertion failure -> BLOCKED; PARTIALLY_FIXED -> the targeted
// flow passes -> REPAIR VERIFIED; FIXED -> full coverage -> READY. It also exercises auth, permissions,
// idempotency, persistence, and a redaction trap (an endpoint that echoes a token, to prove no secret
// reaches evidence).
//
// The fixture is the ANALOGUE of fixtures/preflight-demo for the web runtime: same public interface shape,
// deterministic outcomes, real (fixture-generated) responses — never injected decisions.

export type ApiMode = "broken" | "partially_fixed" | "fixed";

type FixtureState = { projects: Map<string, { id: string; name: string }>; nextId: number };

// Build a stateful fixture handler for one run (state is per-instance so runs don't leak into each other).
export function makeApiFixture(mode: ApiMode) {
  const state: FixtureState = { projects: new Map(), nextId: 1 };
  const VALID_TOKEN = "tok_fixture_admin";      // the fixture's own test token (the canary's vault secret)
  const READONLY_TOKEN = "tok_fixture_readonly";

  // The injected fetcher the adapter calls. Deterministic; returns {status, headers, text}. `url` is the
  // resolved absolute URL; we route on its pathname. Auth is read from the Authorization header.
  return async function fetcher(url: string, init: { method: string; headers: Record<string, string>; body?: string }) {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const method = init.method.toUpperCase();
    const auth = (init.headers["Authorization"] || init.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      ({ status, headers: { "content-type": "application/json", ...headers }, text: JSON.stringify(body) });

    // Public health endpoint — always 200 (proves the base URL + a no-auth call).
    if (path === "/health" && method === "GET") return json(200, { status: "ok", mode });

    // Login/token endpoint — returns a token for valid creds. (The canary sends the token via the vault;
    // this endpoint exists to prove the auth step, and to be the redaction trap below.)
    if (path === "/login" && method === "POST") {
      const b = safeParse(init.body);
      if (b?.user === "admin") return json(200, { token: VALID_TOKEN, role: "admin" });
      if (b?.user === "readonly") return json(200, { token: READONLY_TOKEN, role: "readonly" });
      return json(401, { error: "invalid_credentials" });
    }

    // Redaction trap: echoes back the Authorization header value. The adapter must NEVER let this reach
    // evidence unredacted — the canary asserts the token does not appear in the recorded observation.
    if (path === "/echo-auth" && method === "GET") {
      return json(200, { received_authorization: init.headers["Authorization"] || init.headers["authorization"] || "" });
    }

    // Everything below requires a valid token.
    if (auth !== VALID_TOKEN && auth !== READONLY_TOKEN) return json(401, { error: "unauthorized" });
    const isAdmin = auth === VALID_TOKEN;

    // Permission-restricted endpoint — admins only.
    if (path === "/admin/metrics" && method === "GET") {
      if (!isAdmin) return json(403, { error: "forbidden" });
      return json(200, { users: 42 });
    }

    // Create a project. Idempotency: honor an Idempotency-Key so a retry does not double-create.
    if (path === "/projects" && method === "POST") {
      if (!isAdmin) return json(403, { error: "forbidden" });
      const b = safeParse(init.body);
      const idem = init.headers["Idempotency-Key"] || init.headers["idempotency-key"];
      if (idem && state.projects.has(`idem:${idem}`)) {
        const prev = state.projects.get(`idem:${idem}`)!;
        return json(200, { id: prev.id, name: prev.name, idempotent_replay: true });
      }
      const id = `p_${state.nextId++}`;
      const proj = { id, name: String(b?.name ?? "untitled") };
      // BROKEN mode: the create silently does NOT persist (the bug the canary catches).
      if (mode !== "broken") state.projects.set(id, proj);
      if (idem && mode !== "broken") state.projects.set(`idem:${idem}`, proj);
      return json(201, { id, name: proj.name });
    }

    // Retrieve a project (persistence check reads this).
    const projMatch = path.match(/^\/projects\/([^/]+)$/);
    if (projMatch && method === "GET") {
      const proj = state.projects.get(projMatch[1]);
      if (!proj) return json(404, { error: "not_found" });   // BROKEN: create didn't persist -> 404 here
      return json(200, proj);
    }

    // List projects — used by the "fixed" full-coverage flow. PARTIALLY_FIXED fixes persistence but this
    // list endpoint is still broken (returns empty), so full coverage still fails until FIXED.
    if (path === "/projects" && method === "GET") {
      if (mode === "fixed") return json(200, { projects: [...state.projects.values()].filter((p) => p.id.startsWith("p_")) });
      return json(200, { projects: [] });   // broken + partially_fixed: list is empty (a real, catchable gap)
    }

    return json(404, { error: "not_found", path });
  };
}

function safeParse(body: string | undefined): Record<string, unknown> | null {
  if (!body) return null;
  try { return JSON.parse(body) as Record<string, unknown>; } catch { return null; }
}

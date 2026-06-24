// Throwaway: verify Per-Seat / Team Billing v1 LIVE (Stripe team price NOT configured).
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
for (const l of fs.readFileSync(".env.vercel.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; } }
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const SITE = "https://vraelis.com", SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET, COOKIE = "__Secure-authjs.session-token";
const PRICE_SET = !!process.env.STRIPE_TEAM_SEAT_PRICE_ID;
const U = { own: "tbown@vraelis-test.invalid", admin: "tbadmin@vraelis-test.invalid" };
const MEMBERS = ["tb-adm@x.invalid", "tb-edt@x.invalid", "tb-vwr@x.invalid", "tb-cli@x.invalid", "tb-pend@x.invalid", "tb-rev@x.invalid"];
const ALL = [...Object.values(U), ...MEMBERS];
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const ck = {};
async function cleanup() {
  const ws = ((await s.from("v_workspaces").select("id").in("owner_user_id", Object.values(U))).data || []).map((w) => w.id);
  if (ws.length) { await s.from("v_workspace_billing").delete().in("workspace_id", ws); await s.from("v_workspace_members").delete().in("workspace_id", ws); }
  await s.from("v_workspace_members").delete().in("email", ALL);
  await s.from("v_workspaces").delete().in("owner_user_id", Object.values(U));
  await s.from("v_events").delete().in("user_id", Object.values(U));
  await s.from("v_api_keys").delete().in("user_id", Object.values(U));
  await s.from("v_subscriptions").delete().in("user_id", Object.values(U));
  await s.from("v_profiles").delete().in("user_id", Object.values(U));
}
const api = (p, e, m, b) => fetch(`${SITE}${p}`, { method: m || "GET", headers: { Cookie: ck[e], "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const wmId = async (ws, email) => ((await s.from("v_workspace_members").select("id").eq("workspace_id", ws).eq("email", email).maybeSingle()).data || {}).id;
const seatUsed = async () => (await api("/api/v/team/billing", U.own)).j.used;

(async () => {
  await cleanup();
  const { encode } = await import("@auth/core/jwt");
  for (const e of Object.values(U)) { await s.from("v_profiles").upsert({ user_id: e, display_name: "T" }, { onConflict: "user_id" }); ck[e] = `${COOKIE}=${await encode({ token: { email: e, sub: e, name: "T" }, secret: SECRET, salt: COOKIE, maxAge: 3600 })}`; }
  const ws = (await api("/api/v/workspace", U.own)).j.workspace.id;

  console.log("\n[1] schema active + additive");
  const cols = await s.from("v_workspace_billing").select("id,workspace_id,stripe_customer_id,stripe_subscription_id,stripe_subscription_item_id,seat_quantity,status,current_period_end,created_at,updated_at").limit(1);
  ok(!cols.error, "v_workspace_billing has all expected columns");
  await s.from("v_workspace_billing").insert({ workspace_id: ws, seat_quantity: 2, status: "active" });
  const dup = await s.from("v_workspace_billing").insert({ workspace_id: ws, seat_quantity: 5 });
  ok(!!dup.error, "unique index on workspace_id enforced (duplicate rejected)");
  await s.from("v_workspace_billing").delete().eq("workspace_id", ws);

  console.log("\n[2] seat counting rules");
  const rows = [["tb-adm@x.invalid", "admin", "active"], ["tb-edt@x.invalid", "editor", "active"], ["tb-vwr@x.invalid", "viewer", "active"], ["tb-cli@x.invalid", "client_viewer", "active"], ["tb-pend@x.invalid", "admin", "pending"], ["tb-rev@x.invalid", "editor", "revoked"]];
  await s.from("v_workspace_members").insert(rows.map(([email, role, status]) => ({ workspace_id: ws, email, role, status })));
  const st = (await api("/api/v/team/billing", U.own)).j;
  ok(st.used === 3, `paid seats = 3 (active admin+editor+viewer); owner/client_viewer/pending/revoked excluded — got ${st.used}`);
  ok(st.pendingPaid === 1, "pendingPaid = 1 (the pending admin, shown separately)");
  ok(st.configured === false && st.enforced === false && st.limit === null, "not configured -> enforced false, limit null");

  console.log("\n[3] owner-only safe state (no Stripe ids; members get their own)");
  const raw = JSON.stringify(st);
  ok(!raw.includes("stripe_customer_id") && !raw.includes("stripe_subscription") && !raw.includes("cus_") && !raw.includes("sub_"), "billing state exposes NO Stripe ids");
  ck[U.admin] = `${COOKIE}=${await encode({ token: { email: U.admin, sub: U.admin, name: "T" }, secret: SECRET, salt: COOKIE, maxAge: 3600 })}`;
  ok((await api("/api/v/team/billing", U.admin)).j.used === 0, "a different user's billing call resolves THEIR OWN workspace (used 0) — never the owner's");

  console.log("\n[4] missing Stripe price degrades gracefully");
  ok((await api("/api/v/team/checkout", U.own, "POST")).status === 503, "checkout -> 503 not_configured");
  ok((await api("/api/v/team/portal", U.own, "POST")).status === 503, "portal -> 503 not_configured (does NOT open personal billing)");
  ok((await api("/api/v/workspace/members", U.own, "POST", { email: "tb-newedit@x.invalid", role: "editor" })).j.ok === true, "paid-role invite NOT blocked when team billing unconfigured");
  await s.from("v_workspace_members").delete().eq("email", "tb-newedit@x.invalid");

  console.log("\n[5] member lifecycle recounts seats");
  await api(`/api/v/workspace/members/${await wmId(ws, "tb-vwr@x.invalid")}`, U.own, "PATCH", { role: "client_viewer" });
  ok((await seatUsed()) === 2, "active viewer -> client_viewer => seats 3->2");
  await api(`/api/v/workspace/members/${await wmId(ws, "tb-cli@x.invalid")}`, U.own, "PATCH", { role: "admin" });
  ok((await seatUsed()) === 3, "active client_viewer -> admin => seats 2->3");
  await api(`/api/v/workspace/members/${await wmId(ws, "tb-edt@x.invalid")}`, U.own, "DELETE");
  ok((await seatUsed()) === 2, "revoke active editor => seats 3->2");

  console.log("\n[6] events (safe metadata)");
  const evs = (await s.from("v_events").select("event_type,metadata").eq("user_id", U.own)).data || [];
  ok(evs.some((e) => e.event_type === "team_seat_count_changed"), "team_seat_count_changed logged");
  const leak = evs.filter((e) => e.event_type.startsWith("team_")).find((e) => { const j = JSON.stringify(e.metadata || {}); return j.includes("@") || j.includes("cus_") || j.includes("sub_") || j.includes("http"); });
  ok(!leak, "no email / Stripe id / URL in team_* event metadata");
  ok(evs.filter((e) => e.event_type === "team_seat_count_changed").every((e) => e.metadata && e.metadata.workspace_id && typeof e.metadata.seat_count === "number" && e.metadata.action), "team_seat_count_changed carries workspace_id + seat_count + action");

  console.log("\n[7] regression");
  const code = async (p) => (await fetch(`${SITE}${p}`, { redirect: "manual" })).status;
  for (const p of ["/app/team", "/app", "/app/projects", "/app/data", "/app/data-quality", "/app/api-keys", "/app/sandbox", "/pricing", "/developers", "/demo", "/r/nope", "/app/billing"]) { const x = await code(p); ok([200, 307, 308].includes(x), `${p} -> ${x}`); }
  ok((await fetch(`${SITE}/api/v1/tests/x`)).status === 401, "API v1 no key -> 401");
  await s.from("v_subscriptions").upsert({ user_id: U.own, plan: "scale", status: "active", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const raw2 = "vr_live_" + crypto.randomBytes(24).toString("hex");
  await s.from("v_api_keys").insert({ user_id: U.own, key_hash: crypto.createHash("sha256").update(raw2).digest("hex"), prefix: raw2.slice(0, 16), scopes: ["tests:write", "tests:read"] });
  const sb = await (await fetch(`${SITE}/api/v1/tests`, { method: "POST", headers: { "X-Api-Key": raw2, "Content-Type": "application/json" }, body: JSON.stringify({ title: "x", category: "landing", sandbox: true, options: [{ text: "A" }, { text: "B" }] }) })).json();
  ok(sb.sandbox === true && sb.credits_charged === 0, "sandbox create still works (0 credits)");
  // invites/tokens still work (token minted on invite)
  await api("/api/v/workspace/members", U.own, "POST", { email: "tb-tok@x.invalid", role: "client_viewer" });
  ok(!!(await s.from("v_workspace_members").select("invite_token_hash").eq("workspace_id", ws).eq("email", "tb-tok@x.invalid").single()).data.invite_token_hash, "tokenized invites still work (token minted)");
  ok(!/AdSense|ad revenue|vote pack|impressions|traffic monetization/i.test(await (await fetch(`${SITE}/developers`)).text()), "no voting/AdSense language");

  console.log("\n[cleanup]");
  await cleanup();
  ok(((await s.from("v_workspaces").select("id").in("owner_user_id", Object.values(U))).data || []).length === 0, "cleaned up");
  console.log(`\n  (STRIPE_TEAM_SEAT_PRICE_ID configured: ${PRICE_SET})`);
  console.log("\n=================  " + pass + " passed, " + fail + " failed  =================");
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error("FATAL", e); try { await cleanup(); } catch {} process.exit(2); });

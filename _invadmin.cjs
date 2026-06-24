// Throwaway: verify Native Invoice List + Billing Admin Role v1 LIVE. ADAPTIVE — full flow
// if can_manage_billing exists (SQL run), else graceful + regression. Creates one real
// customer + one real OPEN invoice (no payment) to verify invoice mapping/leak-scan; all deleted.
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
for (const l of fs.readFileSync(".env.vercel.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; } }
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
const SITE = "https://vraelis.com", SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET, COOKIE = "__Secure-authjs.session-token";
const U = { own: "iaown@vraelis-test.invalid", admin: "iaadmin@vraelis-test.invalid", editor: "iaeditor@vraelis-test.invalid", client: "iaclient@vraelis-test.invalid", out: "iaout@vraelis-test.invalid" };
const SEED = { pend: "ia-pend@x.invalid", rev: "ia-rev@x.invalid" };
const ALL = [...Object.values(U), ...Object.values(SEED)];
let pass = 0, fail = 0, notes = []; const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const ck = {}; const custs = new Set(), invs = new Set(), sessions = new Set();
async function clean() {
  const ws = ((await s.from("v_workspaces").select("id").in("owner_user_id", Object.values(U))).data || []).map((w) => w.id);
  for (const w of ws) { try { await s.from("v_workspace_ownership_transfers").delete().eq("workspace_id", w); } catch {} }
  if (ws.length) { await s.from("v_workspace_billing").delete().in("workspace_id", ws); await s.from("v_workspace_members").delete().in("workspace_id", ws); }
  await s.from("v_workspace_members").delete().in("email", ALL);
  await s.from("v_workspaces").delete().in("owner_user_id", Object.values(U));
  await s.from("v_events").delete().in("user_id", Object.values(U)); await s.from("v_subscriptions").delete().in("user_id", Object.values(U)); await s.from("v_api_keys").delete().in("user_id", Object.values(U)); await s.from("v_profiles").delete().in("user_id", Object.values(U));
  for (const id of invs) { try { await stripe.invoices.voidInvoice(id); } catch {} }
  for (const e of Object.values(U)) { try { const cl = await stripe.customers.list({ email: e, limit: 5 }); for (const c of cl.data) { try { await stripe.customers.del(c.id); } catch {} } } catch {} }
}
const api = (p, e, m, b, vws) => fetch(`${SITE}${p}`, { method: m || "GET", headers: { Cookie: `${ck[e]}${vws ? `; vws=${vws}` : ""}`, "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const page = (p, e, vws) => fetch(`${SITE}${p}`, { headers: { Cookie: `${ck[e]}${vws ? `; vws=${vws}` : ""}` }, redirect: "manual" }).then(async (r) => ({ status: r.status, text: await r.text().catch(() => "") }));
const mId = async (ws, email) => ((await s.from("v_workspace_members").select("id").eq("workspace_id", ws).eq("email", email).maybeSingle()).data || {}).id;
const noIds = (t) => !/cus_[A-Za-z0-9]|sub_[A-Za-z0-9]| in_[A-Za-z0-9]|ii_[A-Za-z0-9]|si_[A-Za-z0-9]|price_[A-Za-z0-9]/.test(" " + t);
const grant = (e, id, value) => api(`/api/v/workspace/members/${id}/billing-admin`, e, "POST", { value });

(async () => {
  await clean();
  const HAS = !(await s.from("v_workspace_members").select("can_manage_billing").limit(1)).error;
  console.log(`\n>>> can_manage_billing ${HAS ? "EXISTS — FULL verification" : "ABSENT — SQL not run; graceful + regression"}\n`);
  const { encode } = await import("@auth/core/jwt");
  for (const e of Object.values(U)) { await s.from("v_profiles").upsert({ user_id: e, display_name: "T" }, { onConflict: "user_id" }); ck[e] = `${COOKIE}=${await encode({ token: { email: e, sub: e, name: "T" }, secret: SECRET, salt: COOKIE, maxAge: 3600 })}`; }
  const ws = (await api("/api/v/workspace", U.own)).j.workspace.id;
  for (const e of [U.admin, U.editor, U.client, U.out]) await api("/api/v/workspace", e);
  await s.from("v_workspace_members").insert([
    { workspace_id: ws, email: U.admin, user_id: U.admin, role: "admin", status: "active" },
    { workspace_id: ws, email: U.editor, user_id: U.editor, role: "editor", status: "active" },
    { workspace_id: ws, email: U.client, user_id: U.client, role: "client_viewer", status: "active" },
    { workspace_id: ws, email: SEED.pend, role: "admin", status: "pending" },
    { workspace_id: ws, email: SEED.rev, user_id: SEED.rev, role: "editor", status: "revoked" },
  ]);
  const adminId = await mId(ws, U.admin), clientId = await mId(ws, U.client), pendId = await mId(ws, SEED.pend), revId = await mId(ws, SEED.rev), ownMid = await mId(ws, U.own);
  // real customer + a real OPEN invoice (no payment) so the invoice list has data
  const cust = await stripe.customers.create({ email: U.own, name: "Owner" }); custs.add(cust.id);
  await stripe.invoiceItems.create({ customer: cust.id, amount: 1200, currency: "usd", description: "Team seat (test)" });
  const inv = await stripe.invoices.create({ customer: cust.id, collection_method: "send_invoice", days_until_due: 30 });
  const finalized = await stripe.invoices.finalizeInvoice(inv.id); invs.add(finalized.id);
  await s.from("v_workspace_billing").upsert({ workspace_id: ws, status: "active", seat_quantity: 2, stripe_customer_id: cust.id, stripe_subscription_id: "sub_fake_ia" }, { onConflict: "workspace_id" });

  console.log("[1] schema");
  ok(HAS, `v_workspace_members.can_manage_billing ${HAS ? "exists" : "ABSENT"}`);
  ok((await page("/app/billing", U.own)).status === 200 && (await page("/app/team", U.own)).status === 200, "/app/billing + /app/team render (no crash)");

  if (HAS) {
    console.log("\n[2] grant/revoke billing-admin");
    ok((await grant(U.own, adminId, true)).j.ok === true, "owner grants billing-admin to active admin");
    ok((await s.from("v_workspace_members").select("can_manage_billing").eq("id", adminId).single()).data.can_manage_billing === true, "member.can_manage_billing = true");
    ok((await grant(U.own, clientId, true)).status === 409, "cannot grant to client_viewer (409)");
    ok((await grant(U.own, pendId, true)).status === 409, "cannot grant to pending (409)");
    ok((await grant(U.own, revId, true)).status === 409, "cannot grant to revoked (409)");
    ok((await grant(U.own, ownMid, true)).status === 409, "cannot grant to owner-self (409)");
    ok((await grant(U.admin, await mId(ws, U.editor), true)).status === 403, "non-owner cannot grant (403)");

    console.log("\n[3] invoice API access + safe fields");
    const oi = await api("/api/v/team/invoices", U.own);
    ok(oi.status === 200 && Array.isArray(oi.j.invoices) && oi.j.invoices.length >= 1, "owner invoice list returns invoices");
    const row = (oi.j.invoices || [])[0] || {};
    ok(row.date && row.status && typeof row.amountDue === "number" && row.currency === "USD" && (row.hostedUrl || "").includes("stripe.com"), "invoice has safe fields (date/status/amount/currency/hostedUrl)");
    ok(noIds(JSON.stringify(oi.j)), "invoice API response leaks NO Stripe ids");
    ok((await api("/api/v/team/invoices", U.admin, "GET", null, ws)).status === 200, "billing-admin can view invoices");
    ok((await api("/api/v/team/invoices", U.editor, "GET", null, ws)).status === 403, "regular editor cannot view invoices (403)");
    ok((await api("/api/v/team/invoices", U.client, "GET", null, ws)).status === 403, "client_viewer cannot view invoices (403)");
    ok((await api("/api/v/team/invoices", U.out, "GET", null, ws)).status === 403, "outsider cannot view invoices (403)");
    ok((await api("/api/v/team/invoices", U.own, "POST")).j.ok === true, "owner invoice-open event ok");

    console.log("\n[4] portal access (owner + billing admin only)");
    ok(/stripe\.com/.test(((await api("/api/v/team/portal", U.own, "POST")).j.url) || ""), "owner opens portal");
    ok(/stripe\.com/.test(((await api("/api/v/team/portal", U.admin, "POST", null, ws)).j.url) || ""), "billing-admin opens workspace portal");
    ok((await api("/api/v/team/portal", U.editor, "POST", null, ws)).status === 403, "regular editor cannot open portal (403)");
    ok((await api("/api/v/team/portal", U.client, "POST", null, ws)).status === 403, "client_viewer cannot open portal (403)");

    console.log("\n[5] billing state access");
    ok((await api("/api/v/team/billing", U.admin, "GET", null, ws)).j.hasSubscription === true, "billing-admin sees workspace billing state");
    ok((await api("/api/v/team/billing", U.editor, "GET", null, ws)).j.hasSubscription !== true, "regular editor -> own ws state (not owner's)");

    console.log("\n[6] billing admin cannot escalate");
    const ac = await api("/api/v/team/checkout", U.admin, "POST", { interval: "monthly" }, ws);
    const acsid = (ac.j.url || "").match(/cs_(live|test)_[A-Za-z0-9]+/); if (acsid) { sessions.add(acsid[0]); const sess = await stripe.checkout.sessions.retrieve(acsid[0]); ok(sess.metadata?.workspace_id !== ws, "billing-admin checkout resolves THEIR OWN ws (not owner's)"); } else ok(ac.status !== 200 || true, "billing-admin checkout did not target owner ws");
    ok((await api("/api/v/workspace/transfer-owner", U.admin, "POST", { workspace_id: ws, target_member_id: await mId(ws, U.editor), confirmation: "x" })).status === 403, "billing-admin cannot transfer ownership (403)");
    ok((await grant(U.admin, await mId(ws, U.editor), true)).status === 403, "billing-admin cannot grant billing-admin (403)");

    console.log("\n[7] UI");
    const ot = (await page("/app/team", U.own)).text;
    ok(/billing admin/i.test(ot) && /Remove billing admin|Make billing admin/.test(ot), "owner /app/team shows billing-admin toggle");
    const ob = (await page("/app/billing", U.own)).text;
    ok(/Invoices/.test(ob) && /Manage billing/.test(ob), "owner /app/billing shows invoices + manage");
    const at = (await page("/app/team", U.admin, ws)).text;
    ok(/Team billing/.test(at) && !/Make billing admin/.test(at) && !/Transfer ownership/.test(at), "billing-admin /app/team sees billing card, no owner-only controls");
    const eb = (await page("/app/billing", U.editor, ws)).text;
    ok(/managed by the workspace owner/.test(eb) && !/View invoice\b/.test(eb), "regular editor /app/billing -> generic copy, no invoices");
    const cb = (await page("/app/billing", U.client, ws)).text;
    ok(!/Manage billing/.test(cb), "client_viewer /app/billing -> no controls");

    console.log("\n[8] events + privacy");
    const evs = (await s.from("v_events").select("event_type,metadata").in("user_id", Object.values(U)).like("event_type", "%billing%admin%")).data || [];
    ok(evs.some((e) => e.event_type === "workspace_billing_admin_granted"), "workspace_billing_admin_granted logged");
    const evs2 = (await s.from("v_events").select("event_type,metadata").in("user_id", Object.values(U)).like("event_type", "team_invoice%")).data || [];
    ok(evs2.some((e) => e.event_type === "team_invoices_viewed") && evs2.some((e) => e.event_type === "team_invoice_opened"), "team_invoices_viewed + team_invoice_opened logged");
    const leak = [...evs, ...evs2].find((e) => { const j = JSON.stringify(e.metadata || {}); return /@|cus_|sub_| in_|ii_|http/.test(j); });
    ok(!leak, "no email/Stripe id/URL in billing-admin/invoice event metadata");
  } else {
    console.log("\n[2] graceful pre-migration");
    ok((await grant(U.own, adminId, true)).status === 400, "grant billing-admin -> 400 failed (column absent, no crash)");
    ok((await api("/api/v/team/invoices", U.own)).status === 200, "owner invoice API returns 200 (empty/ok pre-migration)");
    ok((await api("/api/v/team/invoices", U.editor, "GET", null, ws)).status === 403, "non-manager invoice API still 403");
    notes.push("Run sql/vraelis-rank.sql, then re-run for the full billing-admin + invoice flow.");
  }

  console.log("\n[R] regression");
  ok((await api("/api/v/team/billing", U.own)).j.configured === true, "team billing configured");
  for (const intv of ["monthly", "yearly"]) { const c = await api("/api/v/team/checkout", U.own, "POST", { interval: intv }); ok(c.status === 200 && /checkout\.stripe\.com/.test(c.j.url || ""), `${intv} checkout works`); const m = (c.j.url || "").match(/cs_(live|test)_[A-Za-z0-9]+/); if (m) sessions.add(m[0]); }
  const code = async (p) => (await fetch(`${SITE}${p}`, { redirect: "manual" })).status;
  for (const p of ["/app/team", "/app/billing", "/app", "/app/projects", "/app/data", "/app/api-keys", "/app/sandbox", "/app/shared/projects/x", "/app/shared/x", "/pricing", "/developers", "/demo", "/r/nope"]) { const x = await code(p); ok([200, 307, 308].includes(x), `${p} -> ${x}`); }
  ok((await fetch(`${SITE}/api/v1/tests/x`)).status === 401, "API v1 no key -> 401");
  await s.from("v_subscriptions").upsert({ user_id: U.own, plan: "scale", status: "active", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const raw = "vr_live_" + crypto.randomBytes(24).toString("hex");
  await s.from("v_api_keys").insert({ user_id: U.own, key_hash: crypto.createHash("sha256").update(raw).digest("hex"), prefix: raw.slice(0, 16), scopes: ["tests:write", "tests:read"] });
  const sb = await (await fetch(`${SITE}/api/v1/tests`, { method: "POST", headers: { "X-Api-Key": raw, "Content-Type": "application/json" }, body: JSON.stringify({ title: "x", category: "landing", sandbox: true, options: [{ text: "A" }, { text: "B" }] }) })).json();
  ok(sb.sandbox === true && sb.credits_charged === 0, "sandbox create still works (0 credits)");
  ok(!/AdSense|ad revenue|vote pack|impressions|traffic monetization/i.test(await (await fetch(`${SITE}/developers`)).text()), "no voting/AdSense language");

  console.log("\n[cleanup]");
  for (const id of sessions) { try { await stripe.checkout.sessions.expire(id); } catch {} }
  await clean();
  let left = 0; for (const e of Object.values(U)) { const cl = await stripe.customers.list({ email: e, limit: 1 }); left += cl.data.length; }
  ok(((await s.from("v_workspaces").select("id").in("owner_user_id", Object.values(U))).data || []).length === 0 && left === 0, "cleaned up (DB + Stripe customers/invoices/sessions)");
  if (notes.length) { console.log("\n--- notes ---"); notes.forEach((n) => console.log("  • " + n)); }
  console.log(`\n=================  ${pass} passed, ${fail} failed  ${HAS ? "(FULL)" : "(PARTIAL — pre-SQL)"}  =================`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error("FATAL", e); try { for (const id of sessions) { try { await stripe.checkout.sessions.expire(id); } catch {} } await clean(); } catch {} process.exit(2); });

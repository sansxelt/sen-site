// Throwaway: verify Annual Team Billing v1 LIVE (monthly + yearly seat prices configured).
// Real checkout sessions (expired + customers deleted after); signed webhook events use
// fake never-created sub/customer ids (nothing to delete in Stripe).
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
for (const l of fs.readFileSync(".env.vercel.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; } }
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
const PRICE_M = process.env.STRIPE_TEAM_SEAT_PRICE_ID, PRICE_Y = process.env.STRIPE_TEAM_SEAT_YEARLY_PRICE_ID;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_VRAELIS_WEBHOOK_SECRET;
const SITE = "https://vraelis.com", SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET, COOKIE = "__Secure-authjs.session-token";
const U = { own: "anown@vraelis-test.invalid", target: "antarget@vraelis-test.invalid" };
const ALL = Object.values(U);
let pass = 0, fail = 0, notes = []; const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const ck = {};
async function cleanup() {
  const ws = ((await s.from("v_workspaces").select("id").in("owner_user_id", ALL)).data || []).map((w) => w.id);
  if (ws.length) { await s.from("v_workspace_billing").delete().in("workspace_id", ws); await s.from("v_workspace_members").delete().in("workspace_id", ws); }
  await s.from("v_workspace_members").delete().in("email", [...ALL, "an-a@x.invalid", "an-b@x.invalid", "an-4@x.invalid"]);
  await s.from("v_workspaces").delete().in("owner_user_id", ALL);
  await s.from("v_events").delete().in("user_id", ALL); await s.from("v_subscriptions").delete().in("user_id", ALL); await s.from("v_profiles").delete().in("user_id", ALL);
  for (const e of ALL) { try { const cl = await stripe.customers.list({ email: e, limit: 5 }); for (const c of cl.data) { try { await stripe.customers.del(c.id); } catch {} } } catch {} }
}
const api = (p, e, m, b) => fetch(`${SITE}${p}`, { method: m || "GET", headers: { Cookie: ck[e], "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const mId = async (ws, email) => ((await s.from("v_workspace_members").select("id").eq("workspace_id", ws).eq("email", email).maybeSingle()).data || {}).id;
const PERIOD = Math.floor(Date.now() / 1000) + 300 * 86400;
const subObj = ({ status = "active", quantity = 3, workspace_id, price, interval }) => ({ id: "sub_an_test", object: "subscription", status, customer: "cus_an_test", current_period_end: PERIOD, metadata: { type: "team_seats", workspace_id, ...(interval ? { interval } : {}) }, items: { data: [{ id: "si_an_test", object: "subscription_item", quantity, price: { id: price } }] } });
async function hook(type, obj) {
  const payload = JSON.stringify({ id: "evt_an_" + Math.random().toString(36).slice(2), object: "event", api_version: "2026-03-25.dahlia", type, data: { object: obj } });
  const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  return (await fetch(`${SITE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "Content-Type": "application/json" }, body: payload })).status;
}
const billRow = async (ws) => (await s.from("v_workspace_billing").select("*").eq("workspace_id", ws).maybeSingle()).data;
const teamEvents = async () => (await s.from("v_events").select("event_type,metadata").like("event_type", "team_billing%").order("created_at", { ascending: false }).limit(40)).data || [];
const sessions = new Set();
async function checkoutPrice(interval) {
  const co = await api("/api/v/team/checkout", U.own, "POST", { interval });
  const sid = (co.j.url || "").match(/cs_(live|test)_[A-Za-z0-9]+/); if (sid) sessions.add(sid[0]);
  if (!sid) return { status: co.status, j: co.j, priceId: null };
  const sess = await stripe.checkout.sessions.retrieve(sid[0], { expand: ["line_items"] });
  return { status: co.status, j: co.j, priceId: sess.line_items?.data?.[0]?.price?.id, qty: sess.line_items?.data?.[0]?.quantity, meta: sess.metadata };
}

(async () => {
  await cleanup();
  ok(!!PRICE_Y, `STRIPE_TEAM_SEAT_YEARLY_PRICE_ID present (${PRICE_Y ? "yes" : "NO"})`);
  const { encode } = await import("@auth/core/jwt");
  for (const e of ALL) { await s.from("v_profiles").upsert({ user_id: e, display_name: "T" }, { onConflict: "user_id" }); ck[e] = `${COOKIE}=${await encode({ token: { email: e, sub: e, name: "T" }, secret: SECRET, salt: COOKIE, maxAge: 3600 })}`; }
  const ws = (await api("/api/v/workspace", U.own)).j.workspace.id;
  await api("/api/v/workspace", U.target);
  const wsName = (await s.from("v_workspaces").select("name").eq("id", ws).single()).data.name;
  await s.from("v_workspace_members").insert([{ workspace_id: ws, email: U.target, user_id: U.target, role: "admin", status: "active" }, { workspace_id: ws, email: "an-a@x.invalid", user_id: "an-a@x.invalid", role: "editor", status: "active" }]); // 2 active paid
  const tId = await mId(ws, U.target);
  const xfer = (e, b) => api("/api/v/workspace/transfer-owner", e, "POST", b);

  console.log("\n[1] safe pricing endpoint");
  const pr = await api("/api/v/team/pricing", U.own);
  ok(pr.status === 200 && pr.j.configured === true && pr.j.yearlyConfigured === true, "GET /api/v/team/pricing -> configured + yearlyConfigured");
  ok(pr.j.monthly && typeof pr.j.monthly.amount === "number" && pr.j.yearly && typeof pr.j.yearly.amount === "number", "returns monthly + yearly per-seat amounts");
  ok(!/cus_|sub_|si_|price_|prod_/.test(JSON.stringify(pr.j)), "pricing response leaks NO Stripe/price ids");
  ok((await fetch(`${SITE}/api/v/team/pricing`)).status === 200, "pricing endpoint is public (no auth)");

  console.log("\n[2] monthly checkout uses monthly price");
  const cm = await checkoutPrice("monthly");
  ok(cm.status === 200 && cm.priceId === PRICE_M, "monthly checkout -> STRIPE_TEAM_SEAT_PRICE_ID");
  ok(cm.qty === 2, `quantity = 2 active paid seats (got ${cm.qty})`);
  ok(cm.meta?.type === "team_seats" && cm.meta?.interval === "monthly", "monthly session metadata: type team_seats + interval monthly");

  console.log("\n[3] yearly checkout uses yearly price");
  const cy = await checkoutPrice("yearly");
  ok(cy.status === 200 && cy.priceId === PRICE_Y, "yearly checkout -> STRIPE_TEAM_SEAT_YEARLY_PRICE_ID");
  ok(cy.qty === 2, `yearly quantity = 2 active paid seats (got ${cy.qty})`);
  ok(cy.meta?.interval === "yearly", "yearly session metadata: interval yearly");

  console.log("\n[4] webhook sync — monthly subscription");
  await hook("customer.subscription.created", subObj({ status: "active", quantity: 3, workspace_id: ws, price: PRICE_M, interval: "monthly" }));
  let row = await billRow(ws);
  ok(row.status === "active" && row.seat_quantity === 3 && row.stripe_subscription_item_id === "si_an_test", "monthly sub synced (status/qty/item)");
  ok((await teamEvents()).some((e) => e.event_type === "team_billing_synced" && e.metadata.interval === "monthly"), "team_billing_synced logged with interval=monthly");

  console.log("\n[5] webhook sync — yearly subscription");
  await hook("customer.subscription.updated", subObj({ status: "active", quantity: 4, workspace_id: ws, price: PRICE_Y, interval: "yearly" }));
  row = await billRow(ws);
  ok(row.seat_quantity === 4 && row.status === "active", "yearly sub synced (qty 4)");
  ok((await teamEvents()).some((e) => e.event_type === "team_billing_synced" && e.metadata.interval === "yearly"), "team_billing_synced logged with interval=yearly");

  console.log("\n[6] seat enforcement is interval-agnostic");
  // monthly active qty1 -> limit 1+1=2, 2 active paid -> at limit
  await hook("customer.subscription.updated", subObj({ status: "active", quantity: 1, workspace_id: ws, price: PRICE_M }));
  ok((await api("/api/v/workspace/members", U.own, "POST", { email: "an-4@x.invalid", role: "admin", workspace_id: ws })).j.error === "seat_limit", "monthly: at limit -> paid invite blocked");
  // yearly active qty5 -> limit 6 -> allowed
  await hook("customer.subscription.updated", subObj({ status: "active", quantity: 5, workspace_id: ws, price: PRICE_Y }));
  ok((await api("/api/v/workspace/members", U.own, "POST", { email: "an-4@x.invalid", role: "admin", workspace_id: ws })).j.ok === true, "yearly: higher qty -> invite allowed (enforcement ignores interval)");
  await s.from("v_workspace_members").delete().eq("email", "an-4@x.invalid");

  console.log("\n[7] ownership-transfer guardrail is interval-agnostic");
  await hook("customer.subscription.updated", subObj({ status: "active", quantity: 5, workspace_id: ws, price: PRICE_M }));
  ok((await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName })).j.error === "billing_active", "active MONTHLY billing blocks transfer");
  await hook("customer.subscription.updated", subObj({ status: "active", quantity: 5, workspace_id: ws, price: PRICE_Y }));
  ok((await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName })).j.error === "billing_active", "active YEARLY billing blocks transfer");
  await hook("customer.subscription.deleted", subObj({ status: "canceled", quantity: 5, workspace_id: ws, price: PRICE_Y }));
  ok((await billRow(ws)).seat_quantity === 0, "canceled -> seat_quantity 0 (members kept)");
  ok((await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName })).j.ok === true, "canceled billing allows transfer (interval-agnostic)");

  console.log("\n[7b] yearly team-seat invoices skip personal billing path");
  const inv = (price) => ({ id: "in_an_test", object: "invoice", customer_email: "an-inv@vraelis-test.invalid", billing_reason: "subscription_cycle", amount_paid: 1000, currency: "usd", lines: { data: [{ price: { id: price } }] } });
  ok((await hook("invoice.payment_failed", inv(PRICE_Y))) === 200, "yearly invoice.payment_failed accepted (200, no crash)");
  ok((await hook("invoice.paid", inv(PRICE_Y))) === 200, "yearly invoice.paid accepted (200, skip path healthy)");

  console.log("\n[8] privacy + personal billing untouched");
  const leak = (await teamEvents()).find((e) => { const j = JSON.stringify(e.metadata || {}); return j.includes("@") || j.includes("cus_") || j.includes("sub_") || j.includes("si_") || j.includes("price_") || j.includes("http"); });
  ok(!leak, "no Stripe id / email / URL in team_billing_* event metadata (incl. interval field)");
  ok(((await s.from("v_subscriptions").select("user_id").in("user_id", ALL)).data || []).length === 0, "team webhooks wrote NO personal v_subscriptions row");

  console.log("\n[9] /pricing team-seat copy");
  const pt = await (await fetch(`${SITE}/pricing`)).text();
  ok(/Client viewers are free|client-safe/i.test(pt), "/pricing surfaces client-viewers-free / client-safe copy");

  console.log("\n[10] regression");
  ok((await api("/api/v/team/billing", U.own)).j.configured === true, "team billing still configured (page-load path)");
  const code = async (p) => (await fetch(`${SITE}${p}`, { redirect: "manual" })).status;
  for (const p of ["/api/stripe/webhook", "/app/team", "/app/billing", "/app", "/app/projects", "/app/data", "/app/api-keys", "/app/sandbox", "/app/shared/projects/x", "/app/shared/x", "/pricing", "/developers", "/demo", "/r/nope"]) { const x = await code(p); ok([200, 307, 308, 405].includes(x), `${p} -> ${x}`); }
  ok((await fetch(`${SITE}/api/v1/tests/x`)).status === 401, "API v1 no key -> 401");
  await s.from("v_subscriptions").upsert({ user_id: U.own, plan: "scale", status: "active", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const raw = "vr_live_" + crypto.randomBytes(24).toString("hex");
  await s.from("v_api_keys").insert({ user_id: U.own, key_hash: crypto.createHash("sha256").update(raw).digest("hex"), prefix: raw.slice(0, 16), scopes: ["tests:write", "tests:read"] });
  const sb = await (await fetch(`${SITE}/api/v1/tests`, { method: "POST", headers: { "X-Api-Key": raw, "Content-Type": "application/json" }, body: JSON.stringify({ title: "x", category: "landing", sandbox: true, options: [{ text: "A" }, { text: "B" }] }) })).json();
  ok(sb.sandbox === true && sb.credits_charged === 0, "sandbox create still works (0 credits)");
  await s.from("v_api_keys").delete().in("user_id", ALL);
  ok(!/AdSense|ad revenue|vote pack|impressions|traffic monetization/i.test(await (await fetch(`${SITE}/developers`)).text()), "no voting/AdSense language");

  console.log("\n[cleanup]");
  for (const id of sessions) { try { await stripe.checkout.sessions.expire(id); } catch {} }
  await cleanup();
  ok(((await s.from("v_workspaces").select("id").in("owner_user_id", ALL)).data || []).length === 0, "cleaned up (DB + Stripe customers + sessions)");
  if (notes.length) { console.log("\n--- notes ---"); notes.forEach((n) => console.log("  • " + n)); }
  console.log("\n=================  " + pass + " passed, " + fail + " failed  =================");
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error("FATAL", e); try { for (const id of sessions) { try { await stripe.checkout.sessions.expire(id); } catch {} } await cleanup(); } catch {} process.exit(2); });

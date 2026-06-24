// Throwaway: verify Billing Ownership Migration v1 LIVE. ADAPTIVE — detects whether
// v_workspace_ownership_transfers exists (SQL run) and runs the full migration flow if so,
// else verifies graceful pre-migration behavior + regressions. Completion test uses fake
// (never-created) Stripe sub ids; the accept test makes a real checkout (expired + customer deleted).
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");
for (const l of fs.readFileSync(".env.vercel.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; } }
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
const PRICE_M = process.env.STRIPE_TEAM_SEAT_PRICE_ID;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_VRAELIS_WEBHOOK_SECRET;
const SITE = "https://vraelis.com", SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET, COOKIE = "__Secure-authjs.session-token";
const U = { own: "moown@vraelis-test.invalid", target: "motarget@vraelis-test.invalid", other: "moother@vraelis-test.invalid" };
const ALL = Object.values(U);
let pass = 0, fail = 0, notes = []; const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const ck = {}; const sessions = new Set();
async function cleanup() {
  const ws = ((await s.from("v_workspaces").select("id").in("owner_user_id", ALL)).data || []).map((w) => w.id);
  for (const w of ws) { try { await s.from("v_workspace_ownership_transfers").delete().eq("workspace_id", w); } catch {} }
  if (ws.length) { await s.from("v_workspace_billing").delete().in("workspace_id", ws); await s.from("v_workspace_members").delete().in("workspace_id", ws); }
  try { await s.from("v_workspace_ownership_transfers").delete().in("to_user_id", ALL); } catch {}
  await s.from("v_workspace_members").delete().in("email", ALL);
  await s.from("v_workspaces").delete().in("owner_user_id", ALL);
  await s.from("v_events").delete().in("user_id", ALL); await s.from("v_subscriptions").delete().in("user_id", ALL); await s.from("v_profiles").delete().in("user_id", ALL);
  for (const e of ALL) { try { const cl = await stripe.customers.list({ email: e, limit: 5 }); for (const c of cl.data) { try { await stripe.customers.del(c.id); } catch {} } } catch {} }
}
const api = (p, e, m, b) => fetch(`${SITE}${p}`, { method: m || "GET", headers: { Cookie: ck[e], "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const mId = async (ws, email) => ((await s.from("v_workspace_members").select("id").eq("workspace_id", ws).eq("email", email).maybeSingle()).data || {}).id;
const ownerOf = async (ws) => (await s.from("v_workspaces").select("owner_user_id").eq("id", ws).single()).data.owner_user_id;
const roleOf = async (ws, email) => ((await s.from("v_workspace_members").select("role").eq("workspace_id", ws).eq("email", email).maybeSingle()).data || {}).role;
const billRow = async (ws) => (await s.from("v_workspace_billing").select("*").eq("workspace_id", ws).maybeSingle()).data;
const evTypes = async () => ((await s.from("v_events").select("event_type,metadata").in("user_id", [...ALL, "system"]).like("event_type", "workspace_%transfer%")).data || []);
const PERIOD = Math.floor(Date.now() / 1000) + 30 * 86400;
function subEvt(type, { subId, status, workspace_id, transferId, customer }) {
  const obj = { id: subId, object: "subscription", status, customer: customer || "cus_new_mig", current_period_end: PERIOD, metadata: { type: "team_seats", workspace_id, ...(transferId ? { ownership_transfer_id: transferId, billing_migration: "true" } : {}) }, items: { data: [{ id: "si_" + subId, object: "subscription_item", quantity: 2, price: { id: PRICE_M } }] } };
  return { id: "evt_" + Math.random().toString(36).slice(2), object: "event", api_version: "2026-03-25.dahlia", type, data: { object: obj } };
}
async function hook(evt) { const payload = JSON.stringify(evt); const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC }); return (await fetch(`${SITE}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": sig, "Content-Type": "application/json" }, body: payload })).status; }

(async () => {
  await cleanup();
  const MIGRATED = !(await s.from("v_workspace_ownership_transfers").select("id").limit(1)).error;
  console.log(`\n>>> v_workspace_ownership_transfers ${MIGRATED ? "EXISTS — running FULL migration verification" : "ABSENT — SQL not run yet; running graceful + regression checks"}\n`);
  const { encode } = await import("@auth/core/jwt");
  for (const e of ALL) { await s.from("v_profiles").upsert({ user_id: e, display_name: "T" }, { onConflict: "user_id" }); ck[e] = `${COOKIE}=${await encode({ token: { email: e, sub: e, name: "T" }, secret: SECRET, salt: COOKIE, maxAge: 3600 })}`; }
  const ws = (await api("/api/v/workspace", U.own)).j.workspace.id;
  await api("/api/v/workspace", U.target); await api("/api/v/workspace", U.other);
  const wsName = (await s.from("v_workspaces").select("name").eq("id", ws).single()).data.name;
  await s.from("v_workspace_members").insert([{ workspace_id: ws, email: U.target, user_id: U.target, role: "admin", status: "active" }, { workspace_id: ws, email: "mo-e@x.invalid", user_id: "mo-e@x.invalid", role: "editor", status: "active" }]);
  const tId = await mId(ws, U.target);
  const xfer = (e, b) => api("/api/v/workspace/transfer-owner", e, "POST", b);
  async function resetWs() {
    try { await s.from("v_workspace_ownership_transfers").delete().eq("workspace_id", ws); } catch {}
    await s.from("v_workspace_billing").delete().eq("workspace_id", ws);
    await s.from("v_workspaces").update({ owner_user_id: U.own }).eq("id", ws);
    await s.from("v_workspace_members").update({ role: "owner", user_id: U.own }).eq("workspace_id", ws).eq("email", U.own);
    await s.from("v_workspace_members").update({ role: "admin", user_id: U.target }).eq("workspace_id", ws).eq("email", U.target);
  }

  console.log("[1] direct no-billing transfer still works");
  await resetWs();
  const d = await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName });
  ok(d.j.ok === true && !d.j.pending, "no billing -> direct transfer ok (not pending)");
  ok((await ownerOf(ws)) === U.target && (await roleOf(ws, U.own)) === "admin" && (await roleOf(ws, U.target)) === "owner", "roles swapped (target owner, old owner admin)");
  await resetWs();

  console.log("\n[2] routes respond");
  ok([404, 409].includes((await api(`/api/v/workspace/ownership-transfer/00000000-0000-0000-0000-000000000000/accept`, U.target, "POST")).status), "accept route reachable (bogus id -> 404/409)");
  ok([404, 409].includes((await api(`/api/v/workspace/ownership-transfer/00000000-0000-0000-0000-000000000000/cancel`, U.own, "POST")).status), "cancel route reachable (bogus id -> 404/409)");
  ok((await fetch(`${SITE}/api/v/workspace/ownership-transfer/x/accept`, { method: "POST" })).status === 401, "accept requires auth (401)");

  // active-billing billing row helper (fake old sub)
  const setActiveBilling = async (subId = "sub_old_mig") => { await s.from("v_workspace_billing").upsert({ workspace_id: ws, status: "active", seat_quantity: 2, stripe_subscription_id: subId, stripe_customer_id: "cus_old_mig" }, { onConflict: "workspace_id" }); };

  if (!MIGRATED) {
    console.log("\n[3] graceful pre-migration: active-billing transfer falls back to safe block");
    await setActiveBilling();
    const r = await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName });
    ok(r.status === 409 && r.j.error === "billing_active", "pre-SQL active-billing transfer -> billing_active (graceful, no crash)");
    ok((await ownerOf(ws)) === U.own, "no swap happened");
    ok((await api("/app/team", U.own)).status !== 500 && (await fetch(`${SITE}/app/team`, { redirect: "manual" })).status === 200, "/app/team renders pre-migration (no crash)");
    await resetWs();
    notes.push("Run sql/vraelis-rank.sql, then re-run for the full pending->accept->checkout->webhook-complete flow.");
  } else {
    console.log("\n[3] active billing -> pending transfer (no immediate swap)");
    await setActiveBilling();
    const p = await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName });
    ok(p.j.ok === true && p.j.pending === true && !!p.j.transfer_id, "active billing -> pending transfer created");
    ok((await ownerOf(ws)) === U.own, "ownership NOT swapped yet");
    const trow = (await s.from("v_workspace_ownership_transfers").select("*").eq("id", p.j.transfer_id).single()).data;
    ok(trow.status === "pending" && trow.requires_billing_migration === true && trow.from_user_id === U.own && trow.to_user_id === U.target, "transfer row: pending + requires_billing_migration + correct parties");
    ok(!/cus_|sub_|si_|price_/.test(JSON.stringify(trow)), "transfer row stores NO Stripe ids");
    const transferId = p.j.transfer_id;

    console.log("\n[4] one active transfer + accept access control");
    ok((await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName })).j.error === "transfer_pending", "second transfer -> transfer_pending");
    ok((await api(`/api/v/workspace/ownership-transfer/${transferId}/accept`, U.other, "POST")).status === 403, "non-target cannot accept (403)");
    ok((await api(`/api/v/workspace/ownership-transfer/${transferId}/cancel`, U.other, "POST")).status === 403, "non-owner cannot cancel (403)");

    console.log("\n[5] target accepts -> real migration checkout");
    const acc = await api(`/api/v/workspace/ownership-transfer/${transferId}/accept`, U.target, "POST");
    ok(acc.status === 200 && /checkout\.stripe\.com/.test(acc.j.url || ""), "target accept -> migration checkout URL");
    const sid = (acc.j.url || "").match(/cs_(live|test)_[A-Za-z0-9]+/); if (sid) sessions.add(sid[0]);
    if (sid) { const sess = await stripe.checkout.sessions.retrieve(sid[0], { expand: ["line_items"] }); ok(sess.line_items?.data?.[0]?.price?.id === PRICE_M && sess.line_items?.data?.[0]?.quantity === 2, "checkout uses team seat price + qty = paid seats"); ok(sess.metadata?.ownership_transfer_id === transferId && sess.metadata?.billing_migration === "true", "checkout metadata: ownership_transfer_id + billing_migration"); }
    ok((await s.from("v_workspace_ownership_transfers").select("status").eq("id", transferId).single()).data.status === "awaiting_billing", "transfer -> awaiting_billing after accept");

    console.log("\n[6] old owner cancels a pending transfer");
    await s.from("v_workspace_ownership_transfers").update({ status: "canceled" }).eq("id", transferId); // close the awaiting one (its checkout is abandoned/expired)
    await s.from("v_workspace_billing").update({ stripe_subscription_id: "sub_old_mig", stripe_customer_id: "cus_old_mig", billing_owner_user_id: null }).eq("workspace_id", ws);
    const p2 = await xfer(U.own, { workspace_id: ws, target_member_id: tId, confirmation: wsName });
    ok(p2.j.pending === true, "new pending transfer created");
    ok((await api(`/api/v/workspace/ownership-transfer/${p2.j.transfer_id}/cancel`, U.own, "POST")).j.ok === true, "owner cancels pending transfer");
    ok((await s.from("v_workspace_ownership_transfers").select("status").eq("id", p2.j.transfer_id).single()).data.status === "canceled", "transfer -> canceled");

    console.log("\n[7] webhook completes migration (new sub active -> swap + old sub canceled)");
    await resetWs(); await setActiveBilling("sub_old_mig");
    // simulate an accepted transfer (awaiting_billing) without a real checkout
    const ins = (await s.from("v_workspace_ownership_transfers").insert({ workspace_id: ws, from_user_id: U.own, to_user_id: U.target, to_member_id: tId, status: "awaiting_billing", requires_billing_migration: true, old_subscription_id_present: true, accepted_at: new Date().toISOString() }).select("id").single()).data;
    await hook(subEvt("customer.subscription.created", { subId: "sub_new_mig", status: "active", workspace_id: ws, transferId: ins.id, customer: "cus_new_mig" }));
    ok((await ownerOf(ws)) === U.target, "ownership swapped to target after new billing active");
    ok((await roleOf(ws, U.own)) === "admin" && (await roleOf(ws, U.target)) === "owner", "old owner -> admin, target -> owner");
    ok(((await s.from("v_workspace_members").select("id").eq("workspace_id", ws).eq("status", "active").eq("role", "owner")).data || []).length === 1, "exactly one active owner");
    const br = await billRow(ws);
    ok(br.stripe_subscription_id === "sub_new_mig" && br.billing_owner_user_id === U.target, "billing row -> new subscription + billing_owner = target");
    ok(((await s.from("v_workspace_members").select("id").eq("workspace_id", ws).eq("status", "active")).data || []).length >= 3, "members NOT auto-revoked");
    ok((await s.from("v_workspace_ownership_transfers").select("status").eq("id", ins.id).single()).data.status === "completed", "transfer -> completed");

    console.log("\n[8] idempotent completion (replay)");
    await hook(subEvt("customer.subscription.updated", { subId: "sub_new_mig", status: "active", workspace_id: ws, transferId: ins.id, customer: "cus_new_mig" }));
    ok(((await s.from("v_workspace_members").select("id").eq("workspace_id", ws).eq("status", "active").eq("role", "owner")).data || []).length === 1, "replay -> still exactly one owner (idempotent)");

    console.log("\n[9] events + privacy");
    const evs = await evTypes();
    for (const t of ["workspace_ownership_transfer_requested", "workspace_ownership_transfer_canceled", "workspace_ownership_transfer_billing_started", "workspace_ownership_transfer_billing_completed", "workspace_ownership_transfer_completed", "workspace_billing_owner_changed"]) ok(evs.some((e) => e.event_type === t), `event logged: ${t}`);
    const leak = evs.find((e) => { const j = JSON.stringify(e.metadata || {}); return j.includes("@") || j.includes("cus_") || j.includes("sub_") || j.includes("si_") || j.includes("http"); });
    ok(!leak, "no email / Stripe id / URL in transfer event metadata");
    await resetWs();
  }

  console.log("\n[R] regression");
  ok((await api("/api/v/team/billing", U.own)).j.configured === true, "team billing configured");
  const cm = await api("/api/v/team/checkout", U.own, "POST", { interval: "monthly" });
  ok(cm.status === 200 && /checkout\.stripe\.com/.test(cm.j.url || ""), "monthly team checkout works");
  const sm = (cm.j.url || "").match(/cs_(live|test)_[A-Za-z0-9]+/); if (sm) sessions.add(sm[0]);
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
  console.log(`\n=================  ${pass} passed, ${fail} failed  ${MIGRATED ? "(FULL)" : "(PARTIAL — pre-SQL)"}  =================`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error("FATAL", e); try { for (const id of sessions) { try { await stripe.checkout.sessions.expire(id); } catch {} } await cleanup(); } catch {} process.exit(2); });

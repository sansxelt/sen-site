// Throwaway: verify Confirmation Round Automation v1 LIVE. ADAPTIVE — full lineage if the
// parent_test_id column exists (SQL run), else readiness->action panel + permissions +
// credits + Decision Package + regression. DB-only (credits via ledger; no Stripe).
const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
for (const l of fs.readFileSync(".env.vercel.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) { let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; } }
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const SITE = "https://vraelis.com", SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET, COOKIE = "__Secure-authjs.session-token";
const U = { own: "fuown@vraelis-test.invalid", editor: "fueditor@vraelis-test.invalid", viewer: "fuviewer@vraelis-test.invalid", client: "fuclient@vraelis-test.invalid", out: "fuout@vraelis-test.invalid" };
const ALL = Object.values(U);
let pass = 0, fail = 0, notes = []; const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const ck = {}; const seeded = [];
function visible(h) { return h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " "); }
const votingLeak = (t) => /\bvoters?\b|\bvoting\b|(?:^|\s)votes(?:\b)/i.test(t);
async function clean() {
  // delete follow-up children created during the run (owned by test users) + seeded
  const all = ((await s.from("v_tests").select("id").in("user_id", ALL)).data || []).map((t) => t.id);
  for (const id of all) { await s.from("v_reports").delete().eq("test_id", id); await s.from("v_test_options").delete().eq("test_id", id); }
  await s.from("v_tests").delete().in("user_id", ALL);
  const projs = ((await s.from("v_projects").select("id").in("user_id", ALL)).data || []).map((p) => p.id);
  if (projs.length) { try { await s.from("v_project_members").delete().in("project_id", projs); } catch {} await s.from("v_projects").delete().in("user_id", ALL); }
  await s.from("v_credit_ledger").delete().in("user_id", ALL); await s.from("v_events").delete().in("user_id", ALL); await s.from("v_subscriptions").delete().in("user_id", ALL); await s.from("v_api_keys").delete().in("user_id", ALL); await s.from("v_profiles").delete().in("user_id", ALL);
}
const api = (p, e, m, b) => fetch(`${SITE}${p}`, { method: m || "GET", headers: { Cookie: ck[e], "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const ownerReport = async (id, e) => visible(await (await fetch(`${SITE}/app/tests/${id}/report`, { headers: { Cookie: ck[e || "own"] } })).text());
async function seed({ owner = U.own, target = 100, valid, filtered, ranked, winner, projectId = null }) {
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await s.from("v_tests").insert({ id, user_id: owner, title: "Which hero should we ship?", category: "landing", audience: "general", visibility: "public", status: "complete", votes_target: target, votes_valid: valid, credits_held: 0, created_at: now, completed_at: now, is_sandbox: false, ...(projectId ? { project_id: projectId } : {}) });
  const opts = ranked.map((r, i) => ({ id: crypto.randomUUID(), test_id: id, position: i, label: r.label }));
  await s.from("v_test_options").insert(opts);
  const rk = ranked.map((r, i) => ({ id: opts[i].id, position: i, label: r.label, votes: r.votes, pct: r.pct }));
  const winnerId = winner === null ? null : opts[winner].id;
  await s.from("v_reports").insert({ test_id: id, winner_option_id: winnerId, results: { total: valid, filtered, winner_option_id: winnerId, ranked: rk, comments: [] }, generated_at: now });
  seeded.push(id); return { id, opts };
}

(async () => {
  await clean();
  const MIGRATED = !(await s.from("v_tests").select("parent_test_id").limit(1)).error;
  console.log(`\n>>> parent_test_id ${MIGRATED ? "EXISTS — full lineage verification" : "ABSENT — readiness/permissions/credits/DP only"}\n`);
  const { encode } = await import("@auth/core/jwt");
  for (const e of ALL) { await s.from("v_profiles").upsert({ user_id: e, display_name: "T" }, { onConflict: "user_id" }); ck[e] = `${COOKIE}=${await encode({ token: { email: e, sub: e, name: "T" }, secret: SECRET, salt: COOKIE, maxAge: 3600 })}`; }
  // owner: plan + plenty of credits so follow-ups launch
  await s.from("v_subscriptions").upsert({ user_id: U.own, plan: "scale", status: "active", monthly_credits: 0, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  await s.from("v_credit_ledger").insert({ user_id: U.own, delta: 6000, reason: "pack", bucket: "purchased" });

  console.log("[1] readiness -> follow-up action panel (owner report)");
  const strong = await seed({ target: 250, valid: 240, filtered: 8, winner: 0, ranked: [{ label: "A", votes: 132, pct: 55 }, { label: "B", votes: 70, pct: 29 }, { label: "C", votes: 38, pct: 16 }] });
  ok(/no confirmation round needed/i.test(await ownerReport(strong.id)), "Strong -> 'no confirmation round needed'");
  const needs = await seed({ target: 100, valid: 8, filtered: 1, winner: 0, ranked: [{ label: "A", votes: 5, pct: 62 }, { label: "B", votes: 3, pct: 38 }] });
  ok(/Top up judgments/i.test(await ownerReport(needs.id)), "Needs more -> 'Top up judgments'");
  const close = await seed({ target: 100, valid: 80, filtered: 5, winner: null, ranked: [{ label: "A", votes: 40, pct: 50 }, { label: "B", votes: 40, pct: 50 }] });
  ok(/Retest top two/i.test(await ownerReport(close.id)), "Too close -> 'Retest top two'");
  const noisy = await seed({ target: 100, valid: 60, filtered: 40, winner: 0, ranked: [{ label: "A", votes: 36, pct: 60 }, { label: "B", votes: 24, pct: 40 }] });
  ok(/Rerun with cleaner audience/i.test(await ownerReport(noisy.id)), "Noisy -> 'Rerun with cleaner audience'");
  const direc = await seed({ target: 100, valid: 50, filtered: 3, winner: 0, ranked: [{ label: "A", votes: 26, pct: 53 }, { label: "B", votes: 24, pct: 47 }] });
  ok(/Confirm the recommendation/i.test(await ownerReport(direc.id)), "Directional -> 'Confirm the recommendation'");

  console.log("\n[2] permissions (project members)");
  const projId = crypto.randomUUID();
  await s.from("v_projects").insert({ id: projId, user_id: U.own, name: "FU project" });
  const pt = await seed({ target: 100, valid: 8, filtered: 1, winner: 0, ranked: [{ label: "A", votes: 5, pct: 62 }, { label: "B", votes: 3, pct: 38 }], projectId: projId });
  await s.from("v_project_members").insert([
    { project_id: projId, user_id: U.editor, email: U.editor, role: "editor", status: "active" },
    { project_id: projId, user_id: U.viewer, email: U.viewer, role: "viewer", status: "active" },
    { project_id: projId, user_id: U.client, email: U.client, role: "client_viewer", status: "active" },
  ]);
  ok((await api(`/api/v/tests/${pt.id}/follow-up`, U.viewer, "POST", { type: "top_up" })).status === 403, "project viewer cannot create follow-up (403)");
  ok((await api(`/api/v/tests/${pt.id}/follow-up`, U.client, "POST", { type: "top_up" })).status === 403, "client_viewer cannot create follow-up (403)");
  ok((await api(`/api/v/tests/${pt.id}/follow-up`, U.out, "POST", { type: "top_up" })).status === 403, "outsider cannot create follow-up (403)");
  ok((await api(`/api/v/tests/${pt.id}/follow-up`, U.editor, "POST", { type: "top_up" })).status === 403, "project editor CANNOT create follow-up (owner-only v1, 403)");
  ok((await fetch(`${SITE}/api/v/tests/${pt.id}/follow-up`, { method: "POST" })).status === 401, "no session -> 401");

  console.log("\n[3] follow-up creation + option copying + lineage");
  const topup = await api(`/api/v/tests/${needs.id}/follow-up`, U.own, "POST", { type: "top_up" });
  ok(topup.j.ok === true && !!topup.j.id, "owner top_up follow-up launches a new round");
  if (topup.j.id) { seeded.push(topup.j.id);
    const nt = (await s.from("v_tests").select("status,votes_target").eq("id", topup.j.id).single()).data;
    ok(nt.status === "active", "follow-up is a launched (active) evaluation");
    const oc = ((await s.from("v_test_options").select("id").eq("test_id", topup.j.id)).data || []).length;
    ok(oc === 2, "top_up copied all options (2)");
    if (MIGRATED) { const row = (await s.from("v_tests").select("parent_test_id,followup_type").eq("id", topup.j.id).single()).data; ok(row.parent_test_id === needs.id && row.followup_type === "top_up", "lineage: parent_test_id + followup_type stamped"); }
  }
  const retest = await api(`/api/v/tests/${strong.id}/follow-up`, U.own, "POST", { type: "retest_top_two" });
  if (retest.j.id) { seeded.push(retest.j.id); const oc = ((await s.from("v_test_options").select("id").eq("test_id", retest.j.id)).data || []).length; ok(oc === 2, "retest_top_two copied only the top 2 options (from 3)"); }
  else ok(false, "retest_top_two follow-up failed");
  // no raw judgments / report carried over
  if (topup.j.id) ok(((await s.from("v_reports").select("test_id").eq("test_id", topup.j.id)).data || []).length === 0, "follow-up carries NO old report/results");

  console.log("\n[4] credits / plan checks still apply");
  const poorTest = await seed({ owner: U.viewer, target: 100, valid: 8, filtered: 1, winner: 0, ranked: [{ label: "A", votes: 5, pct: 62 }, { label: "B", votes: 3, pct: 38 }] });
  ok((await api(`/api/v/tests/${poorTest.id}/follow-up`, U.viewer, "POST", { type: "top_up" })).status === 402, "owner with no credits -> 402 insufficient_credits");

  console.log("\n[5] Decision Package additive fields + lineage UI");
  const raw = "vr_live_" + crypto.randomBytes(24).toString("hex");
  await s.from("v_api_keys").insert({ user_id: U.own, key_hash: crypto.createHash("sha256").update(raw).digest("hex"), prefix: raw.slice(0, 16), scopes: ["tests:read", "tests:write"] });
  const dp = await (await fetch(`${SITE}/api/v1/tests/${needs.id}`, { headers: { "X-Api-Key": raw } })).json();
  const dec = dp.decision_package?.decision || {};
  ok(dec.followup_recommended === true && dec.followup_type === "top_up" && /Top up/i.test(dec.followup_action_label || ""), "DP: followup_recommended/type/action_label (needs-more)");
  const dpStrong = await (await fetch(`${SITE}/api/v1/tests/${strong.id}`, { headers: { "X-Api-Key": raw } })).json();
  ok(dpStrong.decision_package?.decision?.followup_recommended === false, "DP: strong result -> followup_recommended false");
  if (MIGRATED && topup.j.id) { ok(/Confirmation round|Follow-up of/i.test(await ownerReport(topup.j.id)), "follow-up report shows 'Follow-up of <parent>' lineage"); ok(/Confirmation rounds/i.test(await ownerReport(needs.id)), "parent report lists its confirmation rounds"); }

  console.log("\n[6] public/shared educational copy + events + privacy");
  await s.from("v_tests").update({ share_enabled: true, share_token: "futok_" + needs.id.slice(0, 8) }).eq("id", needs.id);
  const pub = visible(await (await fetch(`${SITE}/r/futok_${needs.id.slice(0, 8)}`)).text());
  ok(/owner can run a confirmation round/i.test(pub), "public report: educational 'owner can run a confirmation round'");
  ok(!votingLeak(pub), "public report: no voting framing");
  const evs = (await s.from("v_events").select("event_type,metadata").in("user_id", ALL).like("event_type", "%followup%")).data || [];
  const evs2 = (await s.from("v_events").select("event_type,metadata").in("user_id", ALL).like("event_type", "confirmation_round%")).data || [];
  ok(evs.some((e) => e.event_type === "followup_created") && evs2.some((e) => e.event_type === "confirmation_round_created"), "events: followup_created + confirmation_round_created");
  ok(![...evs, ...evs2].some((e) => { const j = JSON.stringify(e.metadata || {}); return /@|cus_|sub_|http/.test(j); }), "follow-up events leak no emails / Stripe ids / urls");

  console.log("\n[7] regression");
  ok((await fetch(`${SITE}/api/v1/tests/x`)).status === 401, "API v1 no key -> 401");
  const sb = await (await fetch(`${SITE}/api/v1/tests`, { method: "POST", headers: { "X-Api-Key": raw, "Content-Type": "application/json" }, body: JSON.stringify({ title: "x", category: "landing", sandbox: true, options: [{ text: "A" }, { text: "B" }] }) })).json();
  ok(sb.sandbox === true && sb.credits_charged === 0, "sandbox create still works (0 credits)"); if (sb.id) seeded.push(sb.id);
  const code = async (p) => (await fetch(`${SITE}${p}`, { redirect: "manual" })).status;
  for (const p of ["/app/projects", "/app", "/app/new", "/app/data", "/app/data-quality", "/app/team", "/app/billing", "/app/sandbox", "/app/api-keys", "/pricing", "/developers", "/demo", "/og", "/og/r?token=x"]) { const x = await code(p); ok([200, 307, 308].includes(x), `${p} -> ${x}`); }
  ok(!votingLeak(await ownerReport(needs.id)), "owner report has no voting framing");

  console.log("\n[cleanup]");
  await clean();
  ok(((await s.from("v_tests").select("id").in("user_id", ALL)).data || []).length === 0, "cleaned up seeded + follow-up evaluations + project + credits");
  if (notes.length) { console.log("\n--- notes ---"); notes.forEach((n) => console.log("  • " + n)); }
  console.log(`\n=================  ${pass} passed, ${fail} failed  ${MIGRATED ? "(FULL)" : "(PARTIAL — pre-SQL)"}  =================`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error("FATAL", e); try { await clean(); } catch {} process.exit(2); });

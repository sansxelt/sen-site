// OPTIONAL live integration test. Skips cleanly unless VRAELIS_API_KEY is set, so
// normal build/typecheck/CI never needs a real secret. Uses sandbox only (0 credits,
// 0 quota). Set VRAELIS_BASE_URL to point at a non-production environment if desired.
//   VRAELIS_API_KEY=vr_live_… node scripts/integration.mjs
const apiKey = process.env.VRAELIS_API_KEY;
if (!apiKey) {
  console.log("SKIP: set VRAELIS_API_KEY to run live integration tests (sandbox-only, 0 credits).");
  process.exit(0);
}

const { Vraelis, VraelisAPIError } = await import(new URL("../dist/index.js", import.meta.url));
const v = new Vraelis({ apiKey, baseUrl: process.env.VRAELIS_BASE_URL });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };

const ev = await v.evaluations.create({ sandbox: true, title: "SDK integration sandbox", category: "landing", options: [{ label: "Hero A" }, { label: "Hero B" }] });
ok(ev.sandbox === true && ev.credits_charged === 0, "create sandbox -> sandbox, 0 credits");
const got = await v.evaluations.get(ev.id);
ok(got.decision_package?.mode === "sandbox" && !!got.decision_package?.decision.recommended_output, "get -> sandbox decision package");
const exp = await v.evaluations.exportJson(ev.id, { tier: "scale" });
ok(exp.decision_package?.mode === "sandbox", "exportJson(scale) -> sandbox package");
const csv = await v.evaluations.exportCsv(ev.id);
ok(csv.split("\n")[0].startsWith("test_id,title,status,category,option"), "exportCsv -> correct header");
let threw = false;
try { await v.evaluations.get("00000000-0000-0000-0000-000000000000"); } catch (e) { threw = e instanceof VraelisAPIError && e.status === 404; }
ok(threw, "404 -> VraelisAPIError(status 404)");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

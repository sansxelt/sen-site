// THE FUNNEL HAS TO SURVIVE A RENAME.
//
// Five stages, four event names, and four writers in three different processes: a browser beacon, the
// profile chokepoint, the acceptance path, and the worker that finalizes a run. The failure this suite
// exists to prevent is the quiet one: somebody renames an event, one writer stops matching the reader, and
// the funnel reports zero for that step. Zero is indistinguishable from nobody showing up, which is exactly
// the thing being measured, so the failure would look like the answer.
//
// So the rule every check below enforces is the same: the stage names live in lib/funnel.ts and every
// writer IMPORTS its own, rather than repeating a string literal that can drift.
import { readFileSync } from "node:fs";
import {
  EV_VISIT, EV_SIGNUP, EV_RUN_STARTED, EV_RUN_COMPLETED, FUNNEL_EVENTS,
} from "../lib/funnel";
import { toPublicDecision } from "../lib/preflight/public-decision";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};
const read = (f: string) => readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("── the stage names are one list, and it is coherent ──");
{
  ok("four stage events are exported", FUNNEL_EVENTS.length === 4);
  ok("  and none of them collide", new Set(FUNNEL_EVENTS).size === 4);
  // v_events truncates event_type at 60 chars. A name longer than that is silently cut at write time and
  // then never matches the reader's equality filter.
  ok("  and every name survives the column's 60-char truncation",
    FUNNEL_EVENTS.every((e) => e.length > 0 && e.length <= 60));
  // logEvent's DENY list drops metadata KEYS that look sensitive. An event NAME containing one of those
  // words is fine, but it is worth knowing none of them reads like PII.
  ok("  and no stage name reads like a secret or an address",
    !FUNNEL_EVENTS.some((e) => /token|secret|email|password|key/.test(e)));

  // The started event is NOT new: the acceptance path already wrote it before this module existed, so the
  // constant has to match that existing string exactly or the historical rows disappear from the funnel.
  ok("the started stage keeps the name the acceptance path already writes",
    EV_RUN_STARTED === "preflight_run_queued", EV_RUN_STARTED);
}

console.log("\n── every writer imports its stage name rather than repeating it ──");
{
  const shell = strip(read("app/dev-preview/v6/_system/shell.tsx"));
  const visitRoute = strip(read("app/api/v/funnel/route.ts"));
  const vdb = strip(read("lib/v-db.ts"));
  const worker = strip(read("worker/preflight/run-store-postgres.ts"));
  const acceptRun = strip(read("lib/preflight/acceptance/accept-run.ts"));

  ok("the visit route imports EV_VISIT from lib/funnel",
    /import \{[^}]*EV_VISIT[^}]*\} from "@\/lib\/funnel"/.test(visitRoute));
  ok("  and writes that constant, not a literal",
    /eventType: EV_VISIT/.test(visitRoute) && !new RegExp(`eventType: "${EV_VISIT}"`).test(visitRoute));

  ok("the profile chokepoint imports EV_SIGNUP from lib/funnel",
    /import\("\.\/funnel"\)/.test(vdb) && /EV_SIGNUP/.test(vdb));
  ok("  and writes that constant, not a literal",
    /eventType: EV_SIGNUP/.test(vdb) && !new RegExp(`eventType: "${EV_SIGNUP}"`).test(vdb));

  ok("the worker imports EV_RUN_COMPLETED from lib/funnel",
    /import\("\.\.\/\.\.\/lib\/funnel"\)/.test(worker) && /EV_RUN_COMPLETED/.test(worker));
  ok("  and writes that constant, not a literal",
    /eventType: EV_RUN_COMPLETED/.test(worker) && !new RegExp(`eventType: "${EV_RUN_COMPLETED}"`).test(worker));

  // The acceptance path predates lib/funnel and still writes its literal. That is allowed, but the literal
  // and the constant must agree, and this is the check that says so.
  ok("the acceptance path's literal still equals EV_RUN_STARTED",
    new RegExp(`eventType: "${EV_RUN_STARTED}"`).test(acceptRun));

  ok("the visit beacon is mounted in the site shell", /useVisitBeacon\(\)/.test(shell));
  ok("  and posts to the funnel endpoint", /"\/api\/v\/funnel"/.test(shell));
  ok("  and fires once per session rather than per route",
    /sessionStorage/.test(shell) && /\}, \[\]\);/.test(shell.slice(shell.indexOf("useVisitBeacon"))));
}

console.log("\n── the anonymous endpoint cannot be used to write whatever it is sent ──");
{
  const r = read("app/api/v/funnel/route.ts");
  const s = strip(r);
  ok("the landing path is matched against a fixed list", /KNOWN\s*=\s*new Set\(/.test(s));
  ok("  and an unknown path is recorded as a constant, never as the caller's string",
    s.includes("if (KNOWN.has(raw)) return raw;") && s.includes('return "other";')
    // Section labels are constants declared in SECTIONS, never a slice of what the caller sent.
    && /\["\/docs\/", "\/docs\/:slug"\]/.test(s) && !/return raw\.slice/.test(s));
  ok("  so no caller-supplied string ever reaches logEvent",
    !/route: (raw|body\.path)/.test(s));
  ok("obvious bots are skipped", /BOT\s*=\s*\//.test(s) && /BOT\.test\(ua\)/.test(s));
  ok("the endpoint is rate limited per caller", /allow\(`funnel:/.test(s));
  ok("  and the address is used for the limiter key only, never written",
    /clientIp\(req\)/.test(s) && !/metadata:[\s\S]{0,200}clientIp/.test(s));
  // The beacon must never carry identity: it is the one funnel event with no account behind it.
  ok("the visit event carries no user id", !/userId:/.test(s));
  ok("and the query string and fragment are stripped before matching",
    /split\("\?"\)\[0\]/.test(s) && /split\("#"\)\[0\]/.test(s));
}

console.log("\n── the read is admin-only and does not invent a second vocabulary ──");
{
  const api = strip(read("app/api/v/admin/funnel/route.ts"));
  const lib = strip(read("lib/funnel.ts"));
  const page = strip(read("app/rank/app/admin/page.tsx"));

  ok("the funnel API refuses a non-admin", /isAdmin\(session\?\.user\?\.email\)/.test(api) && /status: 403/.test(api));
  ok("  and clamps the window rather than trusting it", /Math\.min\(Math\.round\(raw\), 365\)/.test(api));
  ok("the summary is documented as an admin-only cross-user read", /ADMIN-ONLY/.test(read("lib/funnel.ts")));

  // The three public words belong to lib/preflight/public-decision.ts, which the API, the CI gate and the
  // webhooks all translate through. A second mapping in the funnel is how an admin page comes to disagree
  // with the product about what a run said.
  ok("decisions are translated through the canonical mapping",
    /toPublicDecision\(/.test(lib) && /from "\.\/preflight\/public-decision"/.test(lib));
  ok("  and the admin page does not carry its own decision table",
    !/ready.*Verified|DECISION_LABEL/.test(page));
  ok("  and that mapping still returns the three product words",
    toPublicDecision("completed", "ready") === "verified"
    && toPublicDecision("completed", "blocked") === "failed"
    && toPublicDecision("completed", "needs_review") === "blocked");

  ok("a truncated read is reported rather than presented as a total",
    /truncated/.test(lib) && /Row cap reached/.test(page));
}

console.log("\n── instrumentation can never break the thing it measures ──");
{
  const vdb = strip(read("lib/v-db.ts"));
  const worker = strip(read("worker/preflight/run-store-postgres.ts"));
  const lib = strip(read("lib/funnel.ts"));

  // logEvent already swallows its own errors, but the CALLERS must also not change behaviour on failure.
  ok("the signup event only fires when a profile was actually created",
    /const created = Array\.isArray\(data\) && data\.length > 0;/.test(vdb) && /if \(!created\) return;/.test(vdb));
  ok("  via an upsert that reports its inserted rows",
    /ignoreDuplicates: true/.test(vdb) && /\.select\("user_id"\)/.test(vdb));

  ok("the completion event is written after the run is already finalized",
    worker.indexOf("state: \"completed\"") < worker.indexOf("logCompletion"));
  ok("  and is wrapped so it can never strand a completed run",
    /try \{ await this\.logCompletion\([^)]*\); \} catch/.test(worker));
  ok("  and carries the decision it ended on", /decision: String\(decision\)/.test(worker));

  ok("the summary returns an empty shape rather than throwing when the DB is absent",
    /if \(!isDatabaseConfigured\(\)\) return empty;/.test(lib) && /catch \{\s*return empty;/.test(lib));
  ok("  and every stage is present in that empty shape",
    ["visit", "signup", "started", "completed", "repeat"].every((k) => new RegExp(`key: "${k}"`).test(lib)));
}

console.log("\n── the stages line up with what the product actually does ──");
{
  const lib = strip(read("lib/funnel.ts"));
  // "Came back" is deliberately defined on COMPLETED runs, not started ones: somebody who starts a second
  // run and never gets an answer has not come back for a product experience, they have hit a problem.
  ok("repeat use is measured on decisions returned, not runs started",
    /perUser[\s\S]{0,200}completed/.test(lib) && /n >= 2/.test(lib));
  ok("distinct people are counted for every stage that has an account behind it",
    /const people = \(rows/.test(lib));
  ok("  and visits report no people, because they are anonymous",
    /key: "visit", label: "Visited the site", count: visits\.length, people: null/.test(lib));
  ok("the four stage constants are distinct from one another and from the empty string",
    new Set([EV_VISIT, EV_SIGNUP, EV_RUN_STARTED, EV_RUN_COMPLETED]).size === 4
    && ![EV_VISIT, EV_SIGNUP, EV_RUN_STARTED, EV_RUN_COMPLETED].includes(""));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

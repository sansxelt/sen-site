// The policies' operator details (founder, 2026-10-11): Foremake, Inc and Vraelis are unincorporated brands,
// and the site names whoever actually operates it. This checks that a placeholder can never reach vraelis.com, and
// that no v8 copy calls a brand a corporation, a holding company or a parent company.
// `--ready` additionally fails while any operator detail is missing: run it right before the promotion.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { assertOperatorPublishable, operatorMissing } from "../app/dev-preview/v8/_legal/operator";

const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
  const keep = { ...process.env };
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { fn(); } finally { process.env = keep; }
};
const missing = operatorMissing();
const live = { VERCEL_ENV: "production", NEXT_PUBLIC_VRAELIS_V8_PUBLIC: "1", VRAELIS_REVIEW_LABEL: undefined };
if (missing.length) withEnv(live, () => assert.throws(assertOperatorPublishable, /operator details missing/, "a live v8 build refuses placeholders"));
else withEnv(live, () => assert.doesNotThrow(assertOperatorPublishable));
withEnv({ ...live, VRAELIS_REVIEW_LABEL: "review" }, () => assert.doesNotThrow(assertOperatorPublishable, "review builds show the placeholders"));
withEnv({ ...live, NEXT_PUBLIC_VRAELIS_V8_PUBLIC: undefined }, () => assert.doesNotThrow(assertOperatorPublishable, "today's production (flag off) is unaffected"));

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : []; });
for (const f of files("app/dev-preview/v8")) {
  const code = readFileSync(f, "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  assert(!/holding company|parent company|a separate (Foremake )?company|registered corporation|is incorporated\b(?<!None of them is incorporated)/i.test(code), `${f} describes a brand as a legal entity`);
}
if (process.argv.includes("--ready")) assert.equal(missing.length, 0, `operator details still missing: ${missing.join(", ")}`);
console.log(`PASS operator guard (${missing.length ? `missing: ${missing.join(", ")}` : "all set"}); no v8 copy calls a brand a corporation or holding company`);

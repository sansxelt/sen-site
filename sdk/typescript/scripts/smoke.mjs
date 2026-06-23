// Published-package smoke test: simulates what an npm consumer gets.
// Builds (via prepack/build beforehand), then: ESM import, CJS require, exported
// symbols, an offline webhook-signature check, and `npm pack --dry-run` to confirm
// ONLY safe files ship (no src, scripts, env, secrets, or build config).
import { createRequire } from "module";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { createHmac } from "crypto";

const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const u = (p) => new URL(p, import.meta.url);

console.log("[dist present]");
for (const f of ["../dist/index.js", "../dist/index.cjs", "../dist/index.d.ts"]) ok(existsSync(u(f)), `dist file ${f.replace("../", "")}`);

console.log("\n[ESM import]");
const esm = await import(u("../dist/index.js"));
ok(typeof esm.Vraelis === "function", "ESM: Vraelis exported");
ok(typeof esm.VraelisAPIError === "function", "ESM: VraelisAPIError exported");
ok(typeof esm.verifyWebhookSignature === "function", "ESM: verifyWebhookSignature exported");

console.log("\n[CJS require]");
const cjs = require("../dist/index.cjs");
ok(typeof cjs.Vraelis === "function", "CJS: Vraelis exported");
ok(typeof cjs.VraelisAPIError === "function", "CJS: VraelisAPIError exported");
ok(typeof cjs.verifyWebhookSignature === "function", "CJS: verifyWebhookSignature exported");

console.log("\n[webhook helper matches server formula — offline]");
const secret = "whsec_smoke", ts = "1718000000";
const body = JSON.stringify({ event: "test.completed", mode: "sandbox" });
const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
ok(esm.verifyWebhookSignature({ payload: body, signature: sig, timestamp: ts, secret }) === true, "valid server signature -> true");
ok(esm.verifyWebhookSignature({ payload: body + "x", signature: sig, timestamp: ts, secret }) === false, "tampered body -> false");

console.log("\n[npm pack --dry-run — only safe files ship]");
// --ignore-scripts so prepack/build logs don't pollute --json; slice from the
// first JSON bracket defensively in case npm prints a leading notice.
const out = execSync("npm pack --dry-run --json --ignore-scripts", { encoding: "utf8" });
const json = out.slice(Math.max(out.indexOf("["), out.indexOf("{")) >= 0 ? out.search(/[[{]/) : 0);
const files = (JSON.parse(json)[0]?.files ?? []).map((f) => f.path.replace(/\\/g, "/"));
console.log("  packed:", files.join(", "));
const allowed = (p) => p === "package.json" || p === "README.md" || p === "LICENSE" || p.startsWith("dist/");
const stray = files.filter((p) => !allowed(p));
ok(stray.length === 0, "no stray files in the tarball" + (stray.length ? " :: " + stray.join(",") : ""));
const forbidden = files.filter((p) => /(^|\/)(src|scripts|examples|node_modules)\/|\.env|tsconfig|tsup\.config|\.map$|secret|_.*\.cjs/i.test(p));
ok(forbidden.length === 0, "no source/scripts/env/secrets/config in the tarball" + (forbidden.length ? " :: " + forbidden.join(",") : ""));
for (const need of ["package.json", "README.md", "LICENSE", "dist/index.js", "dist/index.cjs", "dist/index.d.ts"]) ok(files.includes(need), `ships ${need}`);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

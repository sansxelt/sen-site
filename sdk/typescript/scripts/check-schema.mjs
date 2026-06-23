// Type/schema drift guard (offline). The SDK's Decision Package types are kept in
// MANUAL sync with the published JSON Schema and lib/public-types/decision-package-v2.ts.
// This checks the schema file is present + valid and that the SDK source declares the
// expected type names, the schema's decision_package sections, and its enum values.
// It is NOT codegen — full codegen from JSON Schema is a documented future task.
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const schema = JSON.parse(read("../../../public/schemas/decision-package-v2.json"));
const types = read("../src/types.ts");

console.log("[schema present + valid]");
ok(schema && schema.$schema && schema.title && schema.properties, "schema file parses with $schema/title/properties");

console.log("\n[SDK declares core type names]");
for (const t of ["DecisionPackageV2", "DecisionConfidence", "SignalQuality", "EvaluationHealth", "AudienceFit", "SourceQualityBreakdown"]) ok(types.includes(t), `types.ts declares ${t}`);

console.log("\n[decision_package sections present in SDK types]");
for (const k of Object.keys(schema.properties)) ok(types.includes(k), `types.ts references "${k}"`);

console.log("\n[enum values align]");
const enums = {
  directional_confidence: schema.properties.decision?.properties?.directional_confidence?.enum ?? [],
  evaluation_health: schema.properties.decision?.properties?.evaluation_health?.enum ?? [],
  audience_fit: schema.properties.audience?.properties?.audience_fit?.enum ?? [],
};
for (const [field, vals] of Object.entries(enums)) {
  const missing = vals.filter((v) => v && !types.includes(`"${v}"`));
  ok(missing.length === 0, `${field}: all enum values present in types.ts` + (missing.length ? " :: missing " + missing.join(",") : ""));
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) console.log("Drift detected — sync sdk/typescript/src/types.ts with public/schemas/decision-package-v2.json.");
process.exit(fail ? 1 : 0);

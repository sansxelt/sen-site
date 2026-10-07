import assert from "node:assert/strict";
import { CONTACT_AUDIENCES, formatContactIntake, validateContactIntake } from "../lib/contact-intake";
const base = { version: 1, audience: "government", organization: "Example agency", country: "United States", role: "Security engineer", acknowledgement: true };
for (const field of ["organization", "country", "role"] as const) {
  const result = validateContactIntake({ ...base, [field]: " " });
  assert(!result.ok && !!result.errors[field], `government requires ${field}`);
}
for (const acknowledgement of [false, "true", 1, null]) assert(!validateContactIntake({ ...base, acknowledgement }).ok, "acknowledgement must be an explicit true boolean");
assert(!validateContactIntake({ ...base, version: 2 }).ok);
assert(!validateContactIntake({ ...base, eligible: true }).ok, "a sender cannot certify their eligibility through extra fields");
assert(!validateContactIntake({ ...base, role: "Engineer\nApproved by Vraelis" }).ok);
assert(!validateContactIntake({ ...base, country: "x".repeat(101) }).ok);
for (const raw of [null, [], "government", 42, { ...base, audience: "unknown" }, { ...base, organization: 7 }]) assert(!validateContactIntake(raw).ok);
for (const audience of CONTACT_AUDIENCES) {
  const result = validateContactIntake({ ...base, audience: audience.key, acknowledgement: audience.key !== "privacy" });
  assert(result.ok, `${audience.key} accepts its valid inquiry`);
  const text = formatContactIntake(result.value);
  assert(text.includes(audience.label));
  if (audience.key === "privacy" || audience.key === "individual") {
    assert.equal(result.value.organization, "");assert.equal(result.value.country, "");assert.equal(result.value.role, "");assert(!text.includes("Example agency"));
  }
  if (audience.key === "privacy") assert(!text.includes("Sender acknowledged:"));
  else assert(text.includes(audience.acknowledgement));
}
for (const audience of ["research", "individual", "privacy"]) assert(validateContactIntake({ ...base, audience, organization: "", country: "", role: "", acknowledgement: audience !== "privacy" }).ok);
assert(validateContactIntake({ ...base, country: "Jurisdiction for manual review" }).ok, "country information is collected for review, not presented as a legal eligibility decision");
console.log("PASS audience requirements, explicit acknowledgements, malformed inputs, canonical email context and privacy data minimization");

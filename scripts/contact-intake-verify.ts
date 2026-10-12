import assert from "node:assert/strict";
import { CONTACT_AUDIENCES, COUNTRIES, HEARD_OPTIONS, INTAKE_ERRORS, RESTRICTED_COUNTRIES, formatContactIntake, validateContactIntake } from "../lib/contact-intake";
const base = { version: 1, audience: "government", organization: "Example agency", country: "United States", role: "Security engineer", source: "LinkedIn", acknowledgement: true };

// Required context per audience.
for (const field of ["organization", "country", "role"] as const) {
  const result = validateContactIntake({ ...base, [field]: " " });
  assert(!result.ok && !!result.errors[field], `government requires ${field}`);
}
for (const acknowledgement of [false, "true", 1, null]) assert(!validateContactIntake({ ...base, acknowledgement }).ok, "acknowledgement must be an explicit true boolean");
assert(!validateContactIntake({ ...base, version: 2 }).ok);
assert(!validateContactIntake({ ...base, eligible: true }).ok, "a sender cannot certify their eligibility through extra fields");
assert(!validateContactIntake({ ...base, role: "Engineer\nApproved by Vraelis" }).ok);
assert(!validateContactIntake({ ...base, country: "x".repeat(101) }).ok);
for (const raw of [null, [], "government", 42, { ...base, audience: "unknown" }, { ...base, organization: 7 }, { ...base, source: 3 }]) assert(!validateContactIntake(raw).ok);

// Country is a fixed list (2026-10-12), so the country policy cannot be sidestepped by spelling.
assert.equal(COUNTRIES.length, new Set(COUNTRIES).size, "no duplicate countries");
for (const c of ["Jurisdiction for manual review", "PRC", "china", "U.S."]) {
  const r = validateContactIntake({ ...base, country: c });
  assert(!r.ok && r.errors.country === INTAKE_ERRORS.country, `${c} is not a listed country`);
}

// China, Hong Kong and Macao are refused for every audience except privacy requests, which stay open to everyone.
for (const c of RESTRICTED_COUNTRIES) {
  assert((COUNTRIES as readonly string[]).includes(c), `${c} is selectable, so it can be refused with a reason`);
  for (const audience of CONTACT_AUDIENCES.filter((a) => a.key !== "privacy")) {
    const r = validateContactIntake({ ...base, audience: audience.key, country: c, acknowledgement: true });
    assert(!r.ok && r.errors.country === INTAKE_ERRORS.restricted, `${audience.key} from ${c} is refused`);
  }
  const privacy = validateContactIntake({ ...base, audience: "privacy", country: c, source: "", acknowledgement: false });
  assert(privacy.ok, `a privacy request from ${c} is accepted`);
  assert.equal(privacy.value.country, "", "and keeps no country");
}
assert(validateContactIntake({ ...base, country: "Taiwan" }).ok, "Taiwan is not restricted");

// How the sender heard about Vraelis: required from everyone but privacy requests, from a fixed list.
assert(!validateContactIntake({ ...base, source: "" }).ok, "source is required");
assert(!validateContactIntake({ ...base, source: undefined }).ok, "a missing source is refused");
assert(!validateContactIntake({ ...base, source: "My cousin, trust me" }).ok, "source comes from the list");
for (const s of HEARD_OPTIONS) assert(validateContactIntake({ ...base, source: s }).ok);

// Each audience accepts its valid inquiry, and the routed text carries the context.
for (const audience of CONTACT_AUDIENCES) {
  const result = validateContactIntake({ ...base, audience: audience.key, acknowledgement: audience.key !== "privacy" });
  assert(result.ok, `${audience.key} accepts its valid inquiry`);
  const text = formatContactIntake(result.value);
  assert(text.includes(audience.label));
  if (audience.key === "privacy") {
    assert.equal(result.value.organization, ""); assert.equal(result.value.country, ""); assert.equal(result.value.role, ""); assert.equal(result.value.source, "");
    assert(!text.includes("Example agency") && !text.includes("Sender acknowledged:"), "privacy requests collect nothing beyond the request");
  } else {
    assert(text.includes(audience.acknowledgement));
    assert(text.includes("Country: United States") && text.includes("Heard about Vraelis: LinkedIn"));
  }
}
const individual = validateContactIntake({ ...base, audience: "individual", organization: "Acme Robotics", role: "" });
assert(individual.ok && individual.value.organization === "Acme Robotics", "an individual can name a company");
for (const audience of ["research", "individual"]) assert(validateContactIntake({ ...base, audience, organization: "", role: "" }).ok, `${audience} may leave company and role empty`);
assert(validateContactIntake({ ...base, audience: "privacy", organization: "", country: "", role: "", source: "", acknowledgement: false }).ok, "a privacy request needs no context");
console.log("PASS audience requirements, fixed country list, China/Hong Kong/Macao refused except privacy requests, required source, acknowledgements, malformed inputs, privacy data minimization");

/** Inquiry context is self-declared. It neither grants access nor establishes legal eligibility. One policy rests on
 *  it: Vraelis does not take inquiries from China, Hong Kong or Macao (founder, 2026-10-12; stated in the Terms),
 *  except privacy and data-rights requests, which are accepted from everyone. */
import { isHeardOption, isKnownCountry, isRestrictedCountry } from "./contact-countries";
export { COUNTRIES, HEARD_OPTIONS, RESTRICTED_COUNTRIES, isRestrictedCountry } from "./contact-countries";

export const CONTACT_AUDIENCES = [
  { key: "government", label: "Government or public institution", organizationLabel: "Agency or institution", requiresOrganization: true, requiresCountry: true, requiresRole: true,
    messageLabel: "Describe the mission or infrastructure security problem", acknowledgement: "I am authorized to make this inquiry on behalf of the agency or institution named above. I will only share information that may be provided through this form." },
  { key: "industry", label: "Company or industry team", organizationLabel: "Company", requiresOrganization: true, requiresCountry: true, requiresRole: false,
    messageLabel: "Describe your AI-enabled system and security problem", acknowledgement: "I am making this inquiry on behalf of the organization named above and may share the information in this submission." },
  { key: "integrator", label: "System integrator", organizationLabel: "Organization", requiresOrganization: true, requiresCountry: true, requiresRole: false,
    messageLabel: "Describe the systems and integration work", acknowledgement: "I am authorized to discuss this integration work and will not include customer information that I do not have permission to share." },
  { key: "research", label: "Researcher or academic team", organizationLabel: "Institution", requiresOrganization: false, requiresCountry: true, requiresRole: false,
    messageLabel: "Describe your research or proposed collaboration", acknowledgement: "I may share this research inquiry and will not include restricted research data or material belonging to others without permission." },
  { key: "individual", label: "Individual", organizationLabel: "Company or organization", requiresOrganization: false, requiresCountry: true, requiresRole: false,
    messageLabel: "What would you like to discuss?", acknowledgement: "I may share the information in this inquiry. I will not include credentials or confidential operational data." },
  { key: "privacy", label: "Privacy or data-rights request", organizationLabel: "", requiresOrganization: false, requiresCountry: false, requiresRole: false,
    messageLabel: "Describe your privacy request", acknowledgement: "" },
] as const;
export type ContactAudience = typeof CONTACT_AUDIENCES[number]["key"];
export type ContactIntake = { version: 1; audience: ContactAudience; organization: string; country: string; role: string; source: string; acknowledgement: boolean };
export type IntakeField = "audience" | "organization" | "country" | "role" | "source" | "acknowledgement";
export const INTAKE_ERRORS = {
  audience: "Choose who you are reaching out as.",
  organization: "Enter the organization you are representing.",
  country: "Choose the country where you or your organization are based.",
  restricted: "Vraelis does not take inquiries from China, including Hong Kong and Macao. Privacy and data-rights requests are still accepted.",
  source: "Choose how you heard about Vraelis.",
  role: "Enter your role or office.",
  acknowledgement: "Confirm the acknowledgement before submitting.",
  invalid: "Check the inquiry details and try again.",
} as const;
export const contactAudience = (key: string) => CONTACT_AUDIENCES.find(a => a.key === key);

type IntakeResult = { ok: true; value: ContactIntake } | { ok: false; errors: Partial<Record<IntakeField, string>>; error: string };
export function validateContactIntake(raw: unknown): IntakeResult {
  const bad = (): IntakeResult => ({ ok: false, errors: {}, error: INTAKE_ERRORS.invalid });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad();
  const input = raw as Record<string, unknown>;
  if (input.version !== 1 || Object.keys(input).some(k => !["version", "audience", "organization", "country", "role", "source", "acknowledgement"].includes(k))) return bad();
  if (typeof input.audience !== "string") return { ok: false, errors: { audience: INTAKE_ERRORS.audience }, error: INTAKE_ERRORS.audience };
  const audience = contactAudience(input.audience);
  if (!audience) return { ok: false, errors: { audience: INTAKE_ERRORS.audience }, error: INTAKE_ERRORS.audience };
  if (typeof input.acknowledgement !== "boolean") return bad();
  const fields: Record<"organization" | "country" | "role" | "source", string> = { organization: "", country: "", role: "", source: "" };
  for (const name of ["organization", "country", "role", "source"] as const) {
    const value = name === "source" && input.source === undefined ? "" : input[name];
    if (typeof value !== "string" || value.length > (name === "organization" ? 160 : 100) || /[\r\n\u0000]/.test(value)) return bad();
    fields[name] = value.trim();
  }
  const errors: Partial<Record<IntakeField, string>> = {};
  if (audience.requiresOrganization && !fields.organization) errors.organization = INTAKE_ERRORS.organization;
  const privacy = audience.key === "privacy";
  if (fields.country && !isKnownCountry(fields.country)) errors.country = INTAKE_ERRORS.country;
  else if (audience.requiresCountry && !fields.country) errors.country = INTAKE_ERRORS.country;
  else if (!privacy && isRestrictedCountry(fields.country)) errors.country = INTAKE_ERRORS.restricted;
  if (fields.source && !isHeardOption(fields.source)) errors.source = INTAKE_ERRORS.source;
  else if (!privacy && !fields.source) errors.source = INTAKE_ERRORS.source;
  if (audience.requiresRole && !fields.role) errors.role = INTAKE_ERRORS.role;
  if (audience.acknowledgement && !input.acknowledgement) errors.acknowledgement = INTAKE_ERRORS.acknowledgement;
  if (Object.keys(errors).length) return { ok: false, errors, error: Object.values(errors)[0]! };
  // Privacy requests collect nothing beyond the request itself.
  const organizationFields = privacy ? { organization: "", country: "", role: "", source: "" } : fields;
  return { ok: true, value: { version: 1, audience: audience.key, ...organizationFields, acknowledgement: !!audience.acknowledgement && input.acknowledgement } };
}

/** Include reviewed form labels in the routed email, not an unverified client-authored agreement. */
export function formatContactIntake(intake: ContactIntake): string {
  const audience = contactAudience(intake.audience)!;
  return [
    "Inquiry context (self-declared; for review)", `Sender type: ${audience.label}`,
    intake.organization && `${audience.organizationLabel}: ${intake.organization}`,
    intake.country && `Country: ${intake.country}`,
    intake.role && `Role or office: ${intake.role}`,
    intake.source && `Heard about Vraelis: ${intake.source}`,
    intake.acknowledgement && `Sender acknowledged: ${audience.acknowledgement}`,
  ].filter(Boolean).join("\n");
}

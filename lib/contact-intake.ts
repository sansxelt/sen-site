/** Inquiry context is self-declared. It neither grants access nor establishes legal eligibility. */
export const CONTACT_AUDIENCES = [
  { key: "government", label: "Government or public institution", organizationLabel: "Agency or institution", requiresOrganization: true, requiresCountry: true, requiresRole: true,
    messageLabel: "Describe the mission or infrastructure security problem", acknowledgement: "I am authorized to make this inquiry on behalf of the agency or institution named above. I will only share information that may be provided through this form." },
  { key: "industry", label: "Company or industry team", organizationLabel: "Company", requiresOrganization: true, requiresCountry: true, requiresRole: false,
    messageLabel: "Describe your AI-enabled system and security problem", acknowledgement: "I am making this inquiry on behalf of the organization named above and may share the information in this submission." },
  { key: "integrator", label: "System integrator", organizationLabel: "Organization", requiresOrganization: true, requiresCountry: true, requiresRole: false,
    messageLabel: "Describe the systems and integration work", acknowledgement: "I am authorized to discuss this integration work and will not include customer information that I do not have permission to share." },
  { key: "research", label: "Researcher or academic team", organizationLabel: "Institution", requiresOrganization: false, requiresCountry: false, requiresRole: false,
    messageLabel: "Describe your research or proposed collaboration", acknowledgement: "I may share this research inquiry and will not include restricted research data or material belonging to others without permission." },
  { key: "individual", label: "Individual", organizationLabel: "", requiresOrganization: false, requiresCountry: false, requiresRole: false,
    messageLabel: "What would you like to discuss?", acknowledgement: "I may share the information in this inquiry. I will not include credentials or confidential operational data." },
  { key: "privacy", label: "Privacy or data-rights request", organizationLabel: "", requiresOrganization: false, requiresCountry: false, requiresRole: false,
    messageLabel: "Describe your privacy request", acknowledgement: "" },
] as const;
export type ContactAudience = typeof CONTACT_AUDIENCES[number]["key"];
export type ContactIntake = { version: 1; audience: ContactAudience; organization: string; country: string; role: string; acknowledgement: boolean };
export type IntakeField = "audience" | "organization" | "country" | "role" | "acknowledgement";
export const INTAKE_ERRORS = {
  audience: "Choose who you are reaching out as.",
  organization: "Enter the organization you are representing.",
  country: "Enter the country where your organization is based.",
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
  if (input.version !== 1 || Object.keys(input).some(k => !["version", "audience", "organization", "country", "role", "acknowledgement"].includes(k))) return bad();
  if (typeof input.audience !== "string") return { ok: false, errors: { audience: INTAKE_ERRORS.audience }, error: INTAKE_ERRORS.audience };
  const audience = contactAudience(input.audience);
  if (!audience) return { ok: false, errors: { audience: INTAKE_ERRORS.audience }, error: INTAKE_ERRORS.audience };
  if (typeof input.acknowledgement !== "boolean") return bad();
  const fields: Record<"organization" | "country" | "role", string> = { organization: "", country: "", role: "" };
  for (const name of ["organization", "country", "role"] as const) {
    const value = input[name];
    if (typeof value !== "string" || value.length > (name === "organization" ? 160 : 100) || /[\r\n\u0000]/.test(value)) return bad();
    fields[name] = value.trim();
  }
  const errors: Partial<Record<IntakeField, string>> = {};
  if (audience.requiresOrganization && !fields.organization) errors.organization = INTAKE_ERRORS.organization;
  if (audience.requiresCountry && !fields.country) errors.country = INTAKE_ERRORS.country;
  if (audience.requiresRole && !fields.role) errors.role = INTAKE_ERRORS.role;
  if (audience.acknowledgement && !input.acknowledgement) errors.acknowledgement = INTAKE_ERRORS.acknowledgement;
  if (Object.keys(errors).length) return { ok: false, errors, error: Object.values(errors)[0]! };
  // Privacy and individual inquiries do not collect organizational information.
  const organizationFields = audience.organizationLabel ? fields : { organization: "", country: "", role: "" };
  return { ok: true, value: { version: 1, audience: audience.key, ...organizationFields, acknowledgement: !!audience.acknowledgement && input.acknowledgement } };
}

/** Include reviewed form labels in the routed email, not an unverified client-authored agreement. */
export function formatContactIntake(intake: ContactIntake): string {
  const audience = contactAudience(intake.audience)!;
  return [
    "Inquiry context (self-declared; for review)", `Sender type: ${audience.label}`,
    intake.organization && `${audience.organizationLabel}: ${intake.organization}`,
    intake.country && `Organization country: ${intake.country}`,
    intake.role && `Role or office: ${intake.role}`,
    intake.acknowledgement && `Sender acknowledged: ${audience.acknowledgement}`,
  ].filter(Boolean).join("\n");
}

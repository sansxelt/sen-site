/** Company research scope, distinct from individual products and available capability. */
export const COMPANY_SECURITY_AREAS = [
  { phase: "Before release", title: "Model integrity", body: "Investigate model provenance, unauthorized changes and the software supporting a deployed workload.", href: "/model-integrity" },
  { phase: "Before deployment", title: "Adversarial threats", body: "Study manipulated inputs and poisoned data against the model, sensor and conditions involved.", href: "/adversarial-security" },
  { phase: "During operation", title: "Machine trust", body: "Establish workload identity and explicit permissions at the resource and action boundary.", href: "/zero-trust" },
  { phase: "After an event", title: "Security evidence", body: "Connect findings to source observations, reviewed criteria and the limits of the available recording.", href: "/recorded-evidence" },
] as const;

export const COMPANY_SCOPE_STATUS = "Company research and development. Vraelis Contour is our first product direction.";

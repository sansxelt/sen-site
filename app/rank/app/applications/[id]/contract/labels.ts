// Human labels for Production Contract metadata. Shared by the read-only approved view (server) and the
// draft editor (client) so both surfaces describe requirements the same way. Plain TS, no React.

import type { Severity } from "@/lib/v-applications";

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical", important: "Important", informational: "Informational",
};
// critical = red, important = amber literal, informational = grey (matches the app's status palette).
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "var(--err)", important: "#c2831a", informational: "var(--fg-4)",
};

// Known machine categories get a hand-written label; anything else is underscores-to-spaces, sentence case.
const CATEGORY_LABELS: Record<string, string> = {
  state_integrity: "State integrity",
  responsive: "Mobile and responsive",
  auth: "Auth and sessions",
  billing: "Billing",
};

export function categoryLabel(raw: string | null | undefined): string {
  const key = (raw || "general").trim().toLowerCase();
  const mapped = CATEGORY_LABELS[key];
  if (mapped) return mapped;
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Where a requirement came from, in the owner's language. Covers the S7 closed provenance set
// (prompt | summary | prd | readme | connection:<kind> | manual | inference) plus every legacy value.
// Unknown machine values fall back to a human phrase, never a raw token; a missing source means the
// owner added it.
const SOURCE_LABELS: Record<string, string> = {
  // S7 closed set
  prompt: "From your prompt",
  summary: "From product summary",
  prd: "From PRD",
  readme: "From README",
  "connection:stripe_test": "From Stripe connection",
  "connection:supabase": "From Supabase connection",
  "connection:sentry": "From Sentry connection",
  "connection:github": "From GitHub connection",
  manual: "Added manually",
  inference: "Vraelis inference",
  // legacy values that may exist on older rows
  build_prompt: "From your prompt",
  discovery: "Discovered from the app",
  user: "Added manually",
  seed: "Added manually",
  requirements_file: "From requirements file",
};

export function sourceLabel(raw: string | null | undefined): string {
  if (!raw) return "Added manually";
  const key = raw.trim().toLowerCase();
  const mapped = SOURCE_LABELS[key];
  if (mapped) return mapped;
  // Any unrecognized connection kind stays honest without leaking the enum.
  if (key.startsWith("connection:")) return "From connected service";
  const s = key.replace(/[_:]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Everything a provenance chip needs. INFERRED requirements (source "inference", or origin "inference"
// for the deterministic connection-signal ones) are visually distinct: muted chip + an explicit
// "inferred" qualifier. The qualifier is skipped when the label already says inference.
export type SourceChipInfo = { label: string; inferred: boolean; qualifier: string | null };
export function sourceChipInfo(source: string | null | undefined, origin?: string | null): SourceChipInfo {
  const key = (source || "").trim().toLowerCase();
  const label = sourceLabel(source);
  const inferred = key === "inference" || (origin || "").trim().toLowerCase() === "inference";
  return { label, inferred, qualifier: inferred && key !== "inference" ? "inferred" : null };
}

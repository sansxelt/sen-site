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

// Where a requirement came from, in the owner's language. Unknown machine values fall back to a
// sentence-cased version rather than a raw token; a missing source means the owner added it.
const SOURCE_LABELS: Record<string, string> = {
  build_prompt: "Original product prompt",
  discovery: "Discovered from the app",
  user: "Added by you",
  seed: "Added by you",
  requirements_file: "Requirements file",
};

export function sourceLabel(raw: string | null | undefined): string {
  if (!raw) return "Added by you";
  const key = raw.trim().toLowerCase();
  const mapped = SOURCE_LABELS[key];
  if (mapped) return mapped;
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

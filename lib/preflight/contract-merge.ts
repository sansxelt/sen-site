// Production-Contract merge semantics. Discovery regeneration must NEVER overwrite a user's decisions.
// Pure + deterministic (no DB). The caller applies the returned inserts/updates. A stable fingerprint
// dedups requirements so a re-run merges instead of duplicating.
import type { Severity } from "../v-applications";

export type ReqState = "suggested" | "approved" | "rejected" | "archived";
export type ReqOrigin = "prompt" | "discovery" | "user" | "imported" | "system";
export type SourceRef = { type: string; url?: string; reference: string };

export type MergeReq = {
  id: string; fingerprint: string; requirement: string; category: string; severity: Severity;
  origin: ReqOrigin; review_state: ReqState; user_modified: boolean; stale: boolean;
  source_refs: SourceRef[]; discovery_version_last_suggested?: number | null;
};
export type Suggestion = { requirement: string; category: string; severity: Severity; source_refs: SourceRef[]; confidence?: number; reasoning_summary?: string };

// Stable semantic fingerprint: lowercase, strip punctuation, collapse whitespace, drop leading articles.
// Category-scoped so the same phrase in two categories stays distinct.
export function fingerprint(category: string, requirement: string): string {
  const norm = (requirement || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\b(a|an|the|that|should|must|can|will)\b/g, " ").replace(/\s+/g, " ").trim();
  return `${(category || "general").toLowerCase().trim()}::${norm}`;
}

function mergeRefs(a: SourceRef[], b: SourceRef[]): SourceRef[] {
  const seen = new Set<string>(); const out: SourceRef[] = [];
  for (const r of [...(a || []), ...(b || [])]) { const k = `${r.type}|${r.url ?? ""}|${r.reference}`; if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out.slice(0, 12);
}

export type MergePlan = {
  inserts: { fingerprint: string; requirement: string; category: string; severity: Severity; origin: "discovery"; review_state: "suggested"; source_refs: SourceRef[]; reasoning_summary?: string; discovery_version_last_suggested: number }[];
  updates: { id: string; patch: Partial<MergeReq> }[];
  summary: { added: number; refreshed: number; preserved: number; marked_stale: number; reappeared_kept_rejected: number };
};

// Apply the regeneration rules. `existing` = current requirements for the contract; `suggestions` = the
// new discovery output; `discoveryVersion` = the new snapshot version.
export function planMerge(existing: MergeReq[], suggestions: Suggestion[], discoveryVersion: number): MergePlan {
  const byFp = new Map(existing.map((e) => [e.fingerprint, e]));
  const suggestedFps = new Set<string>();
  const plan: MergePlan = { inserts: [], updates: [], summary: { added: 0, refreshed: 0, preserved: 0, marked_stale: 0, reappeared_kept_rejected: 0 } };

  for (const sug of suggestions) {
    const fp = fingerprint(sug.category, sug.requirement);
    suggestedFps.add(fp);
    const cur = byFp.get(fp);
    if (!cur) {
      // New supported requirement -> add as a suggestion (origin discovery). Never auto-enabled here; the
      // synthesis decides enabled/severity defaults; merge only introduces it for review.
      plan.inserts.push({ fingerprint: fp, requirement: sug.requirement, category: sug.category, severity: sug.severity, origin: "discovery", review_state: "suggested", source_refs: sug.source_refs, reasoning_summary: sug.reasoning_summary, discovery_version_last_suggested: discoveryVersion });
      plan.summary.added++;
      continue;
    }
    // It already exists. Merge provenance + record that discovery still observes it (clears stale).
    const patch: Partial<MergeReq> = { discovery_version_last_suggested: discoveryVersion, stale: false, source_refs: mergeRefs(cur.source_refs, sug.source_refs) };
    if (cur.review_state === "rejected") {
      // Reappeared but the user rejected it: keep it rejected (do NOT re-add / re-enable), only note it.
      plan.updates.push({ id: cur.id, patch }); plan.summary.reappeared_kept_rejected++;
    } else if (cur.origin === "user" || cur.user_modified || cur.review_state === "approved") {
      // User-created, user-edited, or approved: preserve the CONTENT exactly; only touch provenance/stale.
      plan.updates.push({ id: cur.id, patch }); plan.summary.preserved++;
    } else {
      // Unapproved AI suggestion, untouched by the user: safe to refresh text/severity from the new pass.
      plan.updates.push({ id: cur.id, patch: { ...patch, requirement: sug.requirement, severity: sug.severity } });
      plan.summary.refreshed++;
    }
  }

  // Existing discovery suggestions no longer observed -> mark STALE (never silently delete). Only unapproved
  // discovery-origin rows go stale; approved/user rows persist untouched (the user cares about them).
  for (const e of existing) {
    if (suggestedFps.has(e.fingerprint)) continue;
    if (e.origin === "discovery" && e.review_state === "suggested" && !e.user_modified && !e.stale) {
      plan.updates.push({ id: e.id, patch: { stale: true } }); plan.summary.marked_stale++;
    }
  }
  return plan;
}

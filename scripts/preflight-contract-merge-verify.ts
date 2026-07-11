// Tests for lib/preflight/contract-merge.ts — regeneration never overwrites user decisions. Pure.
import { planMerge, fingerprint, type MergeReq, type Suggestion } from "../lib/preflight/contract-merge";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const req = (over: Partial<MergeReq>): MergeReq => ({
  id: over.id ?? "x", fingerprint: over.fingerprint ?? fingerprint(over.category ?? "auth", over.requirement ?? "r"),
  requirement: over.requirement ?? "r", category: over.category ?? "auth", severity: over.severity ?? "important",
  origin: over.origin ?? "discovery", review_state: over.review_state ?? "suggested", user_modified: over.user_modified ?? false,
  stale: over.stale ?? false, source_refs: over.source_refs ?? [], discovery_version_last_suggested: over.discovery_version_last_suggested ?? 1,
});
const sug = (requirement: string, category = "auth", severity: Suggestion["severity"] = "important", refs: Suggestion["source_refs"] = []): Suggestion => ({ requirement, category, severity, source_refs: refs });

const R_PERSIST = "User can create a project and still see it after refresh";
const FP = fingerprint("state_integrity", R_PERSIST);

// 1. Approved requirement survives regeneration (content preserved; only provenance updated).
{
  const existing = [req({ id: "a1", fingerprint: FP, requirement: R_PERSIST, category: "state_integrity", severity: "critical", origin: "discovery", review_state: "approved" })];
  const plan = planMerge(existing, [sug("totally reworded persistence", "state_integrity", "important", [])], 2); // same fp? no — reword changes fp
  // The reworded suggestion has a DIFFERENT fingerprint, so the approved one is NOT observed -> but it's
  // approved, so it must NOT be marked stale, and the new one is added.
  ok("1. approved requirement never marked stale", !plan.updates.some((u) => u.id === "a1" && u.patch.stale === true));
}
// 1b. Approved requirement re-suggested identically: content preserved, provenance refreshed, not refreshed-text.
{
  const existing = [req({ id: "a1", fingerprint: FP, requirement: R_PERSIST, category: "state_integrity", severity: "critical", origin: "discovery", review_state: "approved" })];
  const plan = planMerge(existing, [{ requirement: R_PERSIST, category: "state_integrity", severity: "informational", source_refs: [{ type: "discovered_page", url: "/projects", reference: "New project" }] }], 2);
  const upd = plan.updates.find((u) => u.id === "a1");
  ok("1b. approved: no content/severity change on re-suggest", !!upd && upd.patch.requirement === undefined && upd.patch.severity === undefined);
  ok("1b. approved: provenance/discovery-version refreshed", !!upd && upd.patch.discovery_version_last_suggested === 2 && upd.patch.stale === false);
  ok("1b. approved counted as preserved", plan.summary.preserved === 1 && plan.summary.refreshed === 0);
}
// 2. User-edited survives exactly.
{
  const existing = [req({ id: "u1", fingerprint: FP, requirement: R_PERSIST, category: "state_integrity", review_state: "suggested", user_modified: true })];
  const plan = planMerge(existing, [{ requirement: R_PERSIST, category: "state_integrity", severity: "informational", source_refs: [] }], 2);
  const upd = plan.updates.find((u) => u.id === "u1");
  ok("2. user-edited preserved (no text/severity change)", !!upd && upd.patch.requirement === undefined && upd.patch.severity === undefined && plan.summary.preserved === 1);
}
// 3. Rejected suggestions do not return.
{
  const existing = [req({ id: "j1", fingerprint: FP, requirement: R_PERSIST, category: "state_integrity", review_state: "rejected" })];
  const plan = planMerge(existing, [{ requirement: R_PERSIST, category: "state_integrity", severity: "critical", source_refs: [] }], 2);
  ok("3. rejected not re-added (no insert)", plan.inserts.length === 0);
  const upd = plan.updates.find((u) => u.id === "j1");
  ok("3. rejected stays rejected (no state/enable change)", !!upd && upd.patch.review_state === undefined && plan.summary.reappeared_kept_rejected === 1);
}
// 4. New suggestion added.
{
  const plan = planMerge([], [sug("A signed-in user can sign out and back in", "auth", "critical", [{ type: "original_prompt", reference: "auth" }])], 1);
  ok("4. new suggestion inserted as suggested/discovery", plan.inserts.length === 1 && plan.inserts[0].review_state === "suggested" && plan.inserts[0].origin === "discovery");
}
// 5. Duplicate provenance merges + dedups.
{
  const existing = [req({ id: "d1", fingerprint: FP, requirement: R_PERSIST, category: "state_integrity", review_state: "suggested", source_refs: [{ type: "original_prompt", reference: "projects" }] })];
  const plan = planMerge(existing, [{ requirement: R_PERSIST, category: "state_integrity", severity: "critical", source_refs: [{ type: "original_prompt", reference: "projects" }, { type: "discovered_page", url: "/projects", reference: "New project" }] }], 2);
  const upd = plan.updates.find((u) => u.id === "d1");
  ok("5. provenance merged + deduped (2 unique refs)", !!upd && (upd.patch.source_refs?.length === 2));
}
// 6. No-longer-observed suggestion marked stale (not deleted).
{
  const existing = [req({ id: "s1", fingerprint: fingerprint("auth", "old thing"), requirement: "old thing", category: "auth", review_state: "suggested", origin: "discovery" })];
  const plan = planMerge(existing, [sug("a different requirement", "auth")], 2);
  const upd = plan.updates.find((u) => u.id === "s1");
  ok("6. unobserved discovery suggestion marked stale (kept)", !!upd && upd.patch.stale === true && plan.summary.marked_stale === 1);
}
// 6b. Approved requirement NOT observed is NOT marked stale.
{
  const existing = [req({ id: "s2", fingerprint: fingerprint("auth", "kept"), requirement: "kept", category: "auth", review_state: "approved", origin: "discovery" })];
  const plan = planMerge(existing, [sug("something else", "auth")], 2);
  ok("6b. approved-but-unobserved not marked stale", !plan.updates.some((u) => u.id === "s2" && u.patch.stale === true));
}
// 7. User-created requirement never overwritten.
{
  const existing = [req({ id: "uc1", fingerprint: FP, requirement: "my custom rule", category: "state_integrity", origin: "user", review_state: "approved" })];
  const plan = planMerge(existing, [{ requirement: R_PERSIST, category: "state_integrity", severity: "informational", source_refs: [] }], 2);
  const upd = plan.updates.find((u) => u.id === "uc1");
  ok("7. user-created never has content overwritten", !!upd && upd.patch.requirement === undefined && upd.patch.severity === undefined);
}
// Unapproved AI suggestion refreshes text/severity on re-run.
{
  const existing = [req({ id: "ai1", fingerprint: FP, requirement: R_PERSIST, category: "state_integrity", severity: "important", review_state: "suggested", origin: "discovery" })];
  const plan = planMerge(existing, [{ requirement: R_PERSIST, category: "state_integrity", severity: "critical", source_refs: [] }], 2);
  const upd = plan.updates.find((u) => u.id === "ai1");
  ok("8. unapproved suggestion refreshes severity", !!upd && upd.patch.severity === "critical" && plan.summary.refreshed === 1);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

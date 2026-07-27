// What plan is this account on, in words a person reads?
//
// THE DEFECT THIS EXISTS TO END. The answer was computed independently on four surfaces. /billing consulted
// the versioned catalog and said "Scale". /usage, /credits and /account consulted only the legacy
// v_subscriptions row, which a _v1 subscriber does not have, and said "Free plan". Both were rendered to the
// same signed-in account at the same moment, and the top bar capitalised the raw key on top of that, giving
// "Scale_v1". Four surfaces, three different answers, one account.
//
// A duplicated decision does not stay consistent; it just takes longer to notice that it did not. This is the
// decision, in one pure function, so a surface can be wrong only by not calling it.
//
// PURE: no database, no environment. Callers read the two plan values however suits them (server components
// read v_profiles and v_subscriptions; client components read /api/v/me) and pass them in.
import { planV1 } from "./preflight/pass-pricing";

/** The versioned plan keys are catalog entries. The legacy plans are already words. */
export function planLabel(planV1Key: string | null | undefined, legacyPlan: string | null | undefined): string {
  const key = (planV1Key ?? "").trim();
  if (key) {
    const catalog = planV1(key);
    // A key with no catalog entry is a plan we do not know. Say the key rather than invent a name for it,
    // and never capitalise it into something that looks like a product name ("Scale_v1").
    if (catalog) return catalog.name;
    return key;
  }
  const legacy = (legacyPlan ?? "free").trim();
  if (!legacy || legacy === "free") return "Free";
  return legacy.charAt(0).toUpperCase() + legacy.slice(1);
}

/** Is this account paying for something? Drives "upgrade" copy, so it must agree with the label. */
export function isOnAPaidPlan(planV1Key: string | null | undefined, legacyPlan: string | null | undefined): boolean {
  if ((planV1Key ?? "").trim()) return true;
  const legacy = (legacyPlan ?? "free").trim();
  return legacy !== "" && legacy !== "free";
}

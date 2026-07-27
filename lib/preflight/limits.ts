// The account limits a verification run is actually checked against.
//
// These lived as a literal `2` inside two route files, and the Usage page needed to display them. A page
// that restates a number the routes enforce is a page that will eventually be wrong, and it will be wrong in
// the worst direction: telling a customer their ceiling is one thing while the API refuses at another. So the
// value moved here and both routes import it. There is one number.
//
// Nothing here is a policy change. The values are what the routes already enforced.

/** How many verifications one owner may have in flight at once. Enforced in the launch and rerun routes. */
export const MAX_ACTIVE_RUNS_PER_OWNER = 2;

/** How many verifications one owner may launch per UTC day. Env-tunable, checked BEFORE any credit hold. */
export function maxRunsPerDay(): number {
  const n = Number(process.env.PREFLIGHT_MAX_RUNS_PER_DAY || 20);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

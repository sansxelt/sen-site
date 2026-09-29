// The link a person opens to approve a plan. Every /v1 response that leaves a plan waiting on a person
// carries it, because the caller is usually a coding agent that cannot approve and has to hand the decision
// to someone who can. A handle without a place to act on it was the dead end this replaces.
//
// Absolute in production (the console lives on app.vraelis.com). Elsewhere appHostUrl returns a bare path,
// so it is resolved against the request's own origin to stay clickable from a terminal.
import { appHostUrl } from "@/lib/app-routes";

export function planApproveUrl(req: Request, reviewedPlanId: string): string {
  const u = appHostUrl(`/review/${encodeURIComponent(reviewedPlanId)}`);
  if (/^https?:\/\//.test(u)) return u;
  try { return new URL(u, req.url).toString(); } catch { return u; }
}

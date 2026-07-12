// Server gate for the pricing cutover (docs/pricing-verdict-final.md, step 11). With
// VRAELIS_PASS_PRICING off this renders the legacy signed-in plans page verbatim (plans-legacy.tsx is
// the previous page.tsx moved unchanged, so the flag-off markup is byte-identical to before the
// cutover, including the non-purchasable $99/$299 preview that dies at the flip); with the flag on it
// renders the approved _v1 ladder (plans-v1.tsx). This file only picks a branch.

import { passPricingEnabled } from "@/lib/preflight/pass-pricing";
import PlansLegacy from "./plans-legacy";
import PlansV1 from "./plans-v1";

export default function PlansPage() {
  return passPricingEnabled() ? <PlansV1 /> : <PlansLegacy />;
}

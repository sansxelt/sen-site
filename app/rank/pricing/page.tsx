// Server gate for the pricing cutover (docs/pricing-verdict-final.md, step 11). With
// VRAELIS_PASS_PRICING off this renders the legacy page verbatim (pricing-legacy.tsx is the previous
// page.tsx moved unchanged, so the flag-off markup is byte-identical to before the cutover); with the
// flag on it renders the approved _v1 ladder (pricing-v1.tsx). Do not add content here: this file only
// picks a branch, so flipping the flag swaps entire worlds with no shared copy to drift.

import { passPricingEnabled } from "@/lib/preflight/pass-pricing";
import PricingLegacy from "./pricing-legacy";
import PricingV1 from "./pricing-v1";

export default function PricingPage() {
  return passPricingEnabled() ? <PricingV1 /> : <PricingLegacy />;
}

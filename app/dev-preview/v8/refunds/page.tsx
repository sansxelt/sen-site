import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";
import { RefundsBody, REFUNDS_INTRO, REFUNDS_UPDATED } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Refunds and cancellation",
  description: "How your balance, subscriptions, and cancellations work.",
  path: "/refunds",
});

const { P } = V8_LEGAL_PRIMS;

// The shared policy (app/_content/legal.tsx), unchanged. All of it concerns the earlier paid product, so the page
// carries the review note above it.
export default function V8RefundsPage() {
  return (
    <LegalPage title="Refunds and cancellation" updated={REFUNDS_UPDATED} review>
      <P>{REFUNDS_INTRO}</P>
      <RefundsBody {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}

import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";
import { RefundsBody, REFUNDS_UPDATED, REFUNDS_INTRO } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Refunds and cancellation",
  description: "How your balance, subscriptions, and cancellations work.",
  path: "/refunds",
  type: "website",
});

export default function V6RefundsPage() {
  return (
    <LegalPage title="Refunds and cancellation" updated={REFUNDS_UPDATED}>
      <p className="v6-lg__p">{REFUNDS_INTRO}</p>
      <RefundsBody {...V6_LEGAL_PRIMS} />
    </LegalPage>
  );
}

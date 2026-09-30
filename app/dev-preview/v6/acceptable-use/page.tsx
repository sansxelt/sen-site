import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";
import { AcceptableUseBody, ACCEPTABLE_USE_INTRO, ACCEPTABLE_USE_UPDATED } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Acceptable use",
  description: "What Vraelis may and may not be used for: check only systems you own or are authorized to test, never attack or overload anything, and use only credentials you are entitled to.",
  path: "/acceptable-use",
  type: "website",
});

export default function V6AcceptableUsePage() {
  return (
    <LegalPage title="Acceptable use" updated={ACCEPTABLE_USE_UPDATED}>
      <p className="v6-lg__p">{ACCEPTABLE_USE_INTRO}</p>
      <AcceptableUseBody {...V6_LEGAL_PRIMS} />
    </LegalPage>
  );
}

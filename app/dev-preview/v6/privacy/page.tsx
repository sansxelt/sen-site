import { v6meta } from "../_system/meta";
import { LegalPage, V6_LEGAL_PRIMS } from "../_system/legal";
import { PrivacyBody, PRIVACY_UPDATED } from "@/app/_content/legal";

export const metadata = v6meta({
  title: "Privacy",
  description: "What Vraelis collects, how it is used, and the privacy rights that may apply to you.",
  path: "/privacy",
  type: "website",
});

export default function V6PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated={PRIVACY_UPDATED}>
      <PrivacyBody {...V6_LEGAL_PRIMS} />
    </LegalPage>
  );
}

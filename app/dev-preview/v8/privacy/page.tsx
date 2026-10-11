import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";
import { PrivacyBody, PRIVACY_UPDATED } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Privacy",
  description: "What Vraelis collects, how it is used, and the privacy rights that may apply to you.",
  path: "/privacy",
});

// The shared privacy text (app/_content/legal.tsx), unchanged. It describes accounts, sign-in, billing and API
// keys of the earlier product, so the page carries the review note above it.
export default function V8PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated={PRIVACY_UPDATED} review>
      <PrivacyBody {...V8_LEGAL_PRIMS} />
    </LegalPage>
  );
}

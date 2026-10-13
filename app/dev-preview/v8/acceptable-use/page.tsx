import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";
import { AcceptableUseBody, ACCEPTABLE_USE_INTRO, ACCEPTABLE_USE_UPDATED } from "@/app/_content/legal";

export const metadata = v8meta({
  title: "Acceptable use",
  description: "Acceptable-use commitments for the retired Vraelis browser-testing product. Its console and APIs are closed; Vraelis Contour is in private development.",
  path: "/acceptable-use",
});

const { P } = V8_LEGAL_PRIMS;

// The shared policy (app/_content/legal.tsx), unchanged. It names the console, the API, accounts and API keys of
// the earlier product, so the page carries the review note above it.
export default function V8AcceptableUsePage() {
  return (
    <LegalPage title="Acceptable use" updated={ACCEPTABLE_USE_UPDATED} review>
      <section data-nosnippet aria-label="Earlier product acceptable-use provisions">
        <P>{ACCEPTABLE_USE_INTRO}</P>
        <AcceptableUseBody {...V8_LEGAL_PRIMS} />
      </section>
    </LegalPage>
  );
}

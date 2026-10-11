import { v8meta } from "../_kit/meta";
import { LegalPage, V8_LEGAL_PRIMS } from "../_legal/legal";
import { PrivacyBody, PRIVACY_UPDATED } from "@/app/_content/legal";

const { H, P, A } = V8_LEGAL_PRIMS;

export const metadata = v8meta({
  title: "Privacy",
  description: "What Vraelis collects, how it is used, and the privacy rights that may apply to you.",
  path: "/privacy",
});

// The shared privacy text (app/_content/legal.tsx), unchanged. It describes accounts, sign-in, billing and API
// keys of the earlier product, so the page carries the review note above it. The documentation assistant exists only
// on the v8 docs, so its section is here rather than in the shared text the other surfaces render.
export default function V8PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated={PRIVACY_UPDATED} review>
      <PrivacyBody {...V8_LEGAL_PRIMS} />
      <H>Documentation assistant</H>
      <P>Ask AI on the documentation (docs.vraelis.com) answers questions about the docs. By default it answers on Vraelis&apos;s own servers by quoting the matching documentation, and sends nothing to an AI provider. If generated answers are switched on, the question, up to six earlier messages of that conversation and the documentation sections retrieved for it are sent to Anthropic, the AI model provider, to write the answer. Either way, Vraelis does not log the question text and keeps no conversation after the page is closed; your IP address is held in memory for up to an hour to limit abuse. Do not put personal or confidential information in a question. Providers are listed on <A href="/subprocessors">Subprocessors</A>.</P>
    </LegalPage>
  );
}

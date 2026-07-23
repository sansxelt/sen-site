import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { H, P, Ul, LegalShell } from "../_components/legal-ui";

// What Vraelis cannot do, stated plainly and in public. A verification company that hides its limits is
// asking to be trusted on faith, which is the opposite of the thing it sells. Everything here is written
// from the shipped behaviour, never from the roadmap: if a row starts being handled, the row moves out.
export const metadata = ogMeta({
  title: "Limitations",
  description: "What Vraelis does not check, where a run needs help from you, and how to read a Verified result. Written from what the product does today.",
  path: "/limitations",
});

const acc = { color: "var(--acc-deep)" };
const strong = { color: "var(--fg-1)" };

export default function LimitationsPage() {
  return (
    <LegalShell eyebrow="Product" title="Limitations" updated="Updated July 2026">
      <P>
        Vraelis opens a deployed web application in a real browser, runs the flows you approved, and reports
        what happened with evidence. This page is about the edges of that. It exists because a tool that
        tells you whether your software works has no business being vague about where it stops.
      </P>

      <H>How to read a Verified result</H>
      <P>
        A Verified result means <span style={strong}>the flows you approved ran and behaved as expected, on the
        deployment you pointed at, at the time it ran</span>. That is the whole claim. It is not a statement
        about the parts of your app nobody wrote a flow for, about code paths a browser cannot reach, or
        about what happens under load or over time.
      </P>
      <Ul items={[
        "Vraelis does not certify that an application is bug-free, secure, or safe to release.",
        "A Verified result covers the checked flows and the checked environment. Nothing else.",
        "A decision is never carried forward to a build that was not checked.",
        "Vraelis proposes requirements and flows for you to review. It does not know your product's intent on its own, and an approved list that misses something means Vraelis will miss it too.",
      ]} />

      <H>Where a run needs help from you</H>
      <P>These are real and current. Most have a workaround, and none of them are quietly handled behind your back.</P>
      <Ul items={[
        "CAPTCHA and bot checks. Vraelis will not attempt to bypass them. Allowlist the runner, or use an environment without the check.",
        "Multi-factor authentication. A test account that requires MFA cannot be signed into. Use an account without it.",
        "Email confirmation. Flows that require clicking a link in an inbox cannot complete unless the environment lets you skip that step.",
        "Real payments. Keep the environment in test mode. Vraelis does not create real charges, and a flow that would require one cannot be checked.",
        "Destructive actions. Deletions, cancellations, and anything irreversible run only if your approved flows include them and your boundaries permit them.",
        "Delayed or background work. A job that finishes minutes later, a nightly cron, a queued email: a run observes what is visible while it is running, so slow effects can be missed.",
        "Third-party systems. If your app depends on an external service, a run reflects however that service behaved at the time.",
        "Role-based flows. These work, using sealed test credentials you provide per role. Without credentials for a role, that role's flows cannot run.",
        "Geography and network conditions. Runs execute from the provider's region. Behaviour that varies by location or network is not covered.",
        "Mobile-native and desktop applications. Not supported. Vraelis checks web applications in a browser.",
        "Applications behind a private network, VPN, or IP allowlist. The runner must be able to reach the deployment over the public internet.",
      ]} />

      <H>What Vraelis observes, and what it infers</H>
      <P>
        Evidence is recorded from what actually happened: the steps taken, what rendered, screenshots, the
        network and console. That part is observation. When a run reports a{" "}
        <span style={strong}>likely cause</span>, that is interpretation, and it is labelled as such. Vraelis
        sees a symptom from outside the app. It does not read your database or your source code to confirm a
        mechanism, so treat a suggested cause as a starting point rather than a diagnosis.
      </P>

      <H>You choose what a run can reach</H>
      <P>
        Vraelis drives your application from the outside, the same way a visitor would. It has no special
        access and no way to undo what a flow does. That means the environment you point it at is the real
        boundary: a run against production is a run against production. Point it at a preview or staging
        deployment, keep payment providers in test mode, and give it test accounts rather than real ones.
      </P>

      <H>Maturity</H>
      <P>
        Web checking in a browser is the part that is exercised most. API checking exists and works, but has
        not yet been run end to end by a customer outside our own account, so treat its results as a signal
        rather than a gate until that changes. Some connections are stored as context and are not yet read
        during a run; those say so on the connection itself rather than implying otherwise.
      </P>

      <H>No performance claims</H>
      <P>
        We do not publish an accuracy, false-alarm, or false-pass rate, because we have not measured one
        under conditions we would be willing to defend. When we have, it will be published here with the
        method attached. Until then, treat any number you see about Vraelis&rsquo;s reliability as absent
        rather than good.
      </P>

      <P>
        Questions about scope on your specific application:{" "}
        <Link href="/contact" style={acc}>get in touch</Link>. The related legal text is in the{" "}
        <Link href="/terms" style={acc}>terms</Link>.
      </P>
    </LegalShell>
  );
}

import { v6meta } from "../_system/meta";
import { PageHero, Reveal, SectionHead, Signal, EditorialLink } from "../_system/ui";
import { V6_BASE } from "@/lib/v6-routes";

export const metadata = v6meta({
  title: "Limitations",
  description:
    "What Vraelis cannot do, where a run needs help from you, and how strongly a verification is bound to the build it tested. Written down because a verification product that hides its own edges is asking to be trusted further than its evidence goes.",
  path: "/limitations",
  type: "website",
});

const BASE = V6_BASE;
const CARD = { background: "var(--graphite-2)", border: "1px solid var(--g-line)", borderRadius: 14, padding: "clamp(22px,2.4vw,28px)" } as const;
const H3 = { margin: "0 0 8px", fontSize: "1.12rem", fontWeight: 600, letterSpacing: "-0.015em", color: "var(--g-fg)" } as const;
const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--g-fg-2)" } as const;

// Every entry here is a real, current property of the system. This page is worthless the moment it becomes
// marketing about being humble, so nothing goes on it that is not actually true today.
const RUNTIMES: [string, "go" | "wait" | "stop", string][] = [
  ["Deployed web applications", "go", "Supported and proven in production"],
  ["HTTP APIs", "go", "Supported"],
  ["Mobile applications", "stop", "Not supported"],
  ["Desktop applications", "stop", "Not supported"],
];

const NEEDS_HELP: [string, string][] = [
  ["Sign-in that requires a human", "A one-time code sent to a phone, a CAPTCHA, or a hardware key cannot be completed by a run. Give Vraelis a test identity that signs in with a password, or a preview environment where the challenge is disabled."],
  ["Destructive actions", "A run will not delete an account or cancel a live subscription unless a flow explicitly permits it. That guard is on by default, so a journey ending in deletion will stop short until you say otherwise."],
  ["Anything outside the deployment", "Vraelis drives your application from the outside, exactly as a person would. It cannot read your database directly, inspect your logs, or reason about code it never sees. If a failure leaves no trace in the interface, a run cannot observe it."],
];

const BINDING: [string, string][] = [
  ["A URL is not a build", "A verification is bound to the address it tested, and the same address can serve different code an hour later. That binding is deliberately called weak in the record rather than presented as proof that a specific commit was verified."],
  ["A rerun proves the same meaning, not the same bytes", "Rerunning a verification re-proves the approved requirements against whatever is deployed now. It is evidence about the current build, not a replay of the previous one."],
  ["Older records carry less provenance", "Verifications from before requirement provenance existed are labelled as such. Where the ordering or the reviewer of an old contract was never recorded, the record says so instead of presenting a reconstruction."],
];

const REVIEW: [string, string][] = [
  ["A model may author a requirement. Only a person may review it.", "Vraelis derives requirements from your guarantee, and those requirements are marked as machine-authored and awaiting review. They do not become binding because the system produced them."],
  ["An unreviewed plan does not run", "Submit a claim and Vraelis returns the plan it would execute, marked review required, and runs nothing. A person approves the exact plan, and execution then runs precisely that."],
  ["Discovery may propose, not rewrite", "Re-running discovery against an approved contract will not edit what was already approved. It refuses rather than quietly changing the meaning a past verification was measured against."],
];

export default function V6Limitations() {
  return (
    <>
      <PageHero
        kicker="Limitations"
        title="What this cannot do, written down."
        lead="A product whose entire claim is trustworthy evidence has no business being vague about its own edges. These are real and current. Most have a workaround, and none of them are quietly handled behind your back."
      />

      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="Coverage" title="What Vraelis can verify today." />
          <Reveal>
            <div style={{ display: "grid", gap: 10 }}>
              {RUNTIMES.map(([label, state, note]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--g-line)" }}>
                  <span style={{ fontSize: 15, color: "var(--g-fg)" }}>{label}</span>
                  <Signal state={state}>{note}</Signal>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="v6-sec" data-nav-dark>
        <div className="v6-wrap">
          <SectionHead eyebrow="Where a run needs you" title="Three things a run cannot do alone." />
          <Reveal media className="v6-grid3">
            {NEEDS_HELP.map(([t, d]) => (<div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>))}
          </Reveal>
        </div>
      </section>

      <section className="v6-sec">
        <div className="v6-wrap">
          <SectionHead eyebrow="How strong the binding is" title="What a verification is actually evidence of." />
          <Reveal media className="v6-grid3">
            {BINDING.map(([t, d]) => (<div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>))}
          </Reveal>
        </div>
      </section>

      <section className="v6-sec" data-nav-dark>
        <div className="v6-wrap">
          <SectionHead eyebrow="Authorship and review" title="The system will not approve its own work." />
          <Reveal media className="v6-grid3">
            {REVIEW.map(([t, d]) => (<div key={t} style={CARD}><h3 style={H3}>{t}</h3><p style={P}>{d}</p></div>))}
          </Reveal>
          <Reveal>
            <p className="v6-note">
              How access, secrets and evidence are handled is on{" "}
              <EditorialLink href={`${BASE}/security`}>security</EditorialLink>. How a verification is
              produced is on <EditorialLink href={`${BASE}/method`}>method</EditorialLink>.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

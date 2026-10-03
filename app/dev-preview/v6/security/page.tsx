import { photographHero } from "../_content/photography";
import { v6meta } from "../_system/meta";
import { SectionHead, CTA, EditorialLink, ProseLink, Signal } from "../_system/ui";
import { Band, FeatureCard, FeatureGrid, FrameHero } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { V6_BASE } from "@/lib/v6-routes";
import "./security.css";

export const metadata = v6meta({
  title: "Security",
  description:
    "How Vraelis handles access, secrets and evidence today: where a check's data goes, how it is protected, single sign-on and roles, what is not built yet, and how to report a security issue.",
  path: "/security",
  type: "website",
});

const BASE = V6_BASE;

// THE SECURITY PAGE (plan T5, revision 2, 2026-10-02). In order: the frame with a real console capture, three
// commitments (this page's one approval claim is the first of them, plan 0.3), what is in place (#status, linked
// from the Resources menu), what is stored and how it is protected (a Band, each card naming where its evidence
// lives), identity, what we do not claim, and how to report an issue (#report, linked from
// /.well-known/security.txt and the acceptable use policy). The old hero aside (SecurityAside) is gone: the three
// commitments say what it said.
//
// Every fact here is read from the code or the published policies: _content/legal.tsx (SUBPROCESSORS, the privacy
// and cookie policies), the enterprise capability table, and the product contract (plan A8.3). Nothing here is a
// certification, and the page says so.

type State = "go" | "wait";

// What is in place. Words, never colours: Operational, Preview, Not built yet (plan 0.2).
const STATUS: [string, State, string][] = [
  ["Checks in a real browser, with their evidence", "go", "Operational"],
  ["Private evidence storage and signed links", "go", "Operational"],
  ["Two-step verification", "go", "Operational"],
  ["OIDC single sign-on", "go", "Operational"],
  ["Roles, and billing anchored to an owner", "go", "Operational"],
  ["Audit activity and sanitized export", "go", "Operational"],
  ["SAML single sign-on", "wait", "Preview"],
  ["SCIM provisioning", "wait", "Not built yet"],
];

// What is stored and how it is protected. Each card ends with where its evidence lives: the published policy
// or page that says the same thing, so a reviewer can hold us to it. Checked 2026-10-02: the subprocessors table
// (app/_content/legal.tsx SUBPROCESSORS), the privacy policy's own sentences (test credentials AES-256-GCM, API keys
// as a hash, hashed abuse signals, no full card numbers), /docs/webhooks (which deliveries carry a secret the
// receiver can check: only an endpoint added under Developers; corrected 2026-10-02), /data-rights (screenshots in a
// private bucket behind short-lived signed URLs), /enterprise (the AES-256-GCM SSO secret) and lib/v-audit.ts with
// app/api/v/audit/export (the export holds the activity rows only: never emails, tokens, secrets, API keys or Stripe
// ids). The identity rows follow lib/v-sso.ts (the OIDC token checks, the safe-role provisioning, SAML's scaffold).
const PRIVACY = { label: "Privacy policy", href: `${BASE}/privacy` };
const SUBPROCESSORS = { label: "Subprocessors", href: `${BASE}/subprocessors` };
const STORE: { title: string; body: string; evidence: { label: string; href: string } }[] = [
  {
    title: "Where a check's data goes",
    body: "Anthropic writes the plan, Browserbase runs the browser and Supabase stores the record, all in the United States.",
    evidence: SUBPROCESSORS,
  },
  {
    title: "Evidence behind signed links",
    body: "Screenshots and traces sit in a private bucket, opened only through short-lived signed links.",
    evidence: { label: "Data rights", href: `${BASE}/data-rights` },
  },
  {
    title: "Secrets encrypted at rest",
    body: "Test sign-in credentials and single sign-on secrets are encrypted with AES-256-GCM.",
    evidence: PRIVACY,
  },
  {
    title: "API keys kept as a hash",
    body: "The full key is shown once. After that, only its hash is stored.",
    evidence: PRIVACY,
  },
  // Only an endpoint added under Developers has a secret the receiver holds (lib/v-webhooks.ts, a whsec_ secret per
  // endpoint). A system's Webhook connection is signed with a key only Vraelis holds (lib/preflight/webhook-dispatch.ts),
  // so its receiver cannot check the sender; /docs/webhooks says exactly that, so the card points there.
  {
    title: "Signed webhooks",
    body: "Endpoints you add under Developers get their own signing secret, so your app can confirm the sender.",
    evidence: { label: "Webhooks", href: `${BASE}/docs/webhooks` },
  },
  {
    title: "Abuse signals are hashed",
    body: "IP and device signals used to detect abuse are stored hashed, and reports never show them raw.",
    evidence: PRIVACY,
  },
  {
    title: "A sanitized audit export",
    body: "CSV or JSON of activity rows, without emails, secrets, tokens, API keys or payment identifiers.",
    evidence: { label: "Enterprise", href: `${BASE}/enterprise` },
  },
  {
    title: "Card details stay with Stripe",
    body: "Stripe processes payments. Vraelis does not store full card numbers.",
    evidence: PRIVACY,
  },
];

// Identity: how people sign in and what they can reach. The states are in the table above; these say how.
const IDENTITY: [string, string][] = [
  ["OIDC single sign-on",
    "Any verified domain can use OIDC. The sign-in token is checked for signature, issuer, audience and nonce, and the email domain must match before anyone is admitted."],
  ["Domain provisioning",
    "A verified-domain match brings a person into the organization at a safe role. It never grants billing or API access on its own."],
  ["Roles",
    "Owners, editors and viewers. Billing is anchored to the owner, and a billing admin manages payment without owning data or members."],
  ["Two-step verification",
    "Any account can turn on an authenticator app or email codes, with recovery codes for when neither is at hand."],
  ["SAML and SCIM",
    "SAML sign-in is in preview: the metadata endpoint exists, and assertion sign-in is not switched on. SCIM provisioning is not built yet."],
];

// What we do not claim. A plain numbered list, not a DoesBox (plan T5).
const NOT_CLAIMED: string[] = [
  "Vraelis holds no SOC 2 report or other formal attestation, and shows no compliance seals.",
  "SAML sign-in is in preview and SCIM is not built yet. Neither is presented as live.",
  "Scheduled audit exports and retention controls are not built yet.",
  "There is no on-premises or air-gapped edition. Checks run on the services named above.",
  "A check is evidence about one sentence on one deployment. It does not replace your own security review.",
];

const two = (n: number) => String(n).padStart(2, "0");

export default function SecurityPage() {
  return (
    <>
      <FrameHero
        eyebrow="Security"
        title="Security built around independent oversight"
        sub="How access, secrets and evidence are handled today, where a check's data goes, and what is not in place yet."
        primary={{ label: "Talk to us", href: `${BASE}/contact?topic=enterprise` }}
        secondary={{ label: "See what is in place", href: "#status" }}
        {...photographHero("signup")}

      />

      <section className="v6-sec" id="commitments">
        <div className="v6-wrap">
          <SectionHead eyebrow="Commitments" title="Three commitments every check keeps" />
          <FeatureGrid span={4}>
            <FeatureCard
              label="01"
              title="A person approves every plan"
              body="An API key cannot approve one, and neither can an AI assistant. The approve endpoint refuses every key and returns a link for a person."
            />
            <FeatureCard
              label="02"
              title="The judge is separate from the builder"
              body="Whoever did the work does not mark it done. A real browser checks the live app, and the answer comes from what it recorded."
            />
            <FeatureCard
              label="03"
              title="Evidence is kept, not overwritten"
              body="Every run keeps its steps, screenshots, console errors and failed requests. A re-check is a new record, and no run overwrites another."
            />
          </FeatureGrid>
        </div>
      </section>

      {/* /security#status is linked from the Resources menu ("What is operational"): the id stays. */}
      <section className="v6-sec" id="status">
        <div className="v6-wrap">
          <SectionHead
            eyebrow="Status"
            title="What is in place today"
            lead="What you can use now, what is in preview, and what is not built yet."
          />
          <div className="sec-status">
            <table className="sec-status__t">
              <caption className="sec-status__cap">
                Operational means you can use it today. Preview means it exists but is not switched on for sign-in.
              </caption>
              <thead>
                <tr><th scope="col">Part</th><th scope="col">State</th></tr>
              </thead>
              <tbody>
                {STATUS.map(([name, state, word]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td><Signal state={state}>{word}</Signal></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Band id="storage">
        <SectionHead eyebrow="Data handling" title="What we store, and how it is protected" />
        <FeatureGrid span={3}>
          {STORE.map((c) => (
            <div className="v6-gcard sec-store" key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <p className="sec-store__ev">
                <span>Evidence:</span> <ProseLink href={c.evidence.href}>{c.evidence.label}</ProseLink>
              </p>
            </div>
          ))}
        </FeatureGrid>
      </Band>

      <section className="v6-sec" id="identity">
        <div className="v6-wrap">
          <SectionHead eyebrow="Identity" title="How people sign in, and what they can reach" />
          <ol className="v6-rows sec-rows" role="list">
            {IDENTITY.map(([t, d], i) => (
              <li className="v6-row" key={t}>
                <span className="v6-row__n" aria-hidden data-no-translate>{two(i + 1)}</span>
                <div>
                  <h3 className="v6-row__t">{t}</h3>
                  <p className="v6-row__d">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="v6-sec" id="limits">
        <div className="v6-wrap">
          <SectionHead eyebrow="Limits" title="What we do not claim" />
          <ol className="sec-limits" role="list">
            {NOT_CLAIMED.map((t, i) => (
              <li key={t}>
                <span className="sec-limits__n" aria-hidden data-no-translate>{two(i + 1)}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <div className="sec-after">
            <EditorialLink href={`${BASE}/limitations`}>Read the limitations</EditorialLink>
          </div>
        </div>
      </section>

      {/* /security#report: /.well-known/security.txt (Policy) and the acceptable use policy link here. It names the
          support inbox that reaches a person, and promises nothing the company cannot keep: no response time, no
          reward, no legal safe harbour. */}
      <section className="v6-sec" id="report">
        <div className="v6-wrap sec-report">
          <SectionHead
            eyebrow="Report a security issue"
            title="Tell us, and a person reads it"
            lead="Email help@vraelis.com with Security report in the subject. Say what you found, the address where it happens, and how to reproduce it."
          />
          <ul className="sec-report__rules" role="list">
            <li>Test only against accounts you own, and stop as soon as you can show the problem.</li>
            <li>Do not open, change or keep anyone else&apos;s data. If you reach some by accident, tell us and delete it.</li>
            <li>Give us a reasonable chance to fix it before you publish anything.</li>
          </ul>
          {/* A ghost button: the closing's white button sits in the same screen, and a view carries one white button. */}
          <div className="v6-actions sec-report__actions">
            <CTA lg ghost href="mailto:help@vraelis.com?subject=Security%20report">Email help@vraelis.com</CTA>
            {/* A static file, not a page: a plain link, so the router does not try to render it. */}
            <a className="v6-elink" href="/.well-known/security.txt">
              <span className="v6-elink__t" data-no-translate>/.well-known/security.txt</span>
              <span className="v6-arw" aria-hidden>→</span>
            </a>
          </div>
        </div>
      </section>

      <ClosingScene />
    </>
  );
}

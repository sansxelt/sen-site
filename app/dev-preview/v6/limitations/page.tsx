import { photographHero } from "../_content/photography";
import { v6meta } from "../_system/meta";
import { SectionHead, Reveal } from "../_system/ui";
import { FrameHero, DoesBox, Band, FeatureGrid, FeatureCard, CrossLinks, type CrossLink } from "../_system/kit";
import { ClosingScene } from "../_system/close";
import { SURFACES, COVERAGE_RULE, type CoverageTier } from "../_content/coverage";
import { sectorBySlug } from "../_content/sectors";
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import "./limitations.css";

export const metadata = v6meta({
  title: "Limitations",
  description:
    "What Vraelis can check today, what is not built yet, where a run needs your help, and what a check is evidence of.",
  path: "/limitations",
  type: "website",
});

const BASE = V6_BASE;
const SIGNUP = `${v6SignInPath()}&mode=signup`;

// THE LIMITATIONS PAGE (plan C /limitations and T1, revision 2, rebuilt 2026-10-02 on the kit). In order: the frame,
// whose coded panel is the coverage list at a glance; the summary (a DoesBox that agrees line by line with the
// defense page's); every surface as it stands today (#coverage); what a run cannot do on its own (#needs-you); what
// a check is evidence of (the one Band, #evidence); approval (#approval); Related; the closing. No other page links
// an anchor here today (grep "limitations#", 2026-10-02); the ids are stable so one can.
//
// WHERE EACH LINE COMES FROM. Nothing on this page is a new limit and none is softened.
//   - Coverage: _content/coverage.ts (SURFACES, COVERAGE_RULE), read, never copied. The HTTP API beta is the one
//     row coverage.ts leaves to this page (its header says so); its words are the console's own
//     (app/rank/app/systems/[id]/api-runtime/api-workspace.tsx: "API checking is new. Treat this as a signal to look
//     at, not a gate to release on.") and lib/preflight/api-beta-gate.ts (signed-in accounts only).
//   - The summary: the defense page's DoesBox (_content/sector-pages.ts), the fleets and public-sector boxes
//     (localhost and private networks), the commerce limits line (no standard is certified) and the rules file
//     (no clearance, no on-premises or air-gapped edition, no classified, CUI or export-controlled material).
//   - Sign-in walls: worker/preflight/auth-executor.ts stops at MFA and CAPTCHA and never tries to bypass them.
//   - Payments: lib/preflight/boundaries.ts (a live payment is indistinguishable from a test purchase at the step
//     layer) and the acceptable use policy (test modes and test data).
//   - Deletion: the fixed never-rules in lib/preflight/boundaries.ts, refused regardless of any permit. The old
//     page said a flow could permit deletion; the code has no such permit, so it now says what the code does.
//   - Evidence: the old page's binding section, minus a sentence about the record calling the binding "weak" that
//     no record surface shows today; _content/scope.ts for "nothing watches for the next deployment" and for a pass
//     that rests on a value an earlier run wrote.
//   - Approval: app/api/v1/verifications/plans/[id]/approve (403 plan_requires_human, with the approval link),
//     lib/preflight/acceptance/launch-coverage.ts (drafted requirements wait at "suggested" and bind nothing until
//     approved), lib/preflight/reviewed-plan.ts (a pending plan expires), lib/preflight/guarantees-db.ts (an
//     approved contract refuses flow edits), the rules file (24 hours, 10 times, the same address; a preview URL is
//     a different address) and /pricing (a re-check is billed as one verification).
// This page's one approval statement is the #approval heading; nothing else here repeats it (plan 0.3).

/* ── Coverage ───────────────────────────────────────────────────────────────────────────────────────────── */

// The tier is printed once per group, as a mono word, so a row's own text drops the words that only repeat it
// ("Next, not built yet." under the "Not built yet" label). A sentence this does not recognise is shown whole.
type Group = "Live" | "Beta" | "Not built yet" | "Not covered";
type CoverageRow = { name: string; group: Group; today: string };

const GROUP_OF: Record<CoverageTier, Group> = { Live: "Live", Next: "Not built yet", "Not covered": "Not covered" };
const GROUPS: Group[] = ["Live", "Beta", "Not built yet", "Not covered"];

function presentToday(today: string): string {
  const rest = today.replace(/^Next, not built yet\.\s+/, "").replace(/^Live,\s+because\s+/, "");
  return rest === today ? today : rest.charAt(0).toUpperCase() + rest.slice(1);
}

const HTTP_APIS: CoverageRow = {
  name: "HTTP APIs",
  group: "Beta",
  today: "A beta, in the signed-in console only. API checking is new, so treat its answer as a signal to look at, not a gate to release on.",
};

const ROWS: CoverageRow[] = [
  ...SURFACES.map((s) => ({ name: s.name, group: GROUP_OF[s.tier], today: presentToday(s.today) })),
  HTTP_APIS,
];
const rowsIn = (g: Group) => ROWS.filter((r) => r.group === g);


const DOES: string[] = [
  "Checks what a person can do in a web app, or in a device's web control panel, in a real browser.",
  "Writes a plan from your sentence before anything runs.",
  "Records every step and the screen, and writes a repair prompt.",
  "Re-checks the same approved plan after a fix.",
];

const DOES_NOT: string[] = [
  "Read the device itself: firmware, sensors and telemetry (not built yet).",
  "Run on premises, on localhost, or inside air-gapped or private networks.",
  "Hold a security clearance, or a government authorisation such as FedRAMP or an Impact Level.",
  // The Department of War's FASCSA order (upheld by the D.C. Circuit on 2026-09-25) bars contractors from using
  // Anthropic products in performing its contracts; Vraelis runs on Claude (see /subprocessors). Stated, not argued.
  "Run as part of US Department of War contract work, for now: that department bars Anthropic products, and Vraelis is built on Anthropic's models.",
  "Accept classified, CUI or export-controlled material. Checks belong on an unclassified simulation or staging build.",
  "Certify that a system is safe, or that it meets any standard. It checks defined behaviour against your sentence.",
];

/* ── Rows: a title in columns 1 to 5, the text in 6 to 12 ──────────────────────────────────────────────── */

type Row = { title: string; text: string; ref?: string };

const NEEDS_YOU: Row[] = [
  {
    title: "Sign-in that needs a person",
    text: "A one-time code, an authenticator prompt, a hardware key or a CAPTCHA stops a run, and it never tries to get past one. Give it a test identity that signs in with a password, or a preview with the challenge off.",
  },
  {
    title: "Real payments and real applications",
    text: "A run cannot tell a live payment from a test one. Check payments in your provider's test mode and public services on staging with test identities, never with real money or applications.",
  },
  {
    title: "Deleting an account, or everything in it",
    text: "A run refuses any step that reads as deleting an account, deleting or wiping everything, or a factory reset. No setting turns that rule off.",
  },
  {
    title: "Anything the screen does not show",
    text: "Vraelis drives your app from the outside, as a person would. It cannot read your database, logs or code, so a failure that leaves no trace on screen is invisible to it.",
  },
];

const EVIDENCE: [string, string][] = [
  ["A URL is not a build", "A check is bound to the address it tested, and that address can serve different code an hour later. Nothing watches for the next deployment."],
  ["A re-check proves the same meaning, not the same bytes", "Running the plan again re-proves the approved requirements against whatever is deployed now. It is not a replay of the earlier build."],
  ["A pass can rest on an earlier run", "A plan can assert a value an earlier run wrote, so an app that has stopped saving can still come back as if it worked."],
  ["Older records carry less provenance", "Records from before requirement provenance existed are labelled that way. Where an old plan's order or reviewer was never recorded, the record says so."],
];

const APPROVAL: Row[] = [
  {
    title: "An API key cannot approve a plan",
    text: "The approve endpoint refuses every API key and answers with the approval link instead. The CLI, a CI job or an AI assistant can ask for a check, never approve one.",
    ref: "403 plan_requires_human",
  },
  {
    title: "A plan nobody approved does not run",
    text: "The requirements Vraelis drafts from your sentence wait for review, and nothing runs until the plan is approved. A plan still waiting for approval expires after one hour.",
  },
  {
    title: "A re-check has limits",
    text: "Without a new approval, the same plan runs again only within 24 hours, up to 10 times, on the same address. A preview URL is a different address. Each re-check is billed as one verification.",
  },
  {
    title: "An approved plan is frozen",
    text: "Adding, changing or removing a journey in an approved plan is refused. Running discovery again can propose changes; it never rewrites what was approved.",
  },
];

function Rows({ rows, level = 3 }: { rows: Row[]; level?: 3 | 4 }) {
  const H = level === 4 ? "h4" : "h3";
  return (
    <ul className="v6-lim-rows" role="list">
      {rows.map((r, i) => (
        <li className="v6-lim-row" key={r.title}>
          <Reveal i={Math.min(i, 3)} className="v6-lim-row__in">
            <H className="v6-lim-row__t">{r.title}</H>
            <div className="v6-lim-row__body">
              <p className="v6-lim-row__d">{r.text}</p>
              {r.ref ? <p className="v6-lim-row__ref" data-no-translate>{r.ref}</p> : null}
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

/* ── Related ────────────────────────────────────────────────────────────────────────────────────────────── */

const sectorCard = (slug: "defense" | "fleets"): CrossLink => {
  const s = sectorBySlug(slug)!;
  return { title: s.label, body: s.line, href: s.href, image: s.pics.card1610 };
};

// The Security card reads as it does everywhere it appears (/solutions/defense, /enterprise): one line and one
// 16:10 picture per target across the site.
const RELATED: CrossLink[] = [
  { title: "Security", body: "What Vraelis stores, and how it is protected.", href: `${BASE}/security`, image: "/site/photography/signup.jpg" },
  sectorCard("defense"),
  sectorCard("fleets"),
];

export default function V6Limitations() {
  return (
    <>
      <FrameHero
        eyebrow="Limitations"
        title="What this cannot do, written down."
        sub="The edges of the product as it is today, in plain words. Each one is current, and most have a workaround."
        primary={{ label: "Start free", href: SIGNUP }}
        secondary={{ label: "See the coverage", href: "#coverage" }}
        {...photographHero("flight")}
      />

      <section className="v6-sec" id="does">
        <div className="v6-wrap">
          <SectionHead eyebrow="In short" title="What it does, and what it does not." />
          <Reveal>
            <DoesBox
              does={DOES}
              doesNot={DOES_NOT}
              link={{ label: "See what is built, and what is next", href: `${BASE}/platform#current` }}
            />
          </Reveal>
        </div>
      </section>

      <section className="v6-sec" id="coverage">
        <div className="v6-wrap">
          <SectionHead eyebrow="Coverage" title="What it can check today, and what it cannot." />
          <div className="v6-lim-cov">
            {GROUPS.map((g) => (
              <div className="v6-lim-cov__group" key={g}>
                <h3 className="v6-lim-cov__label" data-tier="">{g}</h3>
                <Rows level={4} rows={rowsIn(g).map((r) => ({ title: r.name, text: r.today }))} />
              </div>
            ))}
          </div>
          <p className="v6-lim-note">{COVERAGE_RULE}</p>
        </div>
      </section>

      <section className="v6-sec" id="needs-you">
        <div className="v6-wrap">
          <SectionHead eyebrow="Where a run needs you" title="What a run cannot do on its own." />
          <Rows rows={NEEDS_YOU} />
        </div>
      </section>

      <Band id="evidence">
        <SectionHead eyebrow="Evidence" title="What a check is evidence of." />
        <FeatureGrid span={6} reveal>
          {EVIDENCE.map(([t, b]) => <FeatureCard key={t} title={t} body={b} />)}
        </FeatureGrid>
      </Band>

      <section className="v6-sec" id="approval">
        <div className="v6-wrap">
          <SectionHead eyebrow="Approval" title="The system will not approve its own work." />
          <Rows rows={APPROVAL} />
        </div>
      </section>

      <section className="v6-sec">
        <div className="v6-wrap">
          <CrossLinks links={RELATED} />
        </div>
      </section>

      <ClosingScene title="Know the edges before you start." />
    </>
  );
}

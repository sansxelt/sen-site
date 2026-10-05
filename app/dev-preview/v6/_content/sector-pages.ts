// THE SECTOR PAGES' COPY (plan S2, revision 2, 2026-10-02), keyed by the slugs in _content/sectors.ts.
//
// _content/sectors.ts is the LIST (label, group, href, one line, pictures). This file is what one sector PAGE says:
// its title and description, the hero, the facts from its record, the problem, which record it shows, the
// examples, how it fits, its limits, its related links and its closing. solutions/[slug]/page.tsx renders it
// through _system/sector.tsx, which owns the layout (plan T2). Nothing here is laid out; nothing there is copy.
//
// THE RULES EVERY LINE BELOW WAS WRITTEN TO (scratchpad/impl/rules.md, plan 0.2 and 0.3):
//   - Every number and every fact is from the plan's permitted-facts list (A8.3), read out of _content/strike.ts,
//     _content/demos.ts, _content/scope.ts and _content/coverage.ts. scratchpad/qa/b5a-facts.txt lists each
//     FactRow value with its source line.
//   - A sentence that was run is quoted exactly: it is read from the record (STRIKE.claim, DEMOS[n].claim), never
//     retyped. A shortened one is labelled "What it checked". Every other sentence in an examples list is an
//     example, and the list's label says which were run.
//   - Larkspur is always "a simulated mission console Vraelis built". Vraelis does not make mission software,
//     holds no clearance or government authorisation, is on no contract vehicle and has no on-premises or
//     air-gapped edition; the defense page says what it does not do.
//   - Defense carries Vraelis's position (founder, 2026-10-02, scratchpad/impl/rules.md "FOUNDER UPDATE"): the
//     independent check that shows what mission software actually does, with evidence a person can read, before
//     anyone relies on it. It is said once, in the stance after the record, from three true things only: Vraelis
//     checks and does not build weapons or mission software; the judge is not the builder; the record is kept in
//     order and never overwritten. Never "ethical AI", "safe", "prevents casualties", "saves lives", never that
//     Vraelis makes a system lawful, compliant or approved for use, no agency or company named. Defense stays one
//     sector among several: the other pages do not carry it.
//   - Device copy names the panel or the console, never the aircraft, as the thing checked.
//   - The selling statement that a person approves every plan appears at most once per page in pitch copy.
//   - Pitch words, not verdict words: "Found a problem", "Did what the sentence says".
//   - No dashes, sentence case, every h1 and h2 a statement of twelve words or fewer with a full stop.
//   - Strings are whole sentences for the DOM translator (components/language-controller.tsx): no number or id
//     built into a sentence. Run ids travel in their own fields and render in their own mono elements.
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import { STRIKE } from "./strike";
import { DEMOS } from "./demos";
import type { SolutionSlug } from "./sectors";
import type { UseCaseSlug } from "./use-cases";

const BASE = V6_BASE;
/** The sign-up screen: the sign-in page in its sign-up mode, as the closing and the bar use it. */
const SIGNUP = `${v6SignInPath()}&mode=signup`;
const contact = (topic: "defense" | "fleets" | "public-sector") => `${BASE}/contact?topic=${topic}`;
const LIMITATIONS = `${BASE}/limitations`;

/** The claims that were run, from the records themselves. */
const CLAIM = {
  larkspur: STRIKE.claim,
  checkout: DEMOS.find((d) => d.key === "checkout")!.claim!,
  notewell: DEMOS.find((d) => d.key === "notes")!.claim!,
};

/** A label and where it goes. */
export type SectorLink = { label: string; href: string };

/** The page sections in the order the page shows them (plan T2; S2 orders a few pages differently on purpose).
 *  "stance" is defense only: Vraelis's position, directly after the record it rests on. */
export type SectorSection = "facts" | "problem" | "fixture" | "record" | "stance" | "ci" | "examples" | "band" | "limits" | "faq" | "cross";

/** How the hero shows its picture. The registry (sectors.ts) says which kind and holds the file paths; this is the
 *  page copy for it: alt text, object-position, the panel's bar, and the credit for a capture made now. */
export type SectorHeroArt =
  | { kind: "scene"; alt: string; position: string; portraitPosition: string; credit?: string }
  | {
      kind: "panel";
      alt: string;
      /** left: the address (machine text). right: a run and its date ({ run, recorded }) or nothing. */
      bar: { left: string; run?: string; recorded?: string };
      /** The capture's size in pixels (next/image needs it for a public/ path). Read from the file in
       *  public/site/hero/ and its row in that folder's CREDITS. */
      w: number;
      h: number;
      /** Caps the panel at 640px wide: a near-white capture or a recorded screenshot (plan 0.4). */
      evidence?: boolean;
      /** For a capture made now: "Captured <date>, not from the run." or, for a console capture, "Captured <date>". */
      credit?: string;
    }
  | { kind: "journey"; label: string };

/** One FactRow cell. Values are whole literal strings from A8.3; tone "stop" marks the finding. */
export type SectorFact = { label: string; value: string; tone?: "stop" };

/** Which record the worked example shows, and in which view (RecordPanel, _system/record-panel.tsx). */
export type SectorRecordView =
  | "strike"          // the Larkspur record: the sentence, the plan, the run, the finding
  | "strike-compact"  // the same record, shorter (fleets)
  | "checkout"        // Lumen Notes: before the fix, after the fix, the steps
  | "notes"           // Notewell: journey 1, journey 2, the screen
  | "projects"        // the fixture dashboard: the run and its screenshot
  | "demos"           // the three demo apps, one tab each (agencies)
  | "notes-journey-2"; // Notewell's second journey and its screenshot (public sector)

/** A sentence in the examples list. `run` marks the one sentence that was run: the record's own words, never
 *  translated. */
export type SectorExample = { text: string; run?: true };

/** A card: a title and a body of at most 32 words. */
export type SectorCard = { title: string; body: string };

/** A related link: a sector from the registry (its label, line, href and 16:10 card), a use case by its slug
 *  (_content/use-cases.ts; its page and its 16:10 card follow from the slug), or a page of its own. A row is shown
 *  with pictures only when every card in it has one, so the three cards always match. */
export type SectorCross =
  | { sector: SolutionSlug }
  | { useCase: UseCaseSlug; title: string; body: string }
  | { title: string; body: string; href: string; image?: string };

export type SectorPage = {
  slug: SolutionSlug;
  /** The page title (the layout adds "| Vraelis") and the meta description. */
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; sub: string; primary: SectorLink; secondary: SectorLink; art: SectorHeroArt };
  /** The section order. */
  sections: SectorSection[];
  /** The FactRow: only where every value quotes a record (A1.7). `ids` render after the sentence, in mono. */
  facts?: { items: SectorFact[]; source: { text: string; ids: string[]; href: string; label: string } };
  problem: { eyebrow: string; title: string; items: SectorCard[] };
  /** Fleets only: the real Fieldline fixture (_system/fixture-frame.tsx). */
  fixture?: { eyebrow: string; title: string; lead: string; sentenceLabel: string; sentence: string };
  record: { eyebrow: string; title: string; lead: string; view: SectorRecordView };
  /** Defense only: Vraelis's position, in the problem's shape (a head, then three text cards). The lead is at
   *  most two sentences; the cards say only what is true, and nothing the hero, the band or the limits say. */
  stance?: { eyebrow: string; title: string; lead: string; cards: SectorCard[] };
  /** SaaS only: the CLI in a CI job, as a reference block, and the note under it. */
  ci?: { eyebrow: string; title: string; lead: string; code: string; note: string };
  examples: { label: string; items: SectorExample[] };
  /** How it fits. "cards": three or four cards on the band. "mcp": the three MCP tools as one product panel.
   *  None on saas (its band is the CI block) and on the lean public sector page. */
  band?:
    | { kind: "cards"; eyebrow: string; title: string; lead?: string; cards: SectorCard[] }
    | { kind: "mcp"; eyebrow: string; title: string; lead: string; rows: { key: string; text: string }[] };
  /** A DoesBox (defense, fleets, public sector, plan A1.7) or one line linking /limitations (every other page). */
  limits:
    | { kind: "does"; eyebrow: string; title: string; does: string[]; doesNot: string[]; id?: string }
    | { kind: "line"; text: string };
  /** Defense only: "Working with Vraelis". A link, when an answer has one, follows its sentences. */
  faq?: { title: string; items: { q: string; a: string; link?: SectorLink }[] };
  /** Three related links. Empty on the lean public sector page. */
  cross: SectorCross[];
  closing: { title: string; action: SectorLink };
};

/** The "Limitations" link under a limits line. */
export const LIMITS_LINK: SectorLink = { label: "Limitations", href: LIMITATIONS };

/** The Larkspur record, as a related link (defense and fleets). */
const LARKSPUR_RECORD: SectorCross = {
  useCase: "only-the-confirmed-target",
  title: "The full Larkspur record",
  body: "The sentence, the plan, every step and the finding.",
};

export const SECTOR_PAGES: Record<SolutionSlug, SectorPage> = {
  /* ───────────────────────────────────────────────────────────────────────────────────────── defense (P0) ── */
  defense: {
    slug: "defense",
    meta: {
      title: "Defense and national security",
      description:
        "An independent check of mission software before anyone relies on it: a real browser on an unclassified simulation or staging build, and a record of every step.",
    },
    hero: {
      eyebrow: "Defense and national security",
      // The position, from the top (founder, 2026-10-02). The sub makes the page's one approval statement.
      title: "Verify mission software before deployment",
      sub: "Give mission consoles an independent check. Vraelis works your simulation or staging build in a real browser and records each action and result.",
      primary: { label: "Talk to us", href: contact("defense") },
      secondary: { label: "See the real check", href: "#record" },
      art: {
        kind: "scene",
        alt: "Larkspur, a simulated mission console Vraelis built, after the operator confirmed T-1: the civilian bus T-3 also shows Cleared to engage.",
        // The values the images batch measured on the real frame (public/site/hero/CREDITS.md, "Using them").
        // Landscape at 100%: the subject, the Selected contact panel, is the capture's right column, and only at
        // 100% is it whole at 1024, 1440 and 1920 (the header keeps "T-3", the Engagement box "Cleared to engage").
        position: "100% 50%",
        // The portrait is the phone layout's contact list, anchored left so its icons are never cut. 20% down only
        // matters on short phone frames (587 tall in Safari): it keeps T-2 to T-4 and T-1's Cleared to engage in
        // view; the four rows are taller than the room there, so no value clears them all (see the CREDITS).
        portraitPosition: "0% 20%",
        credit: "Larkspur demo fixture. Captured 2026-10-02, not from the run.",
      },
    },
    sections: ["facts", "problem", "record", "stance", "examples", "band", "limits", "faq", "cross"],
    facts: {
      items: [
        { label: "What it checked", value: "Confirming T-1 clears only T-1, and it holds after a reload" },
        { label: "Approved", value: "By a person, October 2, 2026, 02:03 UTC" },
        { label: "The run", value: "3 journeys, 23 planned steps, 40.8 s" },
        { label: "Found", value: "Step 8: the civilian bus T-3 showed Cleared to engage", tone: "stop" },
      ],
      source: {
        text: "From a run on Larkspur, a simulated mission console Vraelis built as a demo fixture, recorded October 2, 2026 (UTC).",
        ids: ["vrf_51705517"],
        href: `${BASE}/use-cases/only-the-confirmed-target`,
        label: "Read the record",
      },
    },
    problem: {
      eyebrow: "The problem",
      title: "Acceptance checks the demo, not the build",
      items: [
        { title: "The build changed after the demo", body: "A walkthrough proves the version that was shown. Vraelis checks the address you name, when you ask, and records the address and the time." },
        // What a run keeps is said once, in the stance's third card.
        { title: "A screenshot is not a record", body: "A passing screen says nothing about the step before it, or about what the page shows after a reload." },
        { title: "The fix is never checked again", body: "After a fix, the same approved plan runs again. The re-check is its own record and points back at the run it repeats." },
      ],
    },
    record: {
      eyebrow: "A real check",
      title: "The civilian bus was cleared too",
      lead: "Larkspur is a simulated mission console Vraelis built. In its broken mode, confirming one contact clears every contact in its grid square. This is what Vraelis recorded.",
      view: "strike",
    },
    // Vraelis's position (founder, 2026-10-02), after the record it rests on: the civilian bus shown Cleared to
    // engage after the operator confirmed only T-1. Three true things, each said once on the page: the old band
    // card "The record stays in order" lives here now. The headline rests on the second and third cards only (run
    // from outside, kept in order). No approval statement and no person-in-the-loop wording: the hero sub makes
    // the page's one approval statement, and Vraelis decides nothing about what a customer's system does.
    stance: {
      eyebrow: "Our position",
      title: "The builder should not be the only judge",
      lead: "Where software helps decide what happens to people, the check should be independent and show what the software actually does, with evidence a person can read.",
      cards: [
        { title: "Checking, not building", body: "Vraelis checks software. It does not build weapons or mission software." },
        { title: "Checked from outside", body: "Vraelis plans the check from one sentence about what the console must do, not from the builder's own tests, and runs it from outside, as an operator would." },
        { title: "The record stays in order", body: "Every step, what it expected, what it saw and the screen are kept in order. A later run never overwrites an earlier one." },
      ],
    },
    examples: {
      label: "The first check was recorded on Larkspur. The remaining checks are illustrative.",
      items: [
        { text: CLAIM.larkspur, run: true },
        { text: "Withdrawing the confirmation returns T-1 to Hold, and Confirm target works again." },
        { text: "A mission plan saved in the planner shows the same waypoints after a reload." },
        { text: "An operator with the viewer role does not see the Confirm target control." },
      ],
    },
    band: {
      kind: "cards",
      eyebrow: "How it fits",
      title: "Built for the simulation, not the aircraft",
      // Two cards: the third, "The record stays in order", is the stance's third card now.
      cards: [
        { title: "Simulation and staging", body: "Vraelis works only through a web page in a browser. Point it at a simulation or a staging build; it has no connection to hardware." },
        { title: "Reachable over https", body: "The console needs a public https address, such as a staging build with a test sign-in. Private networks and localhost are refused before a run starts." },
      ],
    },
    limits: {
      kind: "does",
      eyebrow: "Limits",
      title: "What it does, and what it does not",
      does: [
        "Checks what an operator can do in a web console, in a real browser.",
        "Writes a plan from your sentence before anything runs.",
        "Records every step and the screen, and writes a repair prompt.",
        "Re-checks the same approved plan after a fix.",
      ],
      doesNot: [
        "Run on premises, or inside air-gapped or private networks.",
        "Read the aircraft, vehicle or device itself: firmware, sensors, telemetry (not built yet).",
        "Hold a security clearance, or a government authorisation such as FedRAMP or an Impact Level.",
        "Accept classified, CUI or export-controlled material. Checks belong on an unclassified simulation or staging build.",
        // The same limit as plan S2's "Certify that a system is safe", worded without the word the founder's
        // update keeps off this page: Vraelis certifies nothing, and does not clear a system for use.
        "Certify a system for use. It checks defined behaviour against your sentence.",
      ],
    },
    faq: {
      title: "Working with Vraelis",
      items: [
        {
          q: "How do we start?",
          a: "Send a staging or simulation address and one sentence through the form or to sales@vraelis.com. You read the plan before anything runs.",
          link: { label: "Open the form", href: contact("defense") },
        },
        {
          q: "How do we buy it?",
          a: "Directly, by contract. Vraelis is not on a government contract vehicle today. Listed plans are on the pricing page.",
          link: { label: "See pricing", href: `${BASE}/pricing` },
        },
        {
          // The Department of War's FASCSA order (upheld by the D.C. Circuit on 2026-09-25) bars contractors from using
          // Anthropic products in performing its contracts; Vraelis runs on Claude. Said plainly, before anyone asks.
          q: "Can we use it for US Department of War contract work?",
          a: "Not yet. That department has barred Anthropic products from its contract work, and Vraelis is built on Anthropic's models.",
        },
        {
          q: "Where does our data go?",
          a: "Into your Vraelis workspace, through three services in the United States: Anthropic writes the plan from the address and the sentence, Browserbase runs the browser, and Supabase stores the record. The full list is on the subprocessors page.",
          link: { label: "Subprocessors", href: `${BASE}/subprocessors` },
        },
      ],
    },
    cross: [
      { sector: "fleets" },
      { title: "Security", body: "What Vraelis stores, and how it is protected.", href: `${BASE}/security`, image: "/site/photography/signup.jpg" },
      LARKSPUR_RECORD,
    ],
    closing: { title: "Bring one sentence and a simulation build", action: { label: "Talk to us", href: contact("defense") } },
  },

  /* ────────────────────────────────────────────────────────────────────────────────────────── fleets (P0) ── */
  fleets: {
    slug: "fleets",
    meta: {
      title: "Robotics, drones and fleets",
      description:
        "Check the web panel that runs your fleet: press the operator action in a real browser and read what the panel reports afterwards, including after a reload.",
    },
    hero: {
      eyebrow: "Robotics, drones and fleets",
      title: "Verify the software behind your fleet",
      sub: "Check operator actions on browser-based fleet consoles. Vraelis follows the workflow and verifies the resulting state, including after a reload.",
      primary: { label: "Talk to us", href: contact("fleets") },
      secondary: { label: "Try the fixture", href: "#fixture" },
      // Portrait 50% 75% (public/site/hero/CREDITS.md, "Using them"): at 50% the drone touches the eyebrow on short
      // phone frames. The light in the render is dusk; no sun is in the picture.
      art: { kind: "scene", alt: "Our drone over a field at dusk, a render made for Vraelis.", position: "50% 55%", portraitPosition: "50% 75%" },
    },
    // No FactRow: nothing on this page quotes a record of its own yet (plan E1: when the Fieldline check is run and
    // approved, its record replaces the Larkspur one below and a FactRow quoting it goes under the hero).
    sections: ["problem", "fixture", "record", "examples", "band", "limits", "cross"],
    problem: {
      eyebrow: "The problem",
      title: "Acknowledged is not executed",
      items: [
        { title: "The panel confirms the wrong unit", body: "The panel says Return home sent to SKY-01. Afterwards SKY-01 still shows Flying and SKY-10 shows Landed. Fieldline's broken mode has exactly this bug." },
        { title: "The state does not survive a reload", body: "A status that is right until the page reloads is a status the next operator never sees." },
        { title: "One action changes more than it should", body: "On Larkspur, confirming one contact cleared every contact in its grid square." },
      ],
    },
    fixture: {
      eyebrow: "Try it",
      title: "Press Return home",
      lead: "Fieldline is a simulated fleet console Vraelis serves for checks like this one. Nothing here is a real aircraft.",
      sentenceLabel: "The sentence for this fixture (not run yet)",
      sentence: "After the operator presses Return home for SKY-01, SKY-01 shows Landed at Pad A, and still does after a reload.",
    },
    record: {
      // Not "A real check": the headline already starts with those words.
      eyebrow: "The record",
      title: "A real check of a drone mission console",
      lead: "Larkspur is a simulated mission console Vraelis built. Confirming one target also cleared the civilian bus in the same grid square.",
      view: "strike-compact",
    },
    examples: {
      label: "Illustrative checks. These examples have not been run.",
      items: [
        { text: "After the operator presses Return home for SKY-01, SKY-01 shows Landed at Pad A, and still does after a reload." },
        { text: "Emergency stop on one aircraft leaves every other aircraft's status unchanged." },
        { text: "A robot's schedule edited in the dashboard shows the new start time after a reload." },
        { text: "The fleet map lists every vehicle the operator's role can see, and no others." },
      ],
    },
    band: {
      kind: "cards",
      eyebrow: "How it fits",
      title: "Through the panel, today",
      cards: [
        { title: "What the panel shows", body: "Vraelis reads what the panel shows after the action: the status, the location and the log. Reading the device itself is not built yet." },
        { title: "Review the plan", body: "Nothing presses a button until someone on your team approves the exact plan. An API key cannot approve one." },
        { title: "Simulation first", body: "Point it at a simulator or a staging panel first. The panel needs a public https address and a test sign-in." },
      ],
    },
    limits: {
      kind: "does",
      eyebrow: "Limits",
      title: "What it does, and what it does not",
      does: [
        "Presses the operator action in the panel, in a real browser.",
        "Reads what the panel reports afterwards, including after a reload.",
        "Records every step and the screen, and writes a repair prompt.",
      ],
      doesNot: [
        "Read the device itself: firmware, sensors, telemetry (not built yet).",
        "Check native or desktop apps (not built yet).",
        "Reach private networks or localhost.",
        // Plan S2's "Certify that a vehicle is safe", worded as the defense page words it (founder, 2026-10-02).
        "Certify a vehicle, or its panel, for use.",
      ],
    },
    cross: [
      { sector: "defense" },
      { title: "What it can reach", body: "Web apps, and devices through the panels that run them.", href: `${BASE}/platform#coverage`, image: "/site/photography/client.jpg" },
      LARKSPUR_RECORD,
    ],
    closing: { title: "Point it at your fleet's panel", action: { label: "Talk to us", href: contact("fleets") } },
  },

  /* ──────────────────────────────────────────────────────────────────────────────────────── commerce (P1) ── */
  commerce: {
    slug: "commerce",
    meta: {
      title: "Fintech and commerce",
      description:
        "Verify the entire customer transaction: on staging in test mode, a real browser buys with a test account, signs out and back in, and checks what is still there.",
    },
    hero: {
      eyebrow: "Fintech and commerce",
      title: "Verify the entire customer transaction",
      sub: "Vraelis checks checkout, account access and billing changes in a real browser. Use staging, test accounts and test payments before you release.",
      primary: { label: "Start free", href: SIGNUP },
      secondary: { label: "See the record", href: "#record" },
      art: {
        kind: "panel",
        alt: "The pricing page of Lumen Notes, a Vraelis demo app: a Free plan, and a Pro plan with its Get Pro button.",
        bar: { left: "broken-checkout.vercel.app/pricing.html" },
        w: 1760,
        h: 1412,
        evidence: true,
        credit: "Captured 2026-10-02, not from the run.",
      },
    },
    sections: ["facts", "problem", "record", "examples", "band", "limits", "cross"],
    facts: {
      items: [
        { label: "What it checked", value: "Upgrade to Pro, and keep Pro after signing out and back in" },
        { label: "Before the fix", value: "Step 11 of 11: “Pro” was not on the page", tone: "stop" },
        { label: "After the fix", value: "Did what the sentence says, in 9.0 s" },
        { label: "The plan", value: "The same 11 steps, before and after" },
      ],
      source: {
        text: "From two runs on Lumen Notes, a Vraelis demo app, on July 22, 2026.",
        ids: ["3fad10f5", "588c48f7"],
        href: `${BASE}/use-cases/checkout-that-forgets`,
        label: "Read the record",
      },
    },
    problem: {
      eyebrow: "The problem",
      title: "Check what happens after the payment",
      items: [
        { title: "Paid access", body: "A successful payment should unlock the right access and keep it after the customer signs back in." },
        { title: "Plan changes", body: "Verify that upgrades and cancellations appear correctly on the account page." },
        { title: "Checkout and receipts", body: "Check that totals, discounts and plan names agree across the customer journey." },
      ],
    },
    record: {
      eyebrow: "A real check",
      title: "A paid upgrade disappeared after sign-in",
      lead: "In our Lumen Notes demo, payment succeeded but Pro access disappeared after sign-in. The same 11-step check exposed the issue and verified the fix.",
      view: "checkout",
    },
    examples: {
      label: "The first check was recorded on Lumen Notes. The remaining checks are illustrative.",
      items: [
        { text: CLAIM.checkout, run: true },
        { text: "Cancelling from Billing changes the plan to Cancelled, and Billing still shows Cancelled after a reload." },
        { text: "A discount code applies once, and the checkout total matches the receipt page." },
        { text: "A customer who downgrades keeps their projects and loses the Pro features." },
      ],
    },
    band: {
      kind: "cards",
      eyebrow: "How it fits",
      title: "Fit verification into your release workflow",
      cards: [
        { title: "Connect your staging build", body: "Run it on a preview or staging deployment with your payment provider in test mode, and give Vraelis a test account." },
        { title: "Review the plan", body: "Nothing runs until someone on your team approves the exact plan. An API key cannot approve one." },
        { title: "Verify the fix", body: "After a fix, the same approved plan runs again on the same host, within 24 hours, up to 10 times." },
      ],
    },
    limits: {
      kind: "line",
      text: "It sees what the customer sees, not your payment provider, and it does not certify PCI DSS or any other standard.",
    },
    cross: [
      { sector: "saas" },
      { sector: "ai-built-apps" },
      { useCase: "checkout-that-forgets", title: "A checkout that forgets", body: "Before the fix and after it, step by step." },
    ],
    closing: { title: "Know the upgrade sticks", action: { label: "Start free", href: SIGNUP } },
  },

  /* ─────────────────────────────────────────────────────────────────────────────────── ai-built-apps (P0) ── */
  "ai-built-apps": {
    slug: "ai-built-apps",
    meta: {
      title: "AI-built apps",
      description:
        "Coding agents can ask Vraelis for a check of the live app before they report done. A person approves the plan, and the answer comes back with a repair prompt.",
    },
    hero: {
      eyebrow: "AI-built apps",
      title: "Give agent-built software an independent check",
      sub: "Connect Claude Code, Codex, Cursor or Copilot to Vraelis. Review the plan, check the live app, then return findings and a repair prompt to the agent.",
      primary: { label: "Set up your agent", href: `${BASE}/agents` },
      secondary: { label: "See the record", href: "#record" },
      art: {
        kind: "panel",
        alt: "The Notewell dashboard at the end of the run: Your notes reads No notes yet, because the check deleted its own test note.",
        bar: { left: "my-safe-note.lovable.app/dashboard", run: "4fc6e52c", recorded: "2026-07-31" },
        w: 888,
        h: 530,
        evidence: true,
      },
    },
    sections: ["facts", "problem", "band", "record", "examples", "limits", "cross"],
    facts: {
      items: [
        { label: "The app", value: "Notewell, built with Lovable" },
        { label: "From one sentence", value: "2 journeys: the note survives sign-out, the dashboard stays private" },
        { label: "The run", value: "18 steps in 17.4 s" },
        { label: "Clean-up", value: "The check deleted its own test note" },
      ],
      source: {
        text: "From a run on Notewell, a Vraelis demo app, on July 31, 2026.",
        ids: ["4fc6e52c"],
        href: `${BASE}/use-cases/notes-that-survive-sign-out`,
        label: "Read the record",
      },
    },
    problem: {
      eyebrow: "The problem",
      title: "Done is a claim, not a result",
      items: [
        { title: "The agent checks what it wrote", body: "Its tests come from the same reading of the task as its code. Vraelis starts from your sentence." },
        { title: "Done means it compiled", body: "A green build says nothing about what a user can do on the deployed app." },
        { title: "The fix is reported, not checked", body: "The re-check tool runs the same approved plan again and returns the new answer to the agent." },
      ],
    },
    band: {
      kind: "mcp",
      eyebrow: "How it fits",
      title: "The agent asks, and the answer comes back",
      // The approval is the hero sub's (the page's one statement) and the panel's second row; not again here.
      lead: "Three MCP tools, local or hosted.",
      rows: [
        { key: "vraelis_verify", text: "The agent asks for a check, with your sentence and the address of the live app." },
        { key: "403 plan_requires_human", text: "A person approves the plan. An API key that tries gets this answer." },
        { key: "vraelis_status, vraelis_recheck", text: "The answer goes back to the agent with a repair prompt, and the re-check runs after the fix." },
      ],
    },
    record: {
      eyebrow: "A real check",
      title: "The note was still there after signing back in",
      lead: "Notewell is a demo app built with Lovable. Vraelis wrote two journeys from one sentence, and the check cleaned up after itself.",
      view: "notes",
    },
    examples: {
      label: "The first check was recorded on Notewell; its plan also covered the second. The remaining checks are illustrative.",
      items: [
        { text: CLAIM.notewell, run: true },
        { text: "Signed out, opening /dashboard sends the browser to sign in." },
        { text: "A new visitor can sign up and reach the dashboard." },
        { text: "Uploading a profile photo shows the new photo after a reload." },
      ],
    },
    limits: { kind: "line", text: "It does not read your code, and native and desktop apps are not built yet." },
    cross: [
      { title: "AI assistants", body: "Set up Vraelis in your coding agent, over MCP.", href: `${BASE}/agents`, image: "/site/photography/client.jpg" },
      { sector: "saas" },
      { useCase: "notes-that-survive-sign-out", title: "Notes that survive sign-out", body: "Two journeys from one sentence, step by step." },
    ],
    closing: { title: "Let the agent ask before it says done", action: { label: "Set up your agent", href: `${BASE}/agents` } },
  },

  /* ──────────────────────────────────────────────────────────────────────────────────────────── saas (P2) ── */
  saas: {
    slug: "saas",
    meta: {
      title: "SaaS product teams",
      description:
        "Check sign-up, roles, billing and the work customers save on the deployed app before a release, one sentence at a time, with a record of every step.",
    },
    hero: {
      eyebrow: "SaaS product teams",
      title: "Verify the workflows your customers depend on",
      sub: "Check sign-up, permissions, billing and saved work in the deployed app. Vraelis follows the customer journey and records what actually happens.",
      primary: { label: "Start free", href: SIGNUP },
      secondary: { label: "See the record", href: "#record" },
      art: {
        kind: "panel",
        alt: "The Vraelis fixture dashboard right after creating a project, before any reload: Test Project is in the list.",
        bar: { left: "preflight-demo-ten.vercel.app/?mode=broken" },
        w: 1296,
        h: 952,
        evidence: true,
        credit: "Captured 2026-10-02, not from the run.",
      },
    },
    sections: ["facts", "problem", "record", "ci", "examples", "limits", "cross"],
    facts: {
      items: [
        { label: "The journey", value: "Create a project and check it persists" },
        { label: "Found", value: "Step 5 of 5: Not visible. Created data disappears after refresh.", tone: "stop" },
        { label: "The run", value: "5 steps in 5.0 s" },
        { label: "The app", value: "Vraelis fixture dashboard, broken mode" },
      ],
      source: {
        text: "From a run on the Vraelis fixture dashboard, July 14, 2026.",
        ids: ["de53ab8b"],
        href: `${BASE}/use-cases/project-that-vanishes`,
        label: "Read the record",
      },
    },
    problem: {
      eyebrow: "The problem",
      title: "It looked fine on screen",
      items: [
        { title: "Saved until the next reload", body: "On the fixture dashboard, a new project appeared on screen. After one reload the page said No projects yet." },
        { title: "A setting that does not stick", body: "A changed setting can look saved and be gone at the next sign-in. Say it must survive one, and the plan signs out and back in." },
        { title: "A private page that opens for anyone", body: "Notewell's check covered this, and it passed: signed out, /dashboard sent the browser to sign in." },
      ],
    },
    record: {
      eyebrow: "A real check",
      title: "The project was gone after one reload",
      lead: "The Vraelis fixture dashboard, in its broken mode, keeps new projects in memory only. This is what the check recorded.",
      view: "projects",
    },
    ci: {
      eyebrow: "From CI",
      title: "Gate the release on exit code 0",
      lead: "Run the CLI in your pipeline against the preview deployment, with the sentence your customers would write.",
      code: 'vraelis verify --url "$PREVIEW_URL" --claim "$CLAIM" --wait',
      note: "Only exit code 0 ships. A new plan waits for a person. A re-check of an approved plan on the same host does not, within 24 hours and up to 10 times. Each new preview URL is a new host.",
    },
    examples: {
      label: "Illustrative checks. These examples have not been run.",
      items: [
        { text: "A new visitor can sign up, confirm their email and reach an empty dashboard." },
        { text: "A viewer can open a project but does not see the Delete button." },
        { text: "Changing the billing email in Settings shows the new address after a reload." },
        { text: "A project one teammate creates appears for the other after a reload." },
      ],
    },
    limits: { kind: "line", text: "It checks what a customer sees in the browser, not your code or your database." },
    cross: [
      { sector: "commerce" },
      { sector: "ai-built-apps" },
      { title: "Developers", body: "The CLI, the API and CI.", href: `${BASE}/developers`, image: "/site/photography/agent.jpg" },
    ],
    closing: { title: "Write the sentence your customers would", action: { label: "Start free", href: SIGNUP } },
  },

  /* ──────────────────────────────────────────────────────────────────────────────────────── agencies (P0) ── */
  agencies: {
    slug: "agencies",
    meta: {
      title: "Agencies",
      description:
        "Check what the client asked for on the live build, one sentence at a time, and hand the site over with the evidence instead of a walkthrough.",
    },
    hero: {
      eyebrow: "Agencies and their clients",
      title: "Hand over a site you have checked",
      sub: "Verify the client’s requirements on the deployed build. Give your team and client a shared record of the check, its findings and the result after a fix.",
      primary: { label: "Start free", href: SIGNUP },
      secondary: { label: "See three records", href: "#record" },
      // The Members and Roles cards (1356x1006): the Roles card alone was a 2:1 strip that left the top half of the
      // frame empty at 1440. The account's email in the Members row is masked (public/site/hero/CREDITS.md).
      art: {
        kind: "panel",
        alt: "The Members and Roles cards on the Vraelis console's Team page: the workspace owner and an invitation to bring in collaborators or clients, then Owner, Admin, Editor, Viewer and Client viewer, and billing that stays with the workspace owner.",
        bar: { left: "app.vraelis.com/team" },
        w: 1356,
        h: 1006,
        credit: "Captured 2026-10-02",
      },
    },
    // S2 orders this page: the records, then how a client is brought in, then the examples and the limits line.
    sections: ["problem", "record", "band", "examples", "limits", "cross"],
    problem: {
      eyebrow: "The problem",
      title: "The client finds it after launch",
      items: [
        { title: "The brief lives in a document nobody checks", body: "Write each line of the brief as one sentence, and Vraelis checks it on the build the client will use." },
        { title: "The demo was on your machine", body: "Vraelis checks a public address, a preview or staging deployment, never localhost." },
        { title: "Fixes arrive without proof", body: "After a fix, the same approved plan runs again. Send the client the re-check with the fix." },
      ],
    },
    record: {
      eyebrow: "Three real checks",
      title: "Three demo apps, checked for real",
      // The project tracker's record has no sentence (A8.3), so the lead does not promise one for every record.
      lead: "Lumen Notes, Notewell and a project tracker are Vraelis demo apps. Each record keeps every step and what it found, and the sentence where the run had one.",
      view: "demos",
    },
    band: {
      kind: "cards",
      eyebrow: "How it fits",
      title: "Bring the client in",
      cards: [
        { title: "A viewer seat for the client", body: "The viewer role reads the evidence without anyone sharing a login." },
        { title: "Approving costs nothing", body: "A reviewer who approves a plan is never charged for it." },
        { title: "One system per client", body: "Each client's site is its own connected system with its own record." },
        { title: "After a fix", body: "The same plan runs again within 24 hours, up to 10 times, on the same host." },
      ],
    },
    examples: {
      label: "Illustrative checks. These examples have not been run.",
      items: [
        { text: "The contact form on the home page sends, and the thank-you page shows the visitor's name." },
        { text: "A visitor can book a table, and the confirmation page shows the date they chose." },
        { text: "In test mode, the shop's checkout ends on an order page with an order number." },
        { text: "Switching the site to French keeps the visitor on the same page." },
      ],
    },
    limits: { kind: "line", text: "It checks the live build in a browser. It does not review your code or your design." },
    cross: [
      { sector: "commerce" },
      { sector: "saas" },
      // The /pricing "One verification is" strip, composed as a 16:10 card (public/site/card/CREDITS.md). No prices in
      // the picture: a picture of the plan cards would be a second price list that does not follow the library.
      { title: "Pricing", body: "Listed plans, and what one verification includes.", href: `${BASE}/pricing`, image: "/site/photography/checkout.jpg" },
    ],
    closing: { title: "Ship the handover with the evidence", action: { label: "Start free", href: SIGNUP } },
  },

  /* ─────────────────────────────────────────────────────────────────────────────────── public-sector (P2) ── */
  "public-sector": {
    slug: "public-sector",
    meta: {
      title: "Public sector",
      description:
        "Check resident services in a real browser on a staging copy with test identities: applications, sign-in and the page that confirms them, with a record of every step.",
    },
    hero: {
      eyebrow: "Public sector",
      title: "Verify the services residents rely on",
      sub: "Check applications, sign-in and submission confirmations on staging with test identities. Keep a readable record for the people responsible for reviewing the service.",
      primary: { label: "Talk to us", href: contact("public-sector") },
      secondary: { label: "What is not built yet", href: "#limits" },
      art: { kind: "journey", label: "Notewell's second journey, as recorded" },
    },
    // The lean build (plan E4): five screens, no band and no related links.
    sections: ["facts", "problem", "record", "examples", "limits"],
    facts: {
      items: [
        { label: "The journey", value: "Verify dashboard is gated without authentication" },
        { label: "What it saw", value: "Signed out, /dashboard sent the browser to sign in" },
        { label: "Result", value: "Did what the sentence says" },
        { label: "The app", value: "Notewell, built with Lovable" },
      ],
      source: {
        text: "From a run on Notewell, a Vraelis demo app, on July 31, 2026. Both journeys passed.",
        ids: ["4fc6e52c"],
        href: `${BASE}/use-cases/notes-that-survive-sign-out`,
        label: "Read the record",
      },
    },
    problem: {
      eyebrow: "The problem",
      title: "A form is a promise to a resident",
      items: [
        { title: "A form that loses what was typed", body: "A resident fills in several screens, goes back to check one, and finds it empty." },
        { title: "Private pages that open without signing in", body: "A signed-out visitor should meet a sign-in screen, never someone else's application." },
        { title: "A reference-number page that never appears", body: "The confirmation is the resident's only proof. On staging, the check submits with a test identity and waits for it." },
      ],
    },
    record: {
      eyebrow: "A real check",
      title: "Signed out, the dashboard stayed closed",
      lead: "Notewell is a demo app built with Lovable. Its second journey opened the dashboard while signed out, and it passed.",
      view: "notes-journey-2",
    },
    examples: {
      label: "The first check passed on Notewell. The remaining checks are illustrative.",
      items: [
        { text: "Signed out, opening the dashboard sends the browser to sign in." },
        { text: "An application saved as a draft shows the same answers after signing out and back in." },
        { text: "On staging, after submitting with a test identity, the confirmation page shows a reference number." },
        { text: "A resident who changes the language keeps the answers already typed." },
      ],
    },
    limits: {
      kind: "does",
      id: "limits",
      eyebrow: "Limits",
      title: "What it does, and what is not built yet",
      does: [
        "Checks a service the way a resident uses it, in a real browser.",
        "Reads what each page shows after every step, including after a reload.",
        "Records every step and the screen, for whoever signs it off.",
      ],
      doesNot: [
        "Run on a live service with real applications. Use staging and test identities.",
        "Accessibility and consent checks: not built yet. When built, they are evidence for your auditor or counsel, not a certification.",
        "Hold a government security authorisation such as FedRAMP.",
        "Reach private networks or localhost.",
      ],
    },
    cross: [],
    closing: { title: "Bring one service and one sentence", action: { label: "Talk to us", href: contact("public-sector") } },
  },
};

/** One sector page's copy by slug, for a route parameter. */
export function sectorPage(slug: string): SectorPage | undefined {
  return (SECTOR_PAGES as Record<string, SectorPage | undefined>)[slug];
}

/** The /solutions index (plan S2 and T14). The groups and cards come from _content/sectors.ts. */
export const SOLUTIONS_INDEX = {
  meta: {
    title: "Solutions",
    description:
      "Independent software verification for defense, robotics and institutional teams. Approved requirements, observed behavior and recorded evidence.",
  },
  eyebrow: "Solutions",
  title: "Physical systems depend on software that works",
  lead: "For robotics, fleets, industrial equipment and defense. Start with a live control panel or a task recording, and inspect the evidence against your requirements.",
} as const;

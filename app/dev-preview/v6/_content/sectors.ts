// THE SECTORS, IN ONE PLACE (plan S1, revision 2, 2026-10-02).
//
// Every surface that lists sectors reads this file and nothing else: the footer's Solutions column
// (_system/close.tsx), the Solutions menu and the phone drawer (_system/shell.tsx), the homepage's sector row
// and the orbit's tile routing (_system/orbit.tsx), the /solutions index, CrossLinks cards, and the sector
// pages themselves (solutions/[slug]/page.tsx). A second hand-kept list drifts within a week: a label renamed
// in one menu, a slug changed in one footer, a picture swapped on one card. So NEVER HAND-LIST A SECTOR.
//
// FROZEN after phase 1 of the 2026-10 site plan: every export, type and value. A page that needs something this
// file does not hold asks the orchestrator (scratchpad/qa/kit-defects.txt) rather than adding a local copy.
//
// WHAT IS HERE, AND WHAT IS NOT
//   Here: what a LIST of sectors needs. The slug, the menu label, the group, where it links, one line under the
//   name, the picture paths, and the build priority.
//   Not here: a sector PAGE's copy (headline, facts, record, examples, primary action, closing). That lives in
//   _content/sector-pages.ts, typed SectorPage and keyed by the same slug. Use cases live in
//   _content/use-cases.ts.
//
// HOW TO READ IT
//   import { SECTORS, sectorsIn, sectorBySlug, SOLUTION_SLUGS, SOLUTIONS_HREF, orbitSector } from "../_content/sectors";
//
//   Footer and menus, grouped:   sectorsIn("Sectors"), then sectorsIn("Teams"), each { label, href, line, pics.menu }
//   The homepage sector row:     SECTORS.filter((s) => s.slug !== "enterprise"), rendering s.short
//   The /solutions index:        the two groups again, cards from pics.card43, the name from label, the line
//   A CrossLinks card:           { title: s.label, body: s.line, href: s.href, image: s.pics.card1610 }
//   A sector page:               generateStaticParams() { return SOLUTION_SLUGS.map((slug) => ({ slug })); }
//                                const s = sectorBySlug(slug); if (!s) notFound();
//   An orbit tile:               orbitRoute(tile.word): where it leads and the page name it prints
//
// The order of SECTORS is the display order everywhere (plan S3, S4 and S5): the "Sectors" group, then "Teams",
// with Enterprise last. Print it in this order; do not sort it.
//
// Every href already carries V6_BASE (lib/v6-routes.ts), like every other v6 link: "/solutions/defense" when
// the site is promoted, "/dev-preview/v6/solutions/defense" on the unpromoted preview server. A picture path is
// a public URL ("/site/menu/defense.jpg", the file public/site/menu/defense.jpg), the same in both.
//
// Strings are whole sentences for the DOM translator (components/language-controller.tsx keys on the exact
// English text of each node): render `line` as one text node, never split around a link or a number.
import { V6_BASE } from "@/lib/v6-routes";

/** Every sector, by slug. The first seven have a page at /solutions/<slug>; Enterprise is the existing /enterprise. */
export type SectorSlug =
  | "defense"
  | "fleets"
  | "commerce"
  | "public-sector"
  | "ai-built-apps"
  | "saas"
  | "agencies"
  | "enterprise";

/** The seven slugs that have a page at /solutions/<slug> (everything but Enterprise). */
export type SolutionSlug = Exclude<SectorSlug, "enterprise">;

/** The two groups the menus, the footer and the /solutions index print, in this order. Group names are labels,
 *  not headlines: no full stop (plan 0.3). */
export type SectorGroup = "Sectors" | "Teams";

/** Build priority from plan S1. "existing" is a page that is already built (/enterprise). */
export type SectorPriority = "P0" | "P1" | "P2" | "existing";

/**
 * The picture paths for one sector, all under public/site/ (plan A7.4 sizes, A7.5 assignments; made by the
 * images batch, credited in each folder's CREDITS.md).
 *
 * The hero is one of three kinds, and the type says which:
 *   a scene     hero (2:1, 2880x1440) and heroPortrait (9:16, 1440x2560) are both set: FrameHero's picture
 *               { src: hero, portrait: heroPortrait, ... }.
 *   a panel     hero is null and heroPanel is set: a capture (PNG at DPR 2) for FrameHero's
 *               panel { kind: "image", src: heroPanel, ... }. Read its w and h from the file.
 *   a coded     hero is null and there is no heroPanel: the page draws its panel in code, FrameHero's
 *   panel       panel { kind: "node", ... } (public sector).
 * Alt text, object-position, the panel bar and the credit belong to the page (_content/sector-pages.ts), not here.
 */
export type SectorPics = (
  | { hero: string; heroPortrait: string; heroPanel?: undefined }
  | { hero: null; heroPortrait?: undefined; heroPanel?: string }
) & {
  /** The menu picture, 1400x700 (2:1). The Solutions menu shows it beside the links. */
  menu: string;
  /** The 4:3 card, 1600x1200: the /solutions index. */
  card43: string;
  /** The 16:10 card, 1600x1000: CrossLinks. */
  card1610: string;
};

export type Sector = {
  slug: SectorSlug;
  /** The name in the Solutions menu, the footer, the /solutions index and CrossLinks. Sentence case. */
  label: string;
  /** The name where space is tight: the homepage's sector row (plan S4). The same as `label` except "SaaS". */
  short: string;
  group: SectorGroup;
  /** Where the name links, V6_BASE included. */
  href: string;
  /** One line under the name (menus, the /solutions cards, CrossLinks). A whole sentence; render it as is. */
  line: string;
  pics: SectorPics;
  priority: SectorPriority;
};

/** Build a sector's card and menu paths from its slug: public/site/menu/<slug>.jpg, public/site/card/<slug>-4x3.jpg
 *  and public/site/card/<slug>-16x10.jpg (plan A7.5). */
function listPics(slug: SectorSlug) {
  return { menu: `/site/menu/${slug}.jpg`, card43: `/site/card/${slug}-4x3.jpg`, card1610: `/site/card/${slug}-16x10.jpg` };
}

/** Every sector, in display order: the "Sectors" group, then "Teams", Enterprise last. */
export const SECTORS: readonly Sector[] = [
  {
    slug: "defense",
    label: "Defense",
    short: "Defense",
    group: "Sectors",
    href: `${V6_BASE}/solutions/defense`,
    line: "Mission consoles, checked on a simulation or staging build.",
    // Scene: the Larkspur demo fixture in broken mode after Confirm target on T-1 (a fresh capture, credited
    // "Captured <date>, not from the run" on the page).
    pics: { hero: "/site/hero/defense.jpg", heroPortrait: "/site/hero/defense-portrait.jpg", ...listPics("defense") },
    priority: "P0",
  },
  {
    slug: "fleets",
    label: "Robotics and fleets",
    short: "Robotics and fleets",
    group: "Sectors",
    href: `${V6_BASE}/solutions/fleets`,
    line: "The web panel that runs drones, robots and fleets.",
    // Scene: our own render, the drone over the field at sunset (app/film/orbit).
    pics: { hero: "/site/hero/fleets.jpg", heroPortrait: "/site/hero/fleets-portrait.jpg", ...listPics("fleets") },
    priority: "P0",
  },
  {
    slug: "commerce",
    label: "Fintech and commerce",
    short: "Fintech and commerce",
    group: "Sectors",
    href: `${V6_BASE}/solutions/commerce`,
    line: "Checkouts and plans, checked before a release.",
    // Panel: a capture of the Lumen Notes pricing page, shown at most 640 wide.
    pics: { hero: null, heroPanel: "/site/hero/commerce-panel.png", ...listPics("commerce") },
    priority: "P1",
  },
  {
    slug: "public-sector",
    label: "Public sector",
    short: "Public sector",
    group: "Sectors",
    href: `${V6_BASE}/solutions/public-sector`,
    line: "Resident services, checked on staging with test identities.",
    // Coded panel: Notewell journey 2's recorded steps (_content/demos.ts), drawn by the page.
    pics: { hero: null, ...listPics("public-sector") },
    priority: "P2",
  },
  {
    slug: "ai-built-apps",
    label: "AI-built apps",
    short: "AI-built apps",
    group: "Teams",
    href: `${V6_BASE}/solutions/ai-built-apps`,
    line: "Apps an agent built, checked on the live app.",
    // Panel, evidence: notes-dashboard.png from run 4fc6e52c, cropped to the note list, never recoloured.
    pics: { hero: null, heroPanel: "/site/hero/ai-built-apps-panel.png", ...listPics("ai-built-apps") },
    priority: "P0",
  },
  {
    slug: "saas",
    label: "SaaS product teams",
    short: "SaaS",
    group: "Teams",
    href: `${V6_BASE}/solutions/saas`,
    line: "Sign-up, roles, billing and the work customers save.",
    // Panel: the fixture dashboard right after creating "Test Project", before any reload.
    pics: { hero: null, heroPanel: "/site/hero/saas-panel.png", ...listPics("saas") },
    priority: "P2",
  },
  {
    slug: "agencies",
    label: "Agencies",
    short: "Agencies",
    group: "Teams",
    href: `${V6_BASE}/solutions/agencies`,
    line: "Client sites handed over with the evidence.",
    // Panel: a console capture of the team page with owner, editor and viewer roles (names masked).
    pics: { hero: null, heroPanel: "/site/hero/agencies-panel.png", ...listPics("agencies") },
    priority: "P0",
  },
  {
    slug: "enterprise",
    label: "Enterprise",
    short: "Enterprise",
    group: "Teams",
    href: `${V6_BASE}/enterprise`,
    line: "Single sign-on, roles, billing and audit export for teams.",
    // Panel: a console capture of the organization single sign-on settings (QA account).
    pics: { hero: null, heroPanel: "/site/hero/enterprise-panel.png", ...listPics("enterprise") },
    priority: "existing",
  },
];

/** The groups in print order. */
export const SECTOR_GROUPS: readonly SectorGroup[] = ["Sectors", "Teams"];

/** The sectors of one group, in display order. */
export function sectorsIn(group: SectorGroup): Sector[] {
  return SECTORS.filter((s) => s.group === group);
}

/** One sector by slug, for a route parameter. Undefined for anything that is not a slug here. */
export function sectorBySlug(slug: string): Sector | undefined {
  return SECTORS.find((s) => s.slug === slug);
}

/** The seven slugs with a page at /solutions/<slug>, in display order: generateStaticParams for solutions/[slug]
 *  (with dynamicParams = false). */
export const SOLUTION_SLUGS: readonly SolutionSlug[] = SECTORS.flatMap((s) => (s.slug === "enterprise" ? [] : [s.slug]));

/** The /solutions index: the "All solutions" link in the footer and the menus. */
export const SOLUTIONS_HREF = `${V6_BASE}/solutions`;

/** The nineteen words the homepage orbit can put in its headline ("Know your <word> works.", _system/orbit.tsx),
 *  exactly as the headline spells them (rebuilt 2026-10-02 evening with the founder's subjects). Every one is
 *  checked today: a web app, an agent's work, or the web panel or console that runs a device, never the machine
 *  itself (coverage.ts). The orbit's four Next tiles (Electron apps, SDKs and scripts, the device itself, native
 *  mobile apps) are not words: they never reach the headline, and they link to the coverage list. */
export type OrbitWord =
  | "checkout"
  | "banking app"
  | "sign-up"
  | "dashboard"
  | "release"
  | "agent's change"
  | "AI-built app"
  | "client's site"
  | "benefits portal"
  | "drone panel"
  | "fleet console"
  | "robot console"
  | "robot fleet panel"
  | "flight console"
  | "vehicle portal"
  | "device panel"
  | "ground control console"
  | "mission console"
  | "targeting console";

/** Where an orbit tile leads. `href` carries V6_BASE; `to` is the name of that page as the tile prints it under its
 *  word (a whole string for the translator, never assembled). */
export type OrbitRoute = { readonly href: string; readonly to: string };

/** Where each orbit word leads: a sector page by slug, or the one page that shows the word best (a release to the
 *  CI guide, an agent's change to the AI assistants page, the targeting console to the Larkspur check, which is a
 *  simulated console Vraelis built, as its tile says). */
export const ORBIT_ROUTE: Readonly<Record<OrbitWord, SolutionSlug | OrbitRoute>> = {
  "checkout": "commerce",
  "banking app": "commerce",
  "sign-up": "saas",
  "dashboard": "saas",
  "release": { href: `${V6_BASE}/docs/ci`, to: "Gate a release in CI" },
  "agent's change": { href: `${V6_BASE}/agents`, to: "AI assistants" },
  "AI-built app": "ai-built-apps",
  "client's site": "agencies",
  "benefits portal": "public-sector",
  "drone panel": "fleets",
  "fleet console": "fleets",
  "robot console": "fleets",
  "robot fleet panel": "fleets",
  "flight console": "fleets",
  "vehicle portal": "fleets",
  "device panel": "fleets",
  "ground control console": "defense",
  "mission console": "defense",
  "targeting console": { href: `${V6_BASE}/use-cases/only-the-confirmed-target`, to: "Larkspur, a simulated console Vraelis built" },
};

const orbitEntry = (word: string) => (ORBIT_ROUTE as Readonly<Record<string, SolutionSlug | OrbitRoute | undefined>>)[word];

/** The sector page an orbit word leads to, or undefined for a word that leads elsewhere (release, agent's change,
 *  targeting console) or is not an orbit word. Takes a plain string so the orbit's tile type needs no cast. */
export function orbitSector(word: string): Sector | undefined {
  const r = orbitEntry(word);
  return typeof r === "string" ? sectorBySlug(r) : undefined;
}

/** Where an orbit word's tile leads and the name it prints for that page: a sector page by its menu label, or the
 *  word's own page. Undefined for a word that is not an orbit word. */
export function orbitRoute(word: string): OrbitRoute | undefined {
  const r = orbitEntry(word);
  if (typeof r !== "string") return r;
  const s = sectorBySlug(r);
  return s ? { href: s.href, to: s.label } : undefined;
}

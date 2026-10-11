import { CONTOUR_PAGES } from "./contour";
import { EARLIER_PAGES } from "./earlier";
import { RESEARCH_PAGES } from "./research";
import { PRODUCTS_OVERVIEW, VRAELIS_PAGES } from "./vraelis";
import type { Block, NavTab, Page, Tab, TabId, TocItem } from "./types";

// THE ONE LIST OF DOCS PAGES. The sidebar, the header tabs, the search index, the pager, "On this page", the
// Markdown twins, llms.txt, the assistant's retrieval and generateStaticParams all read PAGES, so a page added here
// appears everywhere. Order matters: the sidebar and the pager follow it within each tab.
//
// The tabs follow the founder's order (2026-10-10): Vraelis first (get started), then Products (Vraelis Contour is
// the one product, under its own heading), then Research, then the earlier references.

export const TABS: Tab[] = [
  { id: "vraelis", label: "Vraelis", to: "/docs", line: "What Vraelis is, how to read these docs, development status, release notes and a glossary." },
  { id: "products", label: "Products", to: "/docs/products", line: "Vraelis Contour, the one product direction: how it works today, what the experiment records, and where it stops." },
  { id: "research", label: "Research", to: "/docs/research", line: "The four research areas and the guides on model releases, operating constraints and AI security evaluation." },
  { id: "earlier", label: "Earlier references", to: "/docs/getting-started", line: "The earlier browser-testing product, kept as history. Not current." },
];

export const PAGES: Page[] = [...VRAELIS_PAGES, PRODUCTS_OVERVIEW, ...CONTOUR_PAGES, ...RESEARCH_PAGES, ...EARLIER_PAGES];

/** Slugs that moved. They redirect permanently (308) to the page that now holds their content.
 *  overview: the Vraelis Contour overview moved to /contour when the docs became Vraelis-first (2026-10-10).
 *  contour-release-security, ai-security: v6 docs whose content was rewritten into that overview. */
export const ALIASES: Record<string, string> = {
  overview: "contour",
  "contour-release-security": "contour",
  "ai-security": "contour",
};

/** The docs home, as the Vraelis tab's first sidebar item (x.ai's "Overview" is its docs home). */
export const HOME = { to: "/docs", label: "Overview", group: "Get started" } as const;

export const getPage = (slug: string) => PAGES.find((p) => p.slug === slug) ?? null;
export const tabOf = (id: TabId) => TABS.find((t) => t.id === id)!;
export const tabPages = (id: TabId) => PAGES.filter((p) => p.tab === id);
export const navLabel = (p: Page) => p.nav ?? p.title;

/** A tab's pages under their section and group headings, in list order. */
export function tabGroups(id: TabId) {
  const groups: { section?: string; group: string; pages: Page[] }[] = [];
  for (const p of tabPages(id)) {
    const g = groups.find((x) => x.group === p.group && x.section === p.section);
    if (g) g.pages.push(p); else groups.push({ section: p.section, group: p.group, pages: [p] });
  }
  return groups;
}

/** The sidebar of every tab, and the Products menu, as plain data for the client header and sidebar. */
export function navModel(): NavTab[] {
  return TABS.map((t) => {
    const groups = tabGroups(t.id).map((g) => ({
      section: g.section, group: g.group,
      items: g.pages.map((p) => ({ to: `/docs/${p.slug}`, label: navLabel(p), badge: p.badge })),
    }));
    if (t.id === "vraelis") groups[0].items.unshift({ to: HOME.to, label: HOME.label, badge: undefined });
    const menu = t.id === "products"
      ? [{ to: "/docs/products", label: "Overview", line: "The one product direction" }, { to: "/docs/contour", label: "Vraelis Contour", line: "Model release security" }]
      : undefined;
    return { id: t.id, label: t.label, to: t.to, groups, menu };
  });
}

/** The breadcrumb above a page's title: its tab, its product heading, its group. */
export function crumbs(page: Page): { label: string; to?: string }[] {
  const tab = tabOf(page.tab);
  const out: { label: string; to?: string }[] = [{ label: tab.label, to: tab.to }];
  if (page.section) out.push({ label: page.section, to: "/docs/contour" });
  if (page.group && page.group !== tab.label && page.group !== page.section) out.push({ label: page.group });
  return out;
}

/** Previous and next within the page's own tab. The pager never crosses into another tab. */
export function adjacent(slug: string) {
  const page = getPage(slug);
  if (!page) return { prev: null, next: null };
  const list = tabPages(page.tab);
  const i = list.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? list[i - 1] : null, next: i < list.length - 1 ? list[i + 1] : null };
}

/** The id a heading gets from its words. */
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Every h2 and h3 with a unique id, in reading order. The renderer and the search index use the same ids. */
export function headingIds(blocks: Block[]): Map<number, string> {
  const ids = new Map<number, string>();
  const seen = new Set<string>();
  blocks.forEach((b, i) => {
    if (b.t !== "h2" && b.t !== "h3") return;
    const base = b.id ?? slugify(b.text);
    let id = base, n = 2;
    while (seen.has(id)) id = `${base}-${n++}`;
    seen.add(id);
    ids.set(i, id);
  });
  return ids;
}

export function outline(page: Page): TocItem[] {
  const ids = headingIds(page.blocks);
  const out: TocItem[] = [];
  page.blocks.forEach((b, i) => {
    if (b.t === "h2" || b.t === "h3") out.push({ id: ids.get(i)!, text: b.text, level: b.t === "h2" ? 2 : 3 });
  });
  return out;
}

/** slug to tab, for the client header and sidebar (they only know the pathname). The home's slug is "". */
export const SLUG_TAB: Record<string, TabId> = Object.fromEntries([
  ["", "vraelis"],
  ...PAGES.map((p) => [p.slug, p.tab]),
  ...Object.entries(ALIASES).map(([from, to]) => [from, getPage(to)!.tab]),
]);

import { CONTOUR_PAGES } from "./contour";
import { EARLIER_PAGES } from "./earlier";
import { RESEARCH_PAGES } from "./research";
import type { Block, Page, Tab, TabId, TocItem } from "./types";

// THE ONE LIST OF DOCS PAGES. The sidebar, the docs bar tabs, the search index, the pager, "On this page",
// the Markdown twins and generateStaticParams all read PAGES, so a page added here appears everywhere.
// Order matters: the sidebar and the pager follow it within each tab.

export const TABS: Tab[] = [
  { id: "contour", label: "Vraelis Contour", line: "How Vraelis Contour works today, what the experiment records, and where it stops." },
  { id: "research", label: "Research", line: "Guidance on model releases, operating constraints and AI security evaluation." },
  { id: "earlier", label: "Earlier references", line: "The earlier browser-testing product, kept as history. Not current." },
];

export const PAGES: Page[] = [...CONTOUR_PAGES, ...RESEARCH_PAGES, ...EARLIER_PAGES];

/** Old v6 slugs whose content now lives on a rewritten page. They redirect permanently. */
export const ALIASES: Record<string, string> = {
  "contour-release-security": "overview",
  "ai-security": "overview",
};

/** The three pages the docs home points a new reader to, in order. */
export const START_HERE = ["overview", "evidence-and-observations", "limits"] as const;

export const getPage = (slug: string) => PAGES.find((p) => p.slug === slug) ?? null;
export const tabOf = (id: TabId) => TABS.find((t) => t.id === id)!;
export const tabPages = (id: TabId) => PAGES.filter((p) => p.tab === id);
export const navLabel = (p: Page) => p.nav ?? p.title;

/** A tab's pages under their group headings, in list order. */
export function tabGroups(id: TabId) {
  const groups: { group: string; pages: Page[] }[] = [];
  for (const p of tabPages(id)) {
    const g = groups.find((x) => x.group === p.group);
    if (g) g.pages.push(p); else groups.push({ group: p.group, pages: [p] });
  }
  return groups;
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

/** slug to tab, for the client docs bar (it only knows the pathname). */
export const SLUG_TAB: Record<string, TabId> = Object.fromEntries([
  ...PAGES.map((p) => [p.slug, p.tab]),
  ...Object.entries(ALIASES).map(([from, to]) => [from, getPage(to)!.tab]),
]);

import type { CaptureName } from "../../_kit/blocks";
import type { Kind } from "../../_kit/site";

// The shapes every docs page is written in. One page list (pages.ts) is built from these, and the sidebar,
// the search index, the pager, "On this page" and the Markdown twins all read that list.
//
// INLINE MARKUP. Text in p, ul, steps, note, kinds, facts and table cells may carry `code` (backticks) and
// [label](href) links, and nothing else. A site path ("/docs/overview") goes through href(); a link to the
// closed console (app.vraelis.com) is dropped, because product access is closed.

/** The docs tabs, in header order: Vraelis (get started), Products, Research. ("earlier" stays in the type for code that still checks it; no page uses it since 2026-10-23.) */
export type TabId = "vraelis" | "products" | "research" | "earlier";

/** The id of the JSON script tag that holds a page's Markdown once, for both Copy for LLM buttons. */
export const MARKDOWN_ID = "v8-docs-markdown";

export type Block = (
  | { t: "p"; text: string }
  | { t: "h2"; text: string; id?: string }
  | { t: "h3"; text: string; id?: string }
  | { t: "ul"; items: string[] }
  | { t: "steps"; items: string[] }
  /** A callout. Every callout is the same filled card; only its label says what kind it is. */
  | { t: "note"; label: string; text: string }
  | { t: "code"; label: string; text: string; lang?: "json" | "bash" | "text" }
  /** Reference rows. The first cell of a row is its header. Cells take inline markup. */
  | { t: "table"; label: string; head: string[]; rows: string[][] }
  /** A real capture of the read-only Contour app (public/v8/contour), with the capture caption. */
  | { t: "capture"; name: CaptureName; caption?: string }
  /** Status lines, each with its kind label (Working in the experiment, Measured, Proposed, ...). */
  | { t: "kinds"; items: { kind: Kind; text: string; label?: string }[] }
  /** Short label and value rows. */
  | { t: "facts"; rows: [string, string][] }
  /** The five-step workflow as a labelled HTML diagram, from WORKFLOW in the kit. */
  | { t: "workflow" }
  /** The kit's status ledger (STATUS in the kit), the one "where we are" list on the site. */
  | { t: "ledger" }
  /** Linked cards to read next. */
  | { t: "cards"; items: { to: string; title: string; line: string }[] }
) & { /** Historical context remains on the page; excluded from current-product aggregates. */ historical?: true };

export type Page = {
  tab: TabId;
  /** A product heading in the sidebar above this page's group (Products > Vraelis Contour). */
  section?: string;
  /** Sidebar group heading. Groups never collapse. Empty: the page sits directly under its section heading. */
  group: string;
  /** A small accent badge on the sidebar item (x.ai's "Latest" and "New"). Only where it is true. */
  badge?: "New" | "Latest";
  slug: string;
  /** The h1 and the page title. */
  title: string;
  /** A shorter sidebar label, when the title is a sentence. */
  nav?: string;
  /** Meta description, and the lead under the title unless `lead` is set. */
  description: string;
  lead?: string;
  blocks: Block[];
  /** Earlier implementation references carry this banner and are noindex. */
  banner?: { label: string; text: string };
  /** Shown as "Last updated" at the foot of current pages. ISO date. */
  updated?: string;
};

export type Tab = {
  id: TabId;
  label: string;
  line: string;
  /** Where the tab goes: a docs path ("/docs" is the docs home). */
  to: string;
};

/** The sidebar and the phone menu, as plain data for the client header (pages.ts navModel). */
export type NavItem = { to: string; label: string; badge?: Page["badge"] };
export type NavGroup = { section?: string; group: string; items: NavItem[] };
/** The sidebar as a tree (founder, 2026-10-12, after Scale's docs): "Get started" first, then main topics as large
 *  headings; under a topic, pages and expandable subtopics that hold the pages. */
export type NavLeaf = { to: string; label: string; badge?: Page["badge"] };
export type NavBranch = { label: string; items: NavLeaf[] };
export type NavTopic = { title: string; items: (NavLeaf | NavBranch)[] };
export type NavTab = { id: TabId; label: string; to: string; groups: NavGroup[]; topics: NavTopic[]; menu?: { to: string; label: string; line: string }[] };

export type TocItem = { id: string; text: string; level: 2 | 3 };

/** One section of one page in the search index: built at build time by the search-index route. */
export type SearchEntry = {
  id: string;
  tab: TabId;
  slug: string;
  page: string;
  /** The section heading, or the page title for the page's opening. */
  title: string;
  /** Tab, page and parent heading, joined with " › ". */
  crumb: string;
  anchor: string;
  /** Plain text of the section, for matching and the snippet. */
  text: string;
  /** The section as Markdown, for the preview pane. */
  md: string;
};

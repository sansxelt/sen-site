import { CAPTURES, captureSrc } from "../../_kit/blocks";
import { CAPTURE_CAPTION, KIND_LABEL, STATUS, WORKFLOW } from "../../_kit/site";
import { PAGES, TABS, headingIds, tabOf } from "./pages";
import type { Block, Page, SearchEntry } from "./types";
import { DOCS_ORIGIN, SITE_ORIGIN } from "@/lib/docs-host";

// Text forms of the docs: inline markup parsing, the Markdown twins (and Copy for LLM), plain text, and the
// section-level search index. Everything is derived from PAGES, so the twin and the page cannot disagree.

const SITE = SITE_ORIGIN;
/** A site path as an absolute address: docs paths on the docs' own host (lib/docs-host.ts), the rest on the main site. */
const abs = (path: string) => (path === "/docs" || path.startsWith("/docs/") || path.startsWith("/docs#") ? DOCS_ORIGIN + (path.slice(5) || "/") : SITE + path);

export type Inline = { k: "text"; s: string } | { k: "code"; s: string } | { k: "link"; s: string; href: string };
const INLINE_RE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Splits a line of docs text into plain text, `code` and [label](href) links. */
export function inline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ k: "text", s: text.slice(last, at) });
    out.push(m[1] !== undefined ? { k: "code", s: m[1] } : { k: "link", s: m[2], href: m[3] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ k: "text", s: text.slice(last) });
  return out;
}

/** Links into the closed console (app.vraelis.com) are dropped: product access is closed, and a call to action
 *  such as "Create an API key" would point at something nobody can open. */
export const isClosedProduct = (href: string) => /^https?:\/\/app\.vraelis\.com/.test(href);

function inlineMd(text: string): string {
  return inline(text).map((x) => {
    if (x.k === "code") return `\`${x.s}\``;
    if (x.k === "link") {
      if (isClosedProduct(x.href)) return "";
      return `[${x.s}](${x.href.startsWith("/") ? abs(x.href) : x.href})`;
    }
    return x.s;
  }).join("").trimEnd();
}
export function inlinePlain(text: string): string {
  return inline(text).map((x) => (x.k === "link" && isClosedProduct(x.href) ? "" : x.s)).join("").trimEnd();
}
const cell = (s: string) => inlineMd(s).replace(/\|/g, "\\|");

/** One block as Markdown lines. */
function blockMd(b: Block): string[] {
  switch (b.t) {
    case "p": return [inlineMd(b.text)];
    case "h2": return [`## ${b.text}`];
    case "h3": return [`### ${b.text}`];
    case "ul": return b.items.map((i) => `- ${inlineMd(i)}`);
    case "steps": return b.items.map((i, n) => `${n + 1}. ${inlineMd(i)}`);
    case "note": return [`> **${b.label.replace(/[.:]$/, "")}.** ${inlineMd(b.text)}`];
    case "code": return [`${b.label}:`, "", "```" + (b.lang && b.lang !== "text" ? b.lang : ""), b.text, "```"];
    case "table": return [`| ${b.head.map(cell).join(" | ")} |`, `| ${b.head.map(() => "---").join(" | ")} |`, ...b.rows.map((r) => `| ${r.map(cell).join(" | ")} |`)];
    case "capture": {
      const c = CAPTURES[b.name];
      return [`![${c.alt}](${SITE}${captureSrc(b.name)})`, "", `*${b.caption ?? CAPTURE_CAPTION}*`];
    }
    case "kinds": return b.items.map((i) => `- **${i.label ?? KIND_LABEL[i.kind]}:** ${inlineMd(i.text)}`);
    case "facts": return b.rows.map(([k, v]) => `- **${k}:** ${inlineMd(v)}`);
    case "workflow": return [`*Diagram of the five-step workflow: ${WORKFLOW.map((w) => `${w.n} ${w.title}`).join(", then ")}.*`];
    case "ledger": return [
      "**Working in the experiment**", "", ...STATUS.working.map((i) => `- ${i}`), "",
      "**Being built**", "", ...STATUS.building.map((i) => `- ${i}`), "",
      "**Not claimed**", "", ...STATUS.notClaimed.map((i) => `- ${i}`),
    ];
    case "cards": return b.items.map((i) => `- [${i.title}](${abs(i.to)}): ${i.line}`);
  }
}

function blocksMd(blocks: Block[]): string {
  return blocks.map((b) => blockMd(b).join("\n")).join("\n\n");
}

/** The page as Markdown: what "View as Markdown" serves and "Copy for LLM" copies. */
export function pageMarkdown(page: Page): string {
  const tab = tabOf(page.tab);
  const out = [`# ${page.title}`, ""];
  if (page.banner) out.push(`> **${page.banner.label.replace(/[.:]$/, "")}.** ${page.banner.text}`, "");
  out.push(page.lead ?? page.description, "", blocksMd(page.blocks), "", "---", "",
    `Vraelis documentation, ${tab.label}. ${DOCS_ORIGIN}/${page.slug}`);
  return out.join("\n") + "\n";
}

/** The docs index in the llms.txt format (llmstxt.org): a title, a one-line summary, then every page by tab with
 *  its Markdown twin. Served as /llms.txt on the docs host and as md/index.md; both are this one string. */
export function indexMarkdown(): string {
  const out = [
    "# Vraelis documentation", "",
    "> Vraelis develops cybersecurity software for AI in defense, critical infrastructure and autonomous systems. These docs cover Vraelis, its one product direction (Vraelis Contour, model release security from approval to reported runtime state), its research, and earlier implementation references kept as history.", "",
    "Vraelis Contour is not for public use: it is built for release, platform and security engineers at suppliers and system integrators. Every page labels each claim as working in the experiment, measured, proposed, hypothesis or not claimed.", "",
    `- [Docs home](${DOCS_ORIGIN}/): Get started with Vraelis.`, "",
  ];
  for (const t of TABS) {
    out.push(`## ${t.id === "earlier" ? "Optional: earlier references (not current)" : t.label}`, "", t.line, "");
    for (const p of PAGES.filter((x) => x.tab === t.id)) out.push(`- [${p.title}](${DOCS_ORIGIN}/${p.slug}) ([Markdown](${DOCS_ORIGIN}/md/${p.slug}.md)): ${p.description}`);
    out.push("");
  }
  return out.join("\n") + "\n";
}

/** One block as plain text, for search matching and snippets. */
function blockPlain(b: Block): string {
  switch (b.t) {
    case "p": return inlinePlain(b.text);
    case "h2": case "h3": return b.text;
    case "ul": case "steps": return b.items.map(inlinePlain).join(" ");
    case "note": return `${b.label} ${inlinePlain(b.text)}`;
    case "code": return `${b.label} ${b.text}`;
    case "table": return [b.head.join(" "), ...b.rows.map((r) => r.map(inlinePlain).join(" "))].join(" ");
    case "capture": return `${CAPTURES[b.name].alt} ${b.caption ?? CAPTURE_CAPTION}`;
    case "kinds": return b.items.map((i) => `${i.label ?? KIND_LABEL[i.kind]}: ${inlinePlain(i.text)}`).join(" ");
    case "facts": return b.rows.map(([k, v]) => `${k}: ${inlinePlain(v)}`).join(" ");
    case "workflow": return WORKFLOW.map((w) => `${w.title}. ${w.body}`).join(" ");
    case "ledger": return [...STATUS.working, ...STATUS.building, ...STATUS.notClaimed].join(". ");
    case "cards": return b.items.map((i) => `${i.title}. ${i.line}`).join(" ");
  }
}

/** The section-level search index: one entry for each page's opening and one for each h2 and h3. */
export function buildSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const page of PAGES) {
    const tab = tabOf(page.tab).label;
    const ids = headingIds(page.blocks);
    type Sec = { title: string; anchor: string; parent?: string; blocks: Block[]; lead?: string };
    const secs: Sec[] = [{ title: page.title, anchor: "", blocks: [], lead: page.lead ?? page.description }];
    let h2: string | undefined;
    page.blocks.forEach((b, i) => {
      if (b.t === "h2") { h2 = b.text; secs.push({ title: b.text, anchor: ids.get(i)!, blocks: [] }); return; }
      if (b.t === "h3") { secs.push({ title: b.text, anchor: ids.get(i)!, parent: h2, blocks: [] }); return; }
      secs[secs.length - 1].blocks.push(b);
    });
    for (const s of secs) {
      const text = [s.lead, ...s.blocks.map(blockPlain)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const md = [s.lead ? inlineMd(s.lead) : "", blocksMd(s.blocks)].filter(Boolean).join("\n\n");
      if (!text && s.anchor) continue;
      out.push({
        id: `${page.slug}#${s.anchor}`, tab: page.tab, slug: page.slug, page: page.nav ?? page.title,
        title: s.title, anchor: s.anchor,
        crumb: [tab, page.nav ?? page.title, ...(s.anchor ? [s.parent].filter(Boolean) as string[] : [])].join(" › "),
        text, md,
      });
    }
  }
  return out;
}

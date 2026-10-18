// THE MACHINE-READABLE ENTRY POINTS WHEN V8 IS THE SITE (/llms.txt, /llms-full.txt, /sitemap.xml).
//
// Codex's review of the v8 preview (2026-10-10) found the root llms files still built from v6 content and the
// sitemap still listing earlier routes such as /free-report and /how-it-works, while the human pages and the docs
// had moved on. These are now built from the same registries the pages render from: the menus and footer for the
// site's pages, the partners list, and the docs page registry. A page added to the nav or the docs appears here;
// one removed stops appearing. The root route handlers use this only when NEXT_PUBLIC_VRAELIS_V8_PUBLIC is on.
import { DOCS_ORIGIN, SITE_ORIGIN } from "@/lib/docs-host";
import { ARTICLES } from "../_content/articles";
import { PARTNERS } from "../_content/partners";
import { PAGES } from "../docs/_data/pages";
import { indexMarkdown, pageMarkdown } from "../docs/_data/text";
import { COMPANY_LINE, FOOTER, MENUS, TAGLINE } from "./site";

export const v8IsSite = () => process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1";

/** Every page of the marketing site, with the label the site gives it, home first, docs excluded (they are listed
 *  from the docs registry). */
export function sitePages(): { path: string; label: string }[] {
  const seen = new Map<string, string>([["/", "Home"]]);
  const add = (to: string, label: string) => {
    const path = to.split(/[?#]/)[0];
    if (!path.startsWith("/") || path === "/docs" || path.startsWith("/docs/") || seen.has(path)) return;
    seen.set(path, label);
  };
  add("/contact", "Contact"); // The header CTA remains even when Contact is absent from footer navigation.
  for (const m of MENUS) for (const l of m.links) add(l.to, l.label === "All research" ? "Research" : l.label === "All applications" ? "Applications" : l.label === "Overview" ? (m.id === "contour" ? "Vraelis Contour" : m.label) : l.label);
  for (const col of FOOTER) for (const l of col.links) add(l.to, l.label);
  for (const p of PARTNERS) add(`/partners/${p.slug}`, `${p.name} partnership — ${p.focus}`);
  add("/news", "News");
  for (const a of ARTICLES) add(`/news/${a.slug}`, a.title);
  return [...seen].map(([path, label]) => ({ path, label }));
}

/** Public relationship summaries share the exact page registry and dates. */
function partnershipMarkdown(): string {
  return ["## Official partnerships", "",
    ...PARTNERS.flatMap((p) => [
      `### ${p.title}`, "", p.lede, "",
      `Established: ${p.established}. Focus: ${p.focus}.`, "",
      ...p.means.map((m) => `- ${m}`), "",
      `Record: ${SITE_ORIGIN}/partners/${p.slug}`, "",
    ]),
    "These partnerships concern Vraelis’s company activities. Vraelis Contour remains in private development.", "",
  ].join("\n");
}

/** Current docs pages; the earlier references are history, kept out of the indexes as they are out of Ask AI. */
const currentDocs = () => PAGES.filter((p) => p.tab !== "earlier");

export function llmsTxt(): string {
  const docsIndex = indexMarkdown().split("\n").slice(2).join("\n"); // drop its own title; keep its summary and lists
  return [
    "# Vraelis", "",
    `> ${TAGLINE}`, "",
    `${COMPANY_LINE} Vraelis Contour, model release security from approval to reported runtime state, is its first product direction. It has private access and is built for release, platform and security engineers at suppliers and system integrators. Additional public products are being researched; no additional public product or name has been adopted. What exists today is a controlled synthetic ONNX CPU reference experiment and a read-only evidence app over the trace it recorded.`, "",
    "## Site", "",
    ...sitePages().map((p) => `- [${p.label}](${SITE_ORIGIN}${p.path === "/" ? "/" : p.path})`), "",
    partnershipMarkdown(),
    "## Documentation", "",
    docsIndex.trim(), "",
  ].join("\n");
}

export function llmsFullTxt(): string {
  const intro = [
    "# Vraelis", "", `> ${TAGLINE}`, "",
    "The current documentation in full, as Markdown. Every claim is labelled as working in the experiment, measured, proposed, hypothesis or not claimed.", "",
    `Site: ${SITE_ORIGIN}/  Documentation: ${DOCS_ORIGIN}/`, "",
  ].join("\n");
  return `${intro}\n${partnershipMarkdown()}\n---\n\n${currentDocs().map((page) => pageMarkdown(page, { currentOnly: true })).join("\n---\n\n")}`;
}

/** Sitemap entries: the site's pages, then the docs home and every current docs page. */
export function sitemapEntries(): { url: string; priority: number }[] {
  const site = sitePages().map((p) => ({ url: `${SITE_ORIGIN}${p.path === "/" ? "/" : p.path}`, priority: p.path === "/" ? 1 : p.path === "/contour" ? .9 : .6 }));
  const docs = [{ url: `${DOCS_ORIGIN}/`, priority: .7 }, ...currentDocs().map((p) => ({ url: `${DOCS_ORIGIN}/${p.slug}`, priority: .5 }))];
  return [...site, ...docs];
}


import { PAGES, getPage } from "../../_data/pages";
import { indexMarkdown, pageMarkdown } from "../../_data/text";

// THE MARKDOWN TWINS. /docs/md/<slug>.md serves a page as text/markdown (what "View as Markdown" opens and
// "Copy for LLM" copies), and /docs/md/index.md lists every page. Built at build time from the same page list
// as the articles, so a twin cannot drift from its page.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ file: "index.md" }, ...PAGES.map((p) => ({ file: `${p.slug}.md` }))];
}

const v8Public = process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const headers = (index: boolean) => ({
    "content-type": "text/markdown; charset=utf-8",
    "x-robots-tag": v8Public && index && !process.env.VRAELIS_REVIEW_LABEL ? "all" : "noindex",
  });
  if (file === "index.md") return new Response(indexMarkdown(), { headers: headers(true) });
  const page = file.endsWith(".md") ? getPage(file.slice(0, -3)) : null;
  if (!page) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(pageMarkdown(page), { headers: headers(page.tab !== "earlier") });
}

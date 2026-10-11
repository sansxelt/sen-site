import { buildSearchIndex } from "../_data/text";

// The section-level search index, built at build time from the docs page list and fetched by the search
// modal the first time it opens. No extension in the path on purpose: proxy.ts skips .json paths, so a
// promoted clean path /docs/search-index can still be rewritten here.
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildSearchIndex(), { headers: { "x-robots-tag": "noindex" } });
}

import { indexMarkdown } from "../_data/text";

// /llms.txt on docs.vraelis.com (proxy.ts sends it here; on the main host /llms.txt stays the site's own), and
// /dev-preview/v8/docs/llms.txt on the main host. The same index as md/index.md, in the llms.txt format.
export const dynamic = "force-static";

const v8Public = process.env.NEXT_PUBLIC_VRAELIS_V8_PUBLIC === "1";

export function GET() {
  return new Response(indexMarkdown(), {
    headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": v8Public && !process.env.VRAELIS_REVIEW_LABEL ? "all" : "noindex" },
  });
}

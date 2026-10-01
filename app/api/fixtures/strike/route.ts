// GET /api/fixtures/strike?mode=broken|fixed — the simulated mission console Vraelis demonstrates
// high-stakes checks on. Static and data-free: the page and its simulated contacts live entirely in the
// visitor's browser. See lib/fixtures/strike-console.ts for the one bug it carries and why.
import { strikeConsoleHtml, type StrikeMode } from "@/lib/fixtures/strike-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const mode: StrikeMode = new URL(req.url).searchParams.get("mode") === "fixed" ? "fixed" : "broken";
  return new Response(strikeConsoleHtml(mode), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}

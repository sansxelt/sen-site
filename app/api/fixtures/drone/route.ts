// GET /api/fixtures/drone?mode=broken|fixed — the simulated drone console Vraelis demonstrates connected
// devices on. Static and data-free: the page and its simulated aircraft live entirely in the visitor's
// browser. See lib/fixtures/drone-console.ts for the one bug it carries and why.
import { droneConsoleHtml, type DroneMode } from "@/lib/fixtures/drone-console";

export const runtime = "nodejs";
// Dynamic, because the mode is read from the query string, which a statically generated response would not
// see. The cache header below keeps it cheap.
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const mode: DroneMode = new URL(req.url).searchParams.get("mode") === "fixed" ? "fixed" : "broken";
  return new Response(droneConsoleHtml(mode), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-robots-tag": "noindex",
    },
  });
}

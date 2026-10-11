// GET /cli/vraelis.mjs — RETIRED 2026-10-11.
//
// This served cli/vraelis.mjs, the command line tool of an earlier product that is retired; the installers that
// fetched it (/install, /install.ps1) already answer 410. The download now answers 410 Gone with the same
// plain-text notice, so `curl -fO` exits non-zero and nothing is saved. Dynamic and no-store so no CDN or
// browser keeps serving the old file (the previous build cached it publicly for up to an hour, then
// stale-while-revalidate). proxy.ts still passes this path straight through. cli/vraelis.mjs stays in the repo.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(
    "The Vraelis CLI was part of an earlier product that is retired. This download is no longer available. https://vraelis.com\n",
    { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}

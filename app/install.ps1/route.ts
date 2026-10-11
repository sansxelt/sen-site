// GET /install.ps1 — RETIRED 2026-10-11.
//
// This used to serve cli/install.ps1 for `irm https://vraelis.com/install.ps1 | iex`. The Vraelis CLI belonged
// to an earlier product that is retired, so the installer now answers 410 Gone with a plain-text notice.
// Invoke-RestMethod throws on a 4xx, so a piped `| iex` executes nothing.
// Dynamic and no-store so no CDN or browser keeps serving the old script. cli/install.ps1 stays in the repo.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(
    "The Vraelis CLI was part of an earlier product that is retired. This installer is no longer available. https://vraelis.com\n",
    { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}

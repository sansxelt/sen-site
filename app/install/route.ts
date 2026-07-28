// GET /install — the installer, so getting the CLI is one line.
//
//   curl -fsS https://vraelis.com/install | sh
//
// Same shape and the same reasoning as /cli/vraelis.mjs: served from the source file in cli/install.sh so
// there is no second copy to drift, traced into the bundle by next.config.ts because nothing imports it,
// and public because a CI runner is the caller that most needs it and has no session.
//
// ON PIPING A SCRIPT TO A SHELL. It is what Rust, Homebrew, Deno, Bun and Cursor all do, and it is a real
// decision rather than a default: anyone who runs this is trusting this domain and its TLS. The script is
// written to deserve that. It needs no sudo, installs one file plus a shim into the user's own
// ~/.local/bin, refuses rather than half-installing, and does not edit anyone's shell profile. Reading it
// first is one word shorter than running it, and the docs say so.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
// Prerendered at build from the same checkout as the rest of the deploy, revalidated hourly. Same as the
// CLI route: the served script and the repo's script cannot be from different commits.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  try {
    const src = await readFile(join(process.cwd(), "cli", "install.sh"), "utf8");
    return new Response(src, {
      headers: {
        // text/plain so a browser shows it instead of downloading it. Someone who wants to read the script
        // before running it should not have to fish it out of their downloads folder.
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Not found.\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

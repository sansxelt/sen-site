// GET /install.ps1 — the Windows installer.
//
//   irm https://vraelis.com/install.ps1 | iex
//
// /install serves a POSIX sh script, and `sh` does not exist in cmd.exe or PowerShell. So the documented
// install line failed with "sh is not recognized" for every Windows developer who followed it, on the one
// platform where the failure looks like the product is broken rather than like a missing shell.
//
// Same shape as the other two file routes: served from its source in cli/install.ps1 so there is no second
// copy to drift, traced into the bundle by next.config.ts because nothing imports it, and public because a
// CI runner is the caller that most needs it and has no session.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
// Prerendered at build from the same checkout as the rest of the deploy, revalidated hourly, exactly as
// /install and /cli/vraelis.mjs are. The served script and the repo's script cannot be from different
// commits.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  try {
    const src = await readFile(join(process.cwd(), "cli", "install.ps1"), "utf8");
    return new Response(src, {
      headers: {
        // text/plain so a browser shows it rather than downloading it. Someone who wants to read a script
        // before piping it into their shell should not have to fish it out of a downloads folder.
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Not found.\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

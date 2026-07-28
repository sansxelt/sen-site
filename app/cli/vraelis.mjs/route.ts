// GET /cli/vraelis.mjs — the command line tool, as a file a customer can actually obtain.
//
// The developer page told people to run `node ./cli/vraelis.mjs`, a path inside this repository. Customers
// do not have this repository. The comment in cli-section.tsx was right that `npm i -g vraelis` would be a
// lie, since cli/package.json is `private: true` and nothing has ever been published, but "it ships in the
// Vraelis repo" was not an install instruction either. It was a description of where the file lives for
// the people who already have it.
//
// So the file is served. One command, no account needed to fetch it, no npm decision required:
//
//   curl -O https://vraelis.com/cli/vraelis.mjs
//   node vraelis.mjs verify --url ... --claim "..." --wait
//
// SERVED FROM THE SOURCE FILE, NOT A COPY. A copy under public/ would be a second artifact that drifts the
// first time someone edits the CLI and forgets it, and a stale CLI is worse than none: it would keep
// working against an API that had moved on. next.config.ts traces cli/vraelis.mjs into this route's bundle
// so the single source ships with it.
//
// Public on purpose. The tool carries no secret; it reads VRAELIS_API_KEY from the caller's environment
// and every call it makes is authenticated by that key. Gating the download behind a session would mean a
// CI runner could not fetch it, which is the one place it most needs to be fetchable.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
// PRERENDERED AT BUILD, revalidated hourly. The build output confirms it: ○ /cli/vraelis.mjs, not ƒ.
//
// That means readFile below runs when the site is built, from the same checkout that produced the rest of
// the deploy, so the served file and the repo's file can never be from different commits. The hourly
// revalidation can regenerate it on the server, which is why cli/vraelis.mjs still has to be traced into
// this route's bundle in next.config.ts even though the happy path never reads it at runtime.
//
// Worth knowing: proxy.ts never sees this request. Its matcher deliberately skips a fixed list of asset
// extensions and .mjs is one of them, so no redirect, rewrite or host rule can intercept the download.
// That is the behaviour we want here, and it is luck rather than design, so it is written down.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  try {
    const src = await readFile(join(process.cwd(), "cli", "vraelis.mjs"), "utf8");
    return new Response(src, {
      headers: {
        // text/plain, not application/javascript: this is a file to save, and a browser that decides to
        // execute a script it just downloaded is not a thing anyone wants.
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'inline; filename="vraelis.mjs"',
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    // A 404 rather than a 500 with a stack in it. If tracing ever drops the file, the honest answer is that
    // this address has nothing at it, and the guard in scripts/cli-verify-test.mjs fails the build first.
    return new Response("Not found.\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

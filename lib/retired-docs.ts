// RETIRED DOCS (founder, 2026-10-23, after Google's AI overview still described the earlier browser-testing product:
// "remove everything fully ... keep as old but not existing"). The 18 "Earlier references" pages are no longer
// served. Their addresses answer 410 Gone, which tells search engines the pages were removed on purpose, so they
// drop out faster than a noindex page does. The pages remain in the repository's history (git log on
// app/dev-preview/v8/docs/_data/earlier.ts), not on the site.

export const RETIRED_DOC_SLUGS: ReadonlySet<string> = new Set([
  "getting-started", "the-loop", "what-you-can-check",
  "ai-assistants", "cli", "api", "ci", "webhooks",
  "review", "run-activity", "completion", "findings", "repair", "recheck",
  "systems", "guarantees", "memory",
  "recorded-reports",
]);

/** The retired slug a path names, on the docs host ("/cli", "/md/cli.md") or the main host ("/docs/cli",
 *  "/docs/md/cli.md"); otherwise null. */
export function retiredDocSlug(path: string, docsHost: boolean): string | null {
  const parts = path.split("/").filter(Boolean);
  const rest = docsHost ? parts : parts[0] === "docs" ? parts.slice(1) : null;
  if (!rest) return null;
  if (rest.length === 1 && RETIRED_DOC_SLUGS.has(rest[0])) return rest[0];
  if (rest.length === 2 && rest[0] === "md" && rest[1].endsWith(".md") && RETIRED_DOC_SLUGS.has(rest[1].slice(0, -3))) return rest[1].slice(0, -3);
  return null;
}

export function retiredDocResponse(): Response {
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page removed | Vraelis</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;background:#0a0a0b;color:#e8e8ea"><h1 style="font-weight:500">This page was removed</h1><p>It described an earlier Vraelis product that has been retired. Vraelis now builds AI security software: <a style="color:#fff" href="https://vraelis.com/contour">Vraelis Contour</a> and the open-source <a style="color:#fff" href="https://github.com/sansxelt/vraelis-cli">Vraelis Prompto</a>.</p><p><a style="color:#fff" href="https://docs.vraelis.com/">Current documentation</a></p></body></html>`;
  return new Response(body, { status: 410, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "public, max-age=3600" } });
}

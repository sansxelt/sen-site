import { href, localHref } from "../../_kit/site";
import { siteForward } from "./forwards";

// DOCS LINKS ON TWO HOSTS. The docs render at /dev-preview/v8/docs on the main host and at the root of
// docs.vraelis.com (lib/docs-host.ts). Every link a docs page draws goes through docsLink(), given `main`: the main
// site's origin when the page is being served on the docs host, null on the main host.
//
//   main host   /docs/limits -> /dev-preview/v8/docs/limits (href(), so the docs' public address once v8 is public)
//   docs host   /docs/limits -> /limits, /docs -> /, and any other site path -> the main site, absolute
//
// Pure, so the server components and the client components share it.

export function docsLink(to: string, main: string | null): string {
  if (!to.startsWith("/")) return to;
  // A docs page that now lives on the site: link to the site page itself, not through the redirect.
  const fwd = siteForward(to);
  if (fwd) return docsLink(fwd + (to.match(/[?#].*$/)?.[0] ?? ""), main);
  if (!main) return href(to);
  const cut = to.search(/[?#]/);
  const path = cut < 0 ? to : to.slice(0, cut);
  const tail = cut < 0 ? "" : to.slice(cut);
  if (path === "/docs" || path === "/docs/") return `/${tail}`;
  if (path.startsWith("/docs/")) return path.slice("/docs".length) + tail;
  return main + localHref(to);
}

/** An endpoint the docs call from the browser (the search index, Ask AI): always on the host the page came from, never
 *  rewritten to the docs' public address, so the request stays same-origin. */
export function docsEndpoint(to: string, main: string | null): string {
  if (main) return to.slice("/docs".length) || "/";
  return localHref(to);
}

/** The docs home's own path on the current host, which the header and sidebar compare the pathname against. */
export const docsBase = (main: string | null) => (main ? "" : localHref("/docs"));

/** Whether a docs path is a file (a Markdown twin, llms.txt): opened as a document, not through the client router. */
export const isDocsFile = (to: string) => /\.(md|txt)(?:$|[?#])/.test(to);

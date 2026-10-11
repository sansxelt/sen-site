import { href } from "../../_kit/site";

// DOCS LINKS ON TWO HOSTS. The docs render at /dev-preview/v8/docs on the main host and at the root of
// docs.vraelis.com (lib/docs-host.ts). Every link a docs page draws goes through docsLink(), given `main`: the main
// site's origin when the page is being served on the docs host, null on the main host.
//
//   main host   /docs/limits -> /dev-preview/v8/docs/limits (href(), unchanged)
//   docs host   /docs/limits -> /limits, /docs -> /, and any other site path -> the main site, absolute
//
// Pure, so the server components and the client components share it.

export function docsLink(to: string, main: string | null): string {
  if (!to.startsWith("/")) return to;
  if (!main) return href(to);
  const cut = to.search(/[?#]/);
  const path = cut < 0 ? to : to.slice(0, cut);
  const tail = cut < 0 ? "" : to.slice(cut);
  if (path === "/docs" || path === "/docs/") return `/${tail}`;
  if (path.startsWith("/docs/")) return path.slice("/docs".length) + tail;
  return main + href(to);
}

/** The docs home's own path on the current host, which the docs bar compares the pathname against. */
export const docsBase = (main: string | null) => (main ? "" : href("/docs"));

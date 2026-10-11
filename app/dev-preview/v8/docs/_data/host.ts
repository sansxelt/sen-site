import { headers } from "next/headers";
import { cache } from "react";
import { DOCS_MAIN_HEADER, validMainOrigin } from "@/lib/docs-host";
import { docsLink } from "./links";

// Which host is this docs request on? (Server only.) proxy.ts puts the main site's origin in a request header when
// the request came in on docs.vraelis.com. loadDocsHost() reads it once per request into a request-scoped slot
// (React cache), and the synchronous server components below a page (Article, Blocks, the sidebar) read the slot
// through dl(). Every entry point (the v8 layout, the docs layout, each docs page) awaits loadDocsHost() before it
// renders, so the slot is filled before any child reads it; unfilled, it means the main host, the safe default.

const slot = cache(() => ({ main: null as string | null }));

export async function loadDocsHost(): Promise<string | null> {
  const main = validMainOrigin((await headers()).get(DOCS_MAIN_HEADER));
  slot().main = main;
  return main;
}

/** The main site's origin when serving the docs host, else null. */
export const docsHostMain = () => slot().main;

/** A docs link for the current request's host. */
export const dl = (to: string) => docsLink(to, slot().main);

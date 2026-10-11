"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { docsBase, docsEndpoint, docsLink, isDocsFile } from "../_data/links";
import type { TabId } from "../_data/types";

// The docs' client side of the two hosts (see _data/links.ts). The docs layout provides `main`, the main site's
// origin on docs.vraelis.com and null on the main host, so the header, sidebar, search and the assistant link
// correctly on either.

const MainOrigin = createContext<string | null>(null);

export function DocsHostProvider({ main, children }: { main: string | null; children: ReactNode }) {
  return <MainOrigin.Provider value={main}>{children}</MainOrigin.Provider>;
}

export const useDocsMain = () => useContext(MainOrigin);

export function useDocsLink() {
  const main = useDocsMain();
  return useCallback((to: string) => docsLink(to, main), [main]);
}

/** A browser fetch target (search index, Ask AI), same-origin on either host. */
export function useDocsEndpoint() {
  const main = useDocsMain();
  return useCallback((to: string) => docsEndpoint(to, main), [main]);
}

/** Where the reader is: the docs page's slug ("" for the docs home, null outside the docs) and its tab. */
export function useDocsPlace(slugTab: Record<string, TabId>) {
  const pathname = usePathname();
  const base = docsBase(useDocsMain());
  const home = base || "/";
  const slug = pathname === home ? "" : pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/")[0] : null;
  return { pathname, slug, tab: slug === null ? undefined : slugTab[slug] };
}

/** A link that may leave this host (the main site from docs.vraelis.com) or open a file: a plain anchor then,
 *  the client router otherwise. `to` is already resolved for the host. */
export function Go({ to, className, children, onClick, ...rest }: { to: string; className?: string; children: ReactNode; onClick?: () => void; "aria-current"?: "page" | "true"; role?: string; title?: string }) {
  if (/^https?:\/\//.test(to) || isDocsFile(to)) return <a href={to} className={className} onClick={onClick} {...rest}>{children}</a>;
  return <Link href={to} className={className} onClick={onClick} {...rest}>{children}</Link>;
}

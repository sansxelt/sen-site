"use client";

import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { isAppPath } from "@/lib/app-routes";
import { V6_BASE, V6_APP, v6SignInPath } from "@/lib/v6-routes";

const MarketingSession = createContext(false);

export function EntryNavigation({ authed, children }: { authed: boolean; children: ReactNode }) {
  return <MarketingSession.Provider value={authed}>{children}</MarketingSession.Provider>;
}

export function useMarketingSession() {
  return useContext(MarketingSession);
}

/** Signed-out product links open sign-in directly and keep their intended destination. */
export function useMarketingHref(href: string) {
  const authed = useMarketingSession();
  if (authed) return href;
  if (href.startsWith("https://app.vraelis.com/")) {
    const url = new URL(href);
    return v6SignInPath(`/app${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`);
  }
  const path = V6_BASE && href.startsWith(`${V6_BASE}/`) ? href.slice(V6_BASE.length) : href;
  if (path.startsWith("/") && isAppPath(path.split(/[?#]/)[0])) return v6SignInPath(href);
  return href;
}

export function useAppEntry() {
  return useMarketingHref(V6_APP);
}

export function MarketingLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const destination = useMarketingHref(href);
  return <Link {...props} href={destination} />;
}

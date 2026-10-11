"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { Mark, Wordmark } from "../../_kit/logo";
import { href } from "../../_kit/site";
import { ThemeToggle } from "../../_kit/theme";
import { docsLink } from "../_data/links";

// The docs' client side of the two hosts (see _data/links.ts). The docs layout provides `main`, the main site's
// origin on docs.vraelis.com and null on the main host, so the docs bar, search and the assistant link correctly.

const MainOrigin = createContext<string | null>(null);

export function DocsHostProvider({ main, children }: { main: string | null; children: ReactNode }) {
  return <MainOrigin.Provider value={main}>{children}</MainOrigin.Provider>;
}

export const useDocsMain = () => useContext(MainOrigin);

export function useDocsLink() {
  const main = useDocsMain();
  return useCallback((to: string) => docsLink(to, main), [main]);
}

function OutArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

/** The docs host's own header (docs.vraelis.com): the Vraelis lockup with "Docs" going to the docs home, and the
 *  way back to the main site. The docs bar with the sections, search and Ask AI sits under it, as on the main host. */
export function DocsHostHeader({ main }: { main: string }) {
  return (
    <>
      <a className="v8-skip" href="#v8-main">Skip to content</a>
      <header className="v8-header v8-dh">
        <div className="v8-wrap v8-wrap--frame v8-header__bar">
          <Link href="/" className="v8-dh__brand" aria-label="Vraelis documentation home">
            <span className="v8-dh__mark"><Mark /></span>
            <Wordmark height={14.25} />
            <span className="v8-dh__docs">Docs</span>
          </Link>
          <div className="v8-dh__end">
            <ThemeToggle />
            <a className="v8-dh__plain" href={main + href("/contact")}>Contact</a>
            <a className="v8-btn v8-btn--soft v8-btn--sm v8-dh__home" href={main + href("/")}>
              <span>vraelis.com</span><OutArrow />
            </a>
          </div>
        </div>
      </header>
    </>
  );
}

/** The docs host's footer: short, every link absolute to the main site. */
export function DocsHostFooter({ main }: { main: string }) {
  const links = [
    { label: "Vraelis Contour", to: "/contour" },
    { label: "Security", to: "/security" },
    { label: "Privacy", to: "/privacy" },
    { label: "Subprocessors", to: "/subprocessors" },
    { label: "Terms", to: "/terms" },
  ];
  return (
    <footer className="v8-dh-foot">
      <div className="v8-wrap v8-wrap--frame v8-dh-foot__in">
        <p>© 2026 Vraelis. Documentation for Vraelis Contour and our research.</p>
        <nav aria-label="Footer">
          <a href={main + href("/")}>vraelis.com</a>
          {links.map((l) => <a key={l.to} href={main + href(l.to)}>{l.label}</a>)}
          <PrivacyChoicesButton />
        </nav>
      </div>
    </footer>
  );
}

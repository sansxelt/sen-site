"use client";

// Global closing scene and institutional footer, shared by every public route. The closing resolves the
// responsibility introduced in the homepage opening into a settled state, so the page ends its own story
// rather than parking a card above the footer.
import { useRef } from "react";
import Link from "next/link";
import { CTA } from "./ui";
import { CLOSE_TITLE, CLOSE_SAY } from "./positioning";
import { useScrollProgress, entryProgress } from "./progress";
import { Spectral } from "./spectral";
import "./close.css";
import { V6_BASE } from "@/lib/v6-routes";
import { FOOTER_STATEMENT } from "./positioning";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

const BASE = V6_BASE;
export function ClosingScene({
  title = CLOSE_TITLE,
  say = CLOSE_SAY,
}: {
  title?: string; say?: string;
}) {
  // The closing statement is one of the page's few spectral reveals: --p rises continuously with the
  // section's own entry into the viewport, so the pass scrubs with the reader in both directions.
  const root = useRef<HTMLElement>(null);
  useScrollProgress(root, { measure: entryProgress(0.9) });
  return (
    // The ending is the site's one ink panel (2026-09-30): the page stays white around it, the way the
    // sign-in screen's brand panel sits beside a white form, so the ground is the same everywhere and ink
    // is the signature, not a dark theme.
    // Since 2026-10-01 it ends the way cursor.com's homepage does (founder: "keep bottom like cursor.com"):
    // the line, large and centred on the page itself, and one action. The card it sat in, the second line
    // and the second link went; `say` is kept for pages that pass one.
    <section className="v6-end" data-nav-theme="dark" ref={root}>
      <div className="v6-end__in">
        <div className="v6-end__card">
          <Spectral as="h2" className="v6-end__h" sv="clamp(0, calc((var(--p) - 0.12) / 0.82), 1)" text={title} />
          {say !== CLOSE_SAY ? <p className="v6-end__say">{say}</p> : null}
          <div className="v6-end__cta">
            <CTA brand lg>Open Vraelis</CTA>
          </div>
        </div>
      </div>
    </section>
  );
}

const COLS: [string, [string, string][]][] = [
  // "What is built" and "In public" are the two pages a sceptical reader actually wants, and neither was
  // reachable from the footer: the live-versus-planned list sat behind two differently-named submenu
  // entries, and the incident record had no inbound link anywhere on the site.
  ["Product", [[`${BASE}/platform`, "Platform"], [`${BASE}/platform#coverage`, "What it can reach"], [`${BASE}/platform#current`, "What is built"], [`${BASE}/integrations`, "Ways to use it"], [`${BASE}/agents`, "AI assistants"], [`${BASE}/pricing`, "Pricing"], [`${BASE}/enterprise`, "Enterprise"]]],
  // Documentation is the docs, not the developers page: the docs were rebuilt as their own section and this
  // link still pointed at the API overview.
  ["Developers", [[`${BASE}/docs`, "Documentation"], [`${BASE}/developers#api`, "API"], [`${BASE}/developers#cli`, "CLI"], [`${BASE}/developers#webhooks`, "Webhooks"]]],
  // Resources split out of Company, which held ten links beside a column of four. Same split as the nav.
  ["Resources", [[`${BASE}/research`, "Research"], [`${BASE}/method`, "Method"], [`${BASE}/method#in-public`, "In public"], [`${BASE}/readme`, "README"], [`${BASE}/changelog`, "Changelog"]]],
  ["Company", [[`${BASE}/company`, "About"], [`${BASE}/company#who`, "Who it is for"], [`${BASE}/company#different`, "How this is different"], [`${BASE}/partnerships/reddit`, "Reddit partnership"], [`${BASE}/partnerships/bytedance`, "ByteDance partnership"]]],
  // "Contact" pointed at an anchor on the company page. It is now a page, because a contact anchor is where
  // a contact route goes to be quietly missing.
  // Cookies and Acceptable use joined on 2026-09-30 with the privacy choices; the column also ends with the
  // "Privacy choices" control itself (rendered below, since it opens a dialog rather than going anywhere).
  ["Trust", [[`${BASE}/security`, "Security"], [`${BASE}/limitations`, "Limitations"], [`${BASE}/privacy`, "Privacy"], [`${BASE}/cookies`, "Cookies"], [`${BASE}/terms`, "Terms"], [`${BASE}/acceptable-use`, "Acceptable use"], [`${BASE}/data-rights`, "Data rights"], [`${BASE}/subprocessors`, "Subprocessors"], [`${BASE}/trademark`, "Trademark"], [`${BASE}/contact`, "Contact"]]],
];

export function SiteFooter() {
  return (
    <footer className="v6-foot2" data-nav-theme="dark">
      {/* No upper block. The closing scene above IS the ending; this footer is only the directory. Two giant
          statements stacked at the bottom competed for the same job and the second one read as a repeat. */}
      <div className="v6-foot2__lower">
        {COLS.map(([h, links]) => (
          <div className="v6-foot2__col" key={h}>
            <p className="v6-foot2__h">{h}</p>
            {links.map(([href, label]) => <Link key={label} href={href}>{label}</Link>)}
            {h === "Trust" && <PrivacyChoicesButton />}
          </div>
        ))}
      </div>

      {/* THE ONE SENTENCE, PUT BACK ON A PAGE. FOOTER_STATEMENT was exported and imported by nothing for the
          whole of the last design: the surface that carried it was removed and the export outlived it, so
          the clearest sentence the company owns rendered nowhere a visitor could reach. It returns HERE,
          quiet and at directory scale, rather than as the upper block the note above rightly refuses. That
          note is about two giant competing statements. This is one line of small print that says what the
          company does, which is the thing a footer is actually for.
          LINKEDIN IS THE ONLY SOCIAL LINK, because it is the only profile confirmed to exist. The X address
          returned 404 on 2026-09-28 and was removed from here and from lib/entity.ts the same day. */}
      <div className="v6-foot2__base">
        <p className="v6-foot2__say"><span>{FOOTER_STATEMENT}</span></p>
        <div className="v6-foot2__base-in">
          {/* The language switch: the same one the docs, sign-in and the console carry. */}
          <span className="v6-foot2__lang"><LanguageSwitcher placement="up" toTop /><span>© 2026 Vraelis</span></span>
          <div className="v6-foot2__legal">
            {/* Only what the columns above do not already hold: Security, Privacy, Cookies, Terms and
                Acceptable use were repeated here from the Trust column (since 2026-10-01, as cursor.com's
                bottom line carries only its own few items). */}
            <a href="https://www.linkedin.com/company/vraelis" target="_blank" rel="noreferrer">LinkedIn</a>
            <PrivacyChoicesButton />
          </div>
        </div>
      </div>
    </footer>
  );
}

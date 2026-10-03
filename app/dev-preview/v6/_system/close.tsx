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
import { V6_BASE, v6SignInPath } from "@/lib/v6-routes";
import { FOOTER_STATEMENT } from "./positioning";
import { SECTORS, SOLUTIONS_HREF } from "../_content/sectors";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

const BASE = V6_BASE;
// Account creation is the sign-in screen in its sign-up mode, landing in the console afterwards: the same
// destination as the bar's "Create account" (shell.tsx).
const SIGNUP = `${v6SignInPath()}&mode=signup`;

/**
 * THE ENDING OF A PAGE (plan A5, 2026-10-02): one line, centred, at the display size (64 / 40, 16ch) with
 * the Spectral reveal, and exactly one white lg button under it.
 *
 *   title   the line. Default CLOSE_TITLE (positioning.ts).
 *   action  the one button, { label, href }. Default { label: "Start free", href: the sign-up screen }.
 *           A page whose next step is a conversation passes its own, e.g. { label: "Talk to sales",
 *           href: `${V6_BASE}/contact?topic=enterprise` }.
 *   say     an optional short line under the title, for a page that needs one. Not shown by default.
 *
 * Usage: <ClosingScene />  or  <ClosingScene title="Know the edges before you start." />
 */
export function ClosingScene({
  title = CLOSE_TITLE,
  action = { label: "Start free", href: SIGNUP },
  say = CLOSE_SAY,
}: {
  title?: string; action?: { label: string; href: string }; say?: string;
}) {
  // The closing statement is one of the page's few spectral reveals: --p rises continuously with the
  // section's own entry into the viewport, so the pass scrubs with the reader in both directions.
  const root = useRef<HTMLElement>(null);
  useScrollProgress(root, { measure: entryProgress(0.9) });
  return (
    // Since 2026-10-01 it ends the way cursor.com's homepage does (founder: "keep bottom like cursor.com"):
    // the line, large and centred on the page itself, and one action. CLOSE_SAY is the default `say` and is
    // never printed; a page that passes its own line gets it under the title.
    <section className="v6-end" data-nav-theme="dark" ref={root}>
      <div className="v6-end__in">
        <div className="v6-end__card">
          <Spectral as="h2" className="v6-end__h" sv="clamp(0, calc((var(--p) - 0.12) / 0.82), 1)" text={title} />
          {say !== CLOSE_SAY ? <p className="v6-end__say">{say}</p> : null}
          <div className="v6-end__cta">
            <CTA href={action.href} brand lg>{action.label}</CTA>
          </div>
        </div>
      </div>
    </section>
  );
}

// THE DIRECTORY (plan S5, revision 2, 2026-10-02). Six columns from 1200px, three from 941 to 1199, two at 940
// and below, and on a phone full-width groups with their links two across (close.css). The Solutions column is
// the sector registry (_content/sectors.ts) in its display order, then the index: no sector is listed by hand
// here. Some destinations are built by later batches of the same plan (the sector pages, /use-cases, and the
// four Developers pages under /docs); the links are written once, here, and resolve as those pages land.
// Every other link stays a literal [`${BASE}/path`, "Label"] tuple: scripts/privacy-consent-verify.ts reads the
// Trust column's tuples in this source to prove each legal page is linked from the footer.
const COLS: [string, [string, string][]][] = [
  // "What is built" and "In public" are the two pages a sceptical reader actually wants, and neither was
  // reachable from the footer: the live-versus-planned list sat behind two differently-named submenu
  // entries, and the incident record had no inbound link anywhere on the site.
  ["Product", [[`${BASE}/platform`, "Platform"], [`${BASE}/platform#how`, "How a check works"], [`${BASE}/platform#coverage`, "What it can reach"], [`${BASE}/platform#current`, "What is built"], [`${BASE}/integrations`, "Integrations"], [`${BASE}/agents`, "AI assistants"], [`${BASE}/pricing`, "Pricing"]]],
  ["Solutions", [...SECTORS.map((s): [string, string] => [s.href, s.label]), [SOLUTIONS_HREF, "All solutions"]]],
  // Documentation is the docs, not the developers page: the docs were rebuilt as their own section.
  ["Developers", [[`${BASE}/docs`, "Documentation"], [`${BASE}/docs/api`, "API"], [`${BASE}/docs/cli`, "CLI"], [`${BASE}/docs/webhooks`, "Webhooks"], [`${BASE}/docs/ci`, "CI"], [`${BASE}/developers`, "Developers overview"]]],
  // Use cases: the recorded checks, one page each (plan S1), between the research and the method.
  ["Resources", [[`${BASE}/research`, "Research"], [`${BASE}/use-cases`, "Use cases"], [`${BASE}/method`, "Method"], [`${BASE}/method#in-public`, "In public"], [`${BASE}/readme`, "README"], [`${BASE}/changelog`, "Changelog"]]],
  // "Contact" is a page, because a contact anchor is where a contact route goes to be quietly missing.
  ["Company", [[`${BASE}/company`, "About"], [`${BASE}/contact`, "Contact"], [`${BASE}/partnerships/reddit`, "Reddit partnership"], [`${BASE}/partnerships/bytedance`, "ByteDance partnership"]]],
  // Cookies and Acceptable use joined on 2026-09-30 with the privacy choices, and Refunds on 2026-10-02 (the one
  // legal page this footer did not link); the column also ends with the "Privacy choices" control itself
  // (rendered below, since it opens a dialog rather than going anywhere).
  ["Trust", [[`${BASE}/security`, "Security"], [`${BASE}/limitations`, "Limitations"], [`${BASE}/privacy`, "Privacy"], [`${BASE}/cookies`, "Cookies"], [`${BASE}/terms`, "Terms"], [`${BASE}/acceptable-use`, "Acceptable use"], [`${BASE}/refunds`, "Refunds"], [`${BASE}/data-rights`, "Data rights"], [`${BASE}/subprocessors`, "Subprocessors"], [`${BASE}/trademark`, "Trademark"]]],
];

export function SiteFooter() {
  return (
    <footer className="v6-foot2" data-nav-theme="dark">
      {/* No upper block. The closing scene above IS the ending; this footer is only the directory. Two giant
          statements stacked at the bottom competed for the same job and the second one read as a repeat. */}
      <div className="v6-foot2__lower">
        {/* Each column is a named group of links (WCAG 1.3.1): the label looks like a heading, so a screen reader
            hears it as the group's name rather than as one more line in a run of about 45 links. A <p>, not a
            heading: the page's outline ends at the closing's h2. */}
        {COLS.map(([h, links]) => (
          <div className="v6-foot2__col" key={h} role="group" aria-labelledby={`v6-foot-${h.toLowerCase()}`}>
            <p className="v6-foot2__h" id={`v6-foot-${h.toLowerCase()}`}>{h}</p>
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

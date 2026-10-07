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
import { FOOTER_STATEMENT, HEADLINE } from "./positioning";
import { PRIMARY_SECTORS, SOLUTIONS_HREF } from "../_content/sectors";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

const BASE = V6_BASE;
const CONTACT = `${BASE}/contact`;

/**
 * THE ENDING OF A PAGE (plan A5, 2026-10-02): one line, centred, at the display size (64 / 40, 16ch) with
 * the Spectral reveal, and exactly one white lg button under it.
 *
 *   title   the line. Default CLOSE_TITLE (positioning.ts).
 *   action  the one button, { label, href }. Defaults to a conversation with the team.
 *           A page whose next step is a conversation passes its own, e.g. { label: "Talk to sales",
 *           href: `${V6_BASE}/contact?topic=enterprise` }.
 *   say     an optional short line under the title, for a page that needs one. Not shown by default.
 *
 * Usage: <ClosingScene />  or  <ClosingScene title="Know the edges before you start." />
 */
export function ClosingScene({
  title = CLOSE_TITLE,
  action = { label: "Contact", href: CONTACT },
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

// Main destinations stay visible. Detailed documentation and other solutions are
// accessible through their indexes; secondary policies remain in a disclosure.
const COLS: [string, [string, string][]][] = [
  ["Product", [[`${BASE}/platform`, "Platform"], [`${BASE}/zero-trust`, "Zero trust"], [`${BASE}/recorded-evidence`, "Recorded evidence"], [`${BASE}/beta`, "Development status"], [`${BASE}/integrations`, "Integrations"], [`${BASE}/agents`, "AI workloads"], [`${BASE}/pricing`, "Pricing"]]],
  ["Solutions", [...PRIMARY_SECTORS.map((s): [string, string] => [s.href, s.label]), [`${BASE}/government`, "Government & institutions"], [`${BASE}/integrators`, "System integrators"], [`${BASE}/enterprise`, "Enterprise"], [SOLUTIONS_HREF, "Explore solutions"]]],
  ["Resources", [[`${BASE}/docs`, "Documentation"], [`${BASE}/developers`, "Developer tools"], [`${BASE}/problems`, "The problems"], [`${BASE}/research`, "Research"], [`${BASE}/changelog`, "Changelog"]]],
  ["Company", [[`${BASE}/goals`, "Our goals"], [`${BASE}/company`, "About"], [`${BASE}/contact`, "Contact"]]],
  ["Trust", [[`${BASE}/security`, "Security"], [`${BASE}/privacy`, "Privacy"], [`${BASE}/cookies`, "Cookies"], [`${BASE}/terms`, "Terms"], [`${BASE}/acceptable-use`, "Acceptable use"], [`${BASE}/limitations`, "Limitations"], [`${BASE}/refunds`, "Refunds"], [`${BASE}/data-rights`, "Data rights"], [`${BASE}/subprocessors`, "Subprocessors"], [`${BASE}/trademark`, "Trademark"]]],
];

export function SiteFooter() {
  return (
    <footer className="v6-foot2" data-nav-theme="dark">
      <div className="v6-foot2__lower">
        <div className="v6-foot2__brand">
          <Link href={BASE || "/"} className="v6-foot2__wordmark" aria-label="Vraelis homepage">Vraelis</Link>
          <p>AI security. In development.</p>
          <span>Defense. Infrastructure. Robotics.</span>
        </div>
        {/* Each column is a named group of links (WCAG 1.3.1): the label looks like a heading, so a screen reader
            hears it as the group's name rather than as one more line in a run of about 45 links. A <p>, not a
            heading: the page's outline ends at the closing's h2. */}
        {COLS.map(([h, links]) => (
          <div className="v6-foot2__col" key={h} role="group" aria-labelledby={`v6-foot-${h.toLowerCase()}`}>
            <p className="v6-foot2__h" id={`v6-foot-${h.toLowerCase()}`}>{h}</p>
            {(h === "Trust" ? links.slice(0, 5) : links).map(([href, label]) => <Link key={label} href={href}>{label}</Link>)}
            {h === "Trust" && (
              <details className="v6-foot2__policies">
                <summary>More policies</summary>
                <div>{links.slice(5).map(([href, label]) => <Link key={label} href={href}>{label}</Link>)}</div>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className="v6-foot2__closing">{HEADLINE}</div>

      <div className="v6-foot2__base">
        <p className="v6-foot2__say"><span>{FOOTER_STATEMENT}</span></p>
        <div className="v6-foot2__base-in">
          {/* The language switch: the same one the docs, sign-in and the console carry. */}
          <span className="v6-foot2__lang"><LanguageSwitcher placement="up" toTop /><span>© 2026 Vraelis</span></span>
          <div className="v6-foot2__legal">
            {/* Only what the columns above do not already hold: Security, Privacy, Cookies, Terms and
                Acceptable use were repeated here from the Trust column (since 2026-10-01, as cursor.com's
                bottom line carries only its own few items). */}
            <a href="/site/IMAGE-SOURCES.md">Image sources</a>
            <a href="https://www.linkedin.com/company/vraelis" target="_blank" rel="noreferrer">LinkedIn</a>
            <PrivacyChoicesButton />
          </div>
        </div>
      </div>
    </footer>
  );
}

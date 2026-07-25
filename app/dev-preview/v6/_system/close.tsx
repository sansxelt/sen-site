"use client";

// Global closing scene and institutional footer, shared by every public route. The closing resolves the
// responsibility introduced in the homepage opening into a settled state, so the page ends its own story
// rather than parking a card above the footer.
import { useRef } from "react";
import Link from "next/link";
import { CTA, EditorialLink } from "./ui";
import { CLOSE_TITLE, FOOTER_STATEMENT } from "./positioning";
import { useScrollProgress, entryProgress } from "./progress";
import { Spectral } from "./spectral";
import "./close.css";

const BASE = "/dev-preview/v6";

// `resolve` defaults OFF. The closing is one statement, one line and two actions; the recap strip it used to
// carry was a second idea in the same viewport and re-explained a story the page had already told.
export function ClosingScene({
  resolve = false,
  title = CLOSE_TITLE,
  say = `${FOOTER_STATEMENT} Written down before the work starts, and checked against the running software after it ends.`,
  secondaryHref = `${BASE}/platform`,
  secondaryLabel = "See the platform",
}: {
  resolve?: boolean; title?: string; say?: string; secondaryHref?: string; secondaryLabel?: string;
}) {
  // The closing statement is one of the page's few spectral reveals: --p rises continuously with the
  // section's own entry into the viewport, so the pass scrubs with the reader in both directions.
  const root = useRef<HTMLElement>(null);
  useScrollProgress(root, { measure: entryProgress(0.9) });
  return (
    <section className="v6-end" data-nav-dark data-nav-theme="dark" ref={root}>
      <div className="v6-end__field" aria-hidden />
      <div className="v6-end__in">
        {resolve ? (
          <div className="v6-end__resolve">
            <span className="v6-sig v6-sig--go"><span className="v6-sig__dot" aria-hidden />Shipped</span>
            <p className="v6-end__resolve-t">
              The pricing change from the top of this page was approved by a person, the repair was re-checked,
              and <b>it went out with the record of how it got there.</b>
            </p>
          </div>
        ) : null}
        <h2 className="v6-end__h"><Spectral sv="clamp(0, calc((var(--p) - 0.12) / 0.82), 1)">{title}</Spectral></h2>
        <p className="v6-end__say">{say}</p>
        <div className="v6-end__cta">
          <CTA brand lg>Open Vraelis</CTA>
          <EditorialLink href={secondaryHref}>{secondaryLabel}</EditorialLink>
          <Link href={`${BASE}/company#contact`} className="v6-end__third">Talk to the team</Link>
        </div>
      </div>
    </section>
  );
}

const COLS: [string, [string, string][]][] = [
  ["Product", [[`${BASE}/platform`, "Platform"], [`${BASE}/agents`, "Agents"], [`${BASE}/integrations`, "Integrations"], [`${BASE}/platform#current`, "Current capabilities"]]],
  ["Developers", [[`${BASE}/developers`, "Documentation"], [`${BASE}/developers#api`, "API"], [`${BASE}/developers#cli`, "CLI"], [`${BASE}/developers#webhooks`, "Webhooks"]]],
  ["Company", [[`${BASE}/research`, "Research"], [`${BASE}/method`, "Method"], [`${BASE}/readme`, "README"], [`${BASE}/changelog`, "Changelog"], [`${BASE}/company`, "About"]]],
  ["Trust", [[`${BASE}/security`, "Security"], ["/privacy", "Privacy"], ["/terms", "Terms"], ["/subprocessors", "Subprocessors"], [`${BASE}/company#contact`, "Contact"]]],
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
          </div>
        ))}
      </div>

      <div className="v6-foot2__base">
        <div className="v6-foot2__base-in">
          <span>© 2026 Vraelis</span>
          <div className="v6-foot2__legal">
            <a href="https://x.com/vraelis" target="_blank" rel="noreferrer">X</a>
            <a href="https://www.linkedin.com/company/vraelis" target="_blank" rel="noreferrer">LinkedIn</a>
            <Link href={`${BASE}/security`}>Security</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

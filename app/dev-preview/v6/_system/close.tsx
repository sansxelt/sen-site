"use client";

// Global closing scene and institutional footer, shared by every public route. The closing resolves the
// responsibility introduced in the homepage opening into a settled state, so the page ends its own story
// rather than parking a card above the footer.
import { useRef } from "react";
import Link from "next/link";
import { CTA, EditorialLink } from "./ui";
import { CLOSE_TITLE, CLOSE_SAY } from "./positioning";
import { useScrollProgress, entryProgress } from "./progress";
import { Spectral } from "./spectral";
import "./close.css";
import { V6_BASE } from "@/lib/v6-routes";

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
    <section className="v6-end" data-nav-dark data-nav-theme="dark" ref={root}>
      <div className="v6-end__field" aria-hidden />
      <div className="v6-end__in">
        <Spectral as="h2" className="v6-end__h" sv="clamp(0, calc((var(--p) - 0.12) / 0.82), 1)" text={title} />
        <p className="v6-end__say">{say}</p>
        <div className="v6-end__cta">
          <CTA brand lg>Open Vraelis</CTA>
          <EditorialLink href={`${BASE}/company#contact`}>Talk to the team</EditorialLink>
        </div>
      </div>
    </section>
  );
}

const COLS: [string, [string, string][]][] = [
  ["Product", [[`${BASE}/platform`, "Platform"], [`${BASE}/agents`, "Agents"], [`${BASE}/integrations`, "Integrations"], [`${BASE}/platform#current`, "Current capabilities"]]],
  ["Developers", [[`${BASE}/developers`, "Documentation"], [`${BASE}/developers#api`, "API"], [`${BASE}/developers#cli`, "CLI"], [`${BASE}/developers#webhooks`, "Webhooks"]]],
  ["Company", [[`${BASE}/research`, "Research"], [`${BASE}/method`, "Method"], [`${BASE}/readme`, "README"], [`${BASE}/changelog`, "Changelog"], [`${BASE}/company`, "About"]]],
  ["Trust", [[`${BASE}/security`, "Security"], [`${BASE}/privacy`, "Privacy"], [`${BASE}/terms`, "Terms"], [`${BASE}/subprocessors`, "Subprocessors"], [`${BASE}/company#contact`, "Contact"]]],
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
            <Link href={`${BASE}/privacy`}>Privacy</Link>
            <Link href={`${BASE}/terms`}>Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

// Global closing scene and institutional footer, shared by every public route. The closing resolves the
// responsibility introduced in the homepage opening into a settled state, so the page ends its own story
// rather than parking a card above the footer.
import Link from "next/link";
import { CTA, EditorialLink } from "./ui";
import { CLOSE_TITLE, CLOSE_SAY, FOOTER_STATEMENT } from "./positioning";
import "./close.css";

const BASE = "/dev-preview/v6";

// `resolve` defaults OFF. The closing is one statement, one line and two actions; the recap strip it used to
// carry was a second idea in the same viewport and re-explained a story the page had already told.
export function ClosingScene({
  resolve = false,
  title = CLOSE_TITLE,
  say = CLOSE_SAY,
  secondaryHref = `${BASE}/platform`,
  secondaryLabel = "See the platform",
}: {
  resolve?: boolean; title?: string; say?: string; secondaryHref?: string; secondaryLabel?: string;
}) {
  return (
    <section className="v6-end" data-nav-dark>
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
        <h2 className="v6-end__h">{title}</h2>
        <p className="v6-end__say">{say}</p>
        <div className="v6-end__cta">
          <CTA brand>Open Vraelis</CTA>
          <EditorialLink href={secondaryHref}>{secondaryLabel}</EditorialLink>
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
    <footer className="v6-foot2">
      {/* Upper footer: ONE editorial handoff, not a small heading over an isolated button. The statement
          carries the block at display scale on the left; the actions and the status sit together on the
          right, with the status clearly subordinate to them. The lower directory below is unchanged. */}
      <div className="v6-foot2__upper">
        <div className="v6-foot2__say">
          <p className="v6-foot2__stmt">{FOOTER_STATEMENT}</p>
          <p className="v6-foot2__sub">Written down before the work starts. Checked against the running software after it ends.</p>
        </div>
        <div className="v6-foot2__act">
          <CTA brand>Open Vraelis</CTA>
          <Link href={`${BASE}/company#contact`} className="v6-foot2__second">Talk to the team<span className="v6-arw" aria-hidden>&rarr;</span></Link>
          <Link href={`${BASE}/security#status`} className="v6-foot2__status">
            <span className="v6-foot2__dot" aria-hidden />Verification engine operational
          </Link>
        </div>
      </div>

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

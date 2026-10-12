import Link from "next/link";
import type { Metadata } from "next";
import { robotsMeta } from "@/lib/stealth";
import { Wrap } from "./_kit/blocks";
import { CONTOUR, href } from "./_kit/site";
import "./_kit/not-found.css";

// THE V8 404 (founder, 2026-10-12: "i hate this 404 screen"; it was the root app's older page, with no header or
// footer). Inside the site's own frame: the number in the shared spectrum, one plain sentence, the way home first,
// and the places most people were looking for. Never indexed.
export const metadata: Metadata = { title: "Page not found", robots: robotsMeta(false) };

const PLACES = [
  { to: "/contour", title: CONTOUR.name, line: "Model release security, from approval to reported runtime state." },
  { to: "/contour/status", title: "Contour status", line: "What works today, what is planned next, what we do not claim." },
  { to: "/research", title: "Research", line: "Model integrity, adversarial threats, machine trust, security evidence." },
  { to: "/applications", title: "Applications", line: "Defense, critical infrastructure, autonomous systems." },
  { to: "/company", title: "Company", line: "Who builds Vraelis, and the brands around it." },
  { to: "/contact", title: "Contact", line: "Join us, or reach the right team." },
];

export default function V8NotFound() {
  return (
    <section className="nf">
      <Wrap>
        <div className="nf__head">
          <p className="nf__code v8-spec-text" aria-hidden="true">404</p>
          <h1 className="v8-h1 nf__title">Page not found.</h1>
          <p className="v8-lead nf__lead">The address may be mistyped, or the page has moved. Try one of these instead.</p>
          <div className="v8-actions nf__actions">
            <Link className="v8-btn v8-btn--solid v8-btn--lg" href={href("/")}>Back to home</Link>
            <Link className="v8-btn v8-btn--soft v8-btn--lg" href={href("/docs")}>Read the docs</Link>
          </div>
        </div>
        <ul className="nf__places">
          {PLACES.map((p) => (
            <li key={p.to}>
              <Link href={href(p.to)}><b>{p.title}<span className="v8-arrow" aria-hidden="true" /></b><span>{p.line}</span></Link>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

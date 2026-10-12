import Link from "next/link";
import type { Metadata } from "next";
import { robotsMeta } from "@/lib/stealth";
import { href } from "./_kit/site";
import "./_kit/not-found.css";

// THE V8 404 (founder, 2026-10-12: "i hate this 404 screen", then "it should just be that screen in the middle"): one
// centered screen with no header, footer or list of places (_kit/not-found.css hides the frame): the number in the
// shared spectrum, one plain sentence, the way home first. Never indexed.
export const metadata: Metadata = { title: "Page not found", robots: robotsMeta(false) };

export default function V8NotFound() {
  return (
    <section className="nf" data-no-reveal>
      <div className="nf__head">
        <p className="nf__code v8-spec-text" aria-hidden="true">404</p>
        <h1 className="v8-h1 nf__title">Page not found.</h1>
        <p className="v8-lead nf__lead">The address may be mistyped, or the page has moved.</p>
        <div className="v8-actions nf__actions">
          <Link className="v8-btn v8-btn--solid v8-btn--lg" href={href("/")}>Back to home</Link>
          <Link className="v8-btn v8-btn--soft v8-btn--lg" href={href("/docs")}>Read the docs</Link>
        </div>
      </div>
    </section>
  );
}

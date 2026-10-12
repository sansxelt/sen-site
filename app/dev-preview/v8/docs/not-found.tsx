import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { robotsMeta } from "@/lib/stealth";
import { dl, loadDocsHost } from "./_data/host";
import { isDocsFile } from "./_data/links";
import "../_kit/not-found.css";

// THE DOCS 404: the same single centered screen as the site's 404 (founder, 2026-10-12), with the docs header,
// sidebar and footer hidden by _kit/not-found.css. Never indexed.
// Browser tab: "Error | Vraelis" (founder, 2026-10-12).
export const metadata: Metadata = { title: { absolute: "Error | Vraelis" }, robots: robotsMeta(false) };

function A({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const at = dl(to);
  return /^https?:/.test(at) || isDocsFile(at) ? <a className={className} href={at}>{children}</a> : <Link className={className} href={at}>{children}</Link>;
}


export default async function DocsNotFound() {
  await loadDocsHost();
  return (
    <section className="nf" data-no-reveal>
      <div className="nf__head">
        <p className="nf__code v8-spec-text" aria-hidden="true">404</p>
        <h1 className="v8-h1 nf__title">This page is not in the docs.</h1>
        <p className="v8-lead nf__lead">The address may be mistyped, or the page has moved.</p>
        <div className="v8-actions nf__actions">
          <A to="/docs" className="v8-btn v8-btn--solid v8-btn--lg">Docs home</A>
          <A to="/docs/glossary" className="v8-btn v8-btn--soft v8-btn--lg">Glossary</A>
        </div>
      </div>
    </section>
  );
}

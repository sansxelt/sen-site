import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { robotsMeta } from "@/lib/stealth";
import { CONTOUR } from "../_kit/site";
import { dl, loadDocsHost } from "./_data/host";
import { isDocsFile } from "./_data/links";
import "../_kit/not-found.css";

// THE DOCS 404, inside the docs' own header and sidebar (docs/layout.tsx). Same shape as the site's 404, pointing at
// the docs pages people most often want. Never indexed.
export const metadata: Metadata = { title: "Page not found", robots: robotsMeta(false) };

function A({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const at = dl(to);
  return /^https?:/.test(at) || isDocsFile(at) ? <a className={className} href={at}>{children}</a> : <Link className={className} href={at}>{children}</Link>;
}

const PLACES = [
  { to: "/docs/introduction", title: "Introduction", line: "What Vraelis is and where these docs fit." },
  { to: "/docs/contour", title: `${CONTOUR.name} overview`, line: "The five-step workflow and where it stands." },
  { to: "/docs/observation-02", title: "Recorded observations", line: "The four observations from the captured run." },
  { to: "/docs/faq", title: "FAQ", line: "Short answers about access, the source and partners." },
];

export default async function DocsNotFound() {
  await loadDocsHost();
  return (
    <section className="nf nf--docs">
      <div className="nf__head">
        <p className="nf__code v8-spec-text" aria-hidden="true">404</p>
        <h1 className="v8-h1 nf__title">This page is not in the docs.</h1>
        <p className="v8-lead nf__lead">The address may be mistyped, or the page has moved. Search with Ctrl K, or start here.</p>
        <div className="v8-actions nf__actions">
          <A to="/docs" className="v8-btn v8-btn--solid v8-btn--lg">Docs home</A>
          <A to="/docs/glossary" className="v8-btn v8-btn--soft v8-btn--lg">Glossary</A>
        </div>
      </div>
      <ul className="nf__places">
        {PLACES.map((p) => (
          <li key={p.to}><A to={p.to}><b>{p.title}<span className="v8-arrow" aria-hidden="true" /></b><span>{p.line}</span></A></li>
        ))}
      </ul>
    </section>
  );
}

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { v6meta } from "../_system/meta";
import { DocShell } from "../_content/docs-ui";
import { docsByGroup, getDoc, docPrefetch } from "../_content/docs";
import { V6_BASE } from "@/lib/v6-routes";
import { APP_ACCESS_OPEN } from "@/lib/app-availability";
import { photograph } from "../_content/photography";
import { DOCUMENTATION_INDEX_PHOTOGRAPHS } from "../_content/documentation-photography";

const BASE = V6_BASE;
export const metadata: Metadata = v6meta({
  title: "Documentation",
  description: "Read Vraelis AI-security development scope, recorded-evidence references and archived implementation guides. Public workspace access is closed.",
  path: "/docs",
});

// A compact starting point: the guide itself explains the next step.
const START = ["ai-security", "recorded-reports"];

// One line each, as a reader would type it. Machine text, never translated.
const BY_INTERFACE: { name: string; slug: string; line: string }[] = [
  { name: "Console", slug: "getting-started", line: "app.vraelis.com" },
  { name: "CLI", slug: "cli", line: "vraelis verify --url URL --claim \"...\" --wait" },
  { name: "API", slug: "api", line: "POST /v1/verifications" },
  { name: "AI assistants", slug: "ai-assistants", line: "vraelis init" },
];

// "Ask a person." (plan T7): the support mailbox, the security report, and what is built today.
const ASK: { label: string; href: string; mono?: string }[] = [
  { label: "Email support", href: "mailto:help@vraelis.com", mono: "help@vraelis.com" },
  { label: "Report a security issue", href: `${BASE}/security#report` },
  { label: "Current product direction", href: `${BASE}/platform` },
];

export default function DocsIndex() {
  return (
    <DocShell crumb={["Documentation", "Overview"]}>
      <div className="v6-docs__article v6-docs__article--home v6-prose">
        <header className="v6-docs__intro">
          <p className="v6-docs__section">Documentation</p>
          <h1>Vraelis documentation</h1>
          <p className="v6-docs__lead">Understand the current direction and distinguish research from implemented components.</p>
          {!APP_ACCESS_OPEN ? <p className="v6-docs__scope">Public workspace access is closed. These references are not instructions for an available deployment.</p> : null}
        </header>

        <section className="v6-docs__home" aria-labelledby="start-here">
          <h2 id="start-here">Start here</h2>
          <div className="v6-docs__start">
            {START.map((slug) => {
              const d = getDoc(slug)!;
              const photo = photograph(DOCUMENTATION_INDEX_PHOTOGRAPHS[slug]);
              return (
                <Link key={slug} href={`${BASE}/docs/${d.slug}`} className="v6-docs__card">
                  <span className="v6-docs__card-photo" aria-hidden="true"><Image src={photo.src} alt="" width={photo.w} height={photo.h} sizes="(max-width:640px) 90vw, 450px" loading="lazy" /></span>
                  <span className="t">{slug === "the-loop" ? "How a check works" : d.title}</span>
                  <span className="s">{d.summary}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <details className="v6-docs__archive">
          <summary>Earlier implementation references</summary>
          <section className="v6-docs__home" aria-labelledby="by-interface">
          <h2 id="by-interface">Earlier implementation interfaces</h2>
          <div className="v6-docs__ways">
            {BY_INTERFACE.map((w) => (
              <Link key={w.name} href={`${BASE}/docs/${w.slug}`} className="v6-docs__way">
                <span className="t">{w.name}</span>
                {/* Each word of the command is kept whole: a browser may break a line after a hyphen,
                    which split --wait into "--" and "wait" in a narrow tile. Lines still wrap at spaces. */}
                <code className="m" data-no-translate>
                  {w.line.split(" ").map((word, i) => <Fragment key={i}>{i ? " " : null}<span className="w">{word}</span></Fragment>)}
                </code>
              </Link>
            ))}
          </div>
        </section>

        <section className="v6-docs__home" aria-labelledby="every-page">
          <h2 id="every-page">Every page</h2>
          <div className="v6-docs__archive-grid">{docsByGroup().map((g) => (
            <div key={g.group} className="v6-docs__index">
              <h3 id={g.group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>{g.group}</h3>
              {/* Each row is a link inside its own list item. role="listitem" on the link itself replaced its link
                  role, so a screen reader announced 17 list items and no links, and its links list left them out.
                  Not a <ul>: the article's `li > a { display: inline }` would undo the row layout. */}
              <div role="list">
                {g.docs.filter(d => !START.includes(d.slug)).map((d) => (
                  <div key={d.slug} role="listitem">
                    <Link href={`${BASE}/docs/${d.slug}`} className="v6-docs__row">
                      <span className="t">{d.title}</span>
                      <span className="s">{d.summary}</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}</div>
        </section>
        </details>

        <section className="v6-docs__home" aria-labelledby="ask-a-person">
          <h2 id="ask-a-person">Ask a person</h2>
          <ul className="v6-docs__ask">
            {ASK.map((a) => (
              <li key={a.label}>
                {a.href.startsWith("mailto:")
                  ? <a href={a.href}><span className="t">{a.label}</span><span className="m" data-no-translate>{a.mono}</span></a>
                  : <Link href={a.href} prefetch={docPrefetch(a.href)}><span className="t">{a.label}</span><span aria-hidden className="a">→</span></Link>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DocShell>
  );
}

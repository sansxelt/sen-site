import Link from "next/link";
import type { ReactNode } from "react";
import { v8meta } from "../_kit/meta";
import { CONTOUR, RESEARCH, WORKFLOW } from "../_kit/site";
import { DOCS_ORIGIN } from "@/lib/docs-host";
import { OBSERVATION_2, POLICY, TRACE_TESTS } from "../_content/evidence";
import { DESIRED_2, OBSERVATION_4 } from "./_data/contour";
import { dl, loadDocsHost } from "./_data/host";
import { isDocsFile } from "./_data/links";
import { CodePanel, JumpIn, type JumpStep } from "./_ui/home";
import { OutArrow } from "./_ui/header";

const meta = v8meta({
  title: "Get started with Vraelis",
  description: "Documentation for Vraelis: Vraelis Contour, model release security from approval to reported runtime state, the research behind it, and where it stops.",
  path: "/docs",
});
// The docs' own address is docs.vraelis.com (lib/docs-host.ts); /docs on the main host serves the same page.
export const metadata = { ...meta, title: { absolute: "Vraelis docs | Get started with Vraelis" }, alternates: { canonical: `${DOCS_ORIGIN}/` }, openGraph: { ...meta.openGraph, url: `${DOCS_ORIGIN}/` } };

const UPDATED = "October 10, 2026";

/** The runtime the worker reported in observation 2, unchanged from the trace. */
const RUNTIME_2 = `"runtime": {
  "ortVersion": "1.23.2",
  "executionProviders": ["CPUExecutionProvider"],
  "pythonVersion": "3.12.14"
}`;

const STEP_CODE: { tab: string; file: string; code: string; to: string }[] = [
  { tab: "Identity", file: "observation 02, approved identity", code: DESIRED_2, to: "/docs/release-identity" },
  { tab: "Approval", file: "policy cpu-lab, version 1", code: POLICY, to: "/docs/approval-binding" },
  { tab: "Runtime", file: "observation 02, reported runtime", code: RUNTIME_2, to: "/docs/runtime-integration" },
  { tab: "Compare", file: "observation 02, reload pending", code: OBSERVATION_2, to: "/docs/comparing-approved-and-reported" },
  { tab: "Evidence", file: "observation 04, evidence unavailable", code: OBSERVATION_4, to: "/docs/evidence-and-observations" },
];
const STEPS: JumpStep[] = WORKFLOW.map((w, i) => ({ id: `step-${w.n}`, title: w.title, body: w.body, kinds: [...w.kinds], ...STEP_CODE[i] }));

type Col = { title: string; links: { label: string; to: string }[] };
const EXPLORE: Col[] = [
  { title: "Get started", links: [
    { label: "Introduction", to: "/docs/introduction" },
    { label: "How to read these docs", to: "/docs/reading-the-docs" },
    { label: "Development status", to: "/docs/status" },
    { label: "Release notes", to: "/docs/release-notes" },
    { label: "Glossary", to: "/docs/glossary" },
  ] },
  { title: CONTOUR.name, links: [
    { label: "Overview", to: "/docs/contour" },
    { label: "Release identity", to: "/docs/release-identity" },
    { label: "Approval binding", to: "/docs/approval-binding" },
    { label: "Evidence and observations", to: "/docs/evidence-and-observations" },
    { label: "The evidence app", to: "/docs/evidence-app" },
    { label: "Limits", to: "/docs/limits" },
  ] },
  { title: "Research", links: [
    ...RESEARCH.map((r) => ({ label: r.title, to: `/docs/${r.slug}` })),
    { label: "Model release security", to: "/docs/model-release-security" },
  ] },
  { title: "Resources", links: [
    { label: "llms.txt", to: "/docs/llms.txt" },
    { label: "Earlier references", to: "/docs/getting-started" },
    { label: "Changelog", to: "/changelog" },
    { label: "Report a security issue", to: "/security#report" },
    { label: "Contact", to: "/contact" },
  ] },
];

/** A home link: files and the main site (from the docs host) as plain anchors, docs pages through the router. */
function A({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const at = dl(to);
  return /^https?:/.test(at) || isDocsFile(at) ? <a className={className} href={at}>{children}</a> : <Link className={className} href={at}>{children}</Link>;
}

// The docs home, after x.ai's /overview: a framed hero card with the recorded evidence beside it, the product card
// with its spec rows, "Jump straight in" through the five workflow steps, and "Explore the documentation".
export default async function DocsHome() {
  await loadDocsHost();
  return (
    <div className="v8-docs-home">
      <section className="v8-dh-hero" aria-labelledby="docs-title">
        <div className="v8-dh-hero__text" data-rv-kids>
          <h1 id="docs-title" className="v8-dh-hero__title">Get started<span>with Vraelis</span></h1>
          <p className="v8-dh-hero__lead">{CONTOUR.line} The product direction, the research behind it, and where it stops.</p>
          <div className="v8-dh-hero__actions">
            <A to="/contact?topic=contour" className="v8-btn v8-btn--solid">Join us<span className="v8-chev" aria-hidden="true" /></A>
            <A to="/docs/introduction" className="v8-btn v8-btn--ghost">Get started</A>
          </div>
        </div>
        <div className="v8-dh-hero__code" data-rv>
          <CodePanel className="v8-dcp--hero" note="Recorded in the controlled ONNX reference experiment, unchanged." tabs={[
            { id: "obs-2", label: "Observation 02", code: OBSERVATION_2, lang: "json" },
            { id: "obs-4", label: "Observation 04", code: OBSERVATION_4, lang: "json" },
            { id: "policy", label: "Policy", code: POLICY, lang: "json" },
            { id: "tests", label: "App tests", code: TRACE_TESTS, lang: "text" },
          ]} />
        </div>
      </section>

      <section className="v8-dh-sec" aria-labelledby="products">
        <h2 id="products" className="v8-dh-sec__h" data-rv>Products</h2>
        <div className="v8-dh-products" data-rv-kids>
          <article className="v8-dh-product">
            <div className="v8-dh-product__main">
              <div className="v8-dh-product__head">
                <h3>{CONTOUR.name}</h3>
                <span className="v8-badge">Reference experiment</span>
              </div>
              <p className="v8-dh-product__id">Model release security</p>
              <p className="v8-dh-product__p">{CONTOUR.headline} {CONTOUR.name} connects an approved model release to the runtime that receives it, and shows whether that runtime reports loading what was approved.</p>
              <div className="v8-dh-product__actions">
                <A to="/docs/contour" className="v8-btn v8-btn--solid v8-btn--sm">Read the docs</A>
                <A to="/docs/status" className="v8-btn v8-btn--ghost v8-btn--sm">Development status</A>
              </div>
            </div>
            <dl className="v8-dh-spec">
              <div><dt>Status</dt><dd>Controlled synthetic ONNX CPU experiment</dd></div>
              <div><dt>Runtime</dt><dd>ONNX Runtime 1.23.2, CPUExecutionProvider</dd></div>
              <div><dt>Tests</dt><dd>133 of 133, runtime rejection-diagnostics revision, reproduced by QA</dd></div>
              <div><dt>Access</dt><dd>Not for public use</dd></div>
            </dl>
          </article>
          <div className="v8-dh-only">
            <h3>The only product</h3>
            <p>{CONTOUR.name} is the one product direction. There are no other Vraelis products. The research areas are workstreams, not products.</p>
            <A to="/docs/products" className="v8-link">About products<span className="v8-arrow" aria-hidden="true" /></A>
          </div>
        </div>
      </section>

      <section className="v8-dh-sec" aria-labelledby="jump">
        <div data-rv-kids>
          <h2 id="jump" className="v8-dh-sec__h">Jump straight in</h2>
          <p className="v8-dh-sec__lead">The five steps of the {CONTOUR.name} workflow, each with the evidence the experiment recorded.</p>
        </div>
        <div data-rv><JumpIn steps={STEPS} /></div>
      </section>

      <section className="v8-dh-sec" aria-labelledby="explore">
        <h2 id="explore" className="v8-dh-sec__h" data-rv>Explore the documentation</h2>
        <div className="v8-dh-explore" data-rv-kids>
          {EXPLORE.map((c) => (
            <div key={c.title}>
              <h3>{c.title}</h3>
              <ul>
                {c.links.map((l) => <li key={l.to}><A to={l.to}><span>{l.label}</span><OutArrow /></A></li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="v8-docs-updated v8-dh-updated" data-rv>Last updated: {UPDATED}</p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { v6meta } from "../../_system/meta";
import { DocShell, Blocks, DocCode } from "../../_content/docs-ui";
import { DOCS, getDoc, adjacentDocs, docHeadings } from "../../_content/docs";

const BASE = "/dev-preview/v6";

// Real, runnable examples against the shipped API surface. Only pages where an example is genuinely truthful
// carry one; the rest render without a code block rather than inventing a call that does not exist.
const EXAMPLES: Record<string, [string, string]> = {
  "getting-started": ["Create a verification", `curl -X POST https://api.vraelis.com/v1/verifications \
  -H "Authorization: Bearer $VRAELIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "deployment_url": "https://app.example.com",
    "claim": "A paid customer keeps Pro access after signing back in."
  }'`],
  "completion": ["Read a decision", `GET /v1/verifications/vrf_ff9d6c0d

{
  "id": "vrf_ff9d6c0d",
  "decision": "verified",
  "claim": "A paid customer keeps Pro access after signing back in.",
  "evidence": { "screenshots": 4, "steps": 14 }
}`],
  "repair": ["Subscribe to the recheck", `POST /v1/webhooks
{ "event": "verification.completed", "url": "https://example.com/hooks/vraelis" }`],
};

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};
  return v6meta({ title: doc.title, description: doc.summary, path: `/docs/${doc.slug}`, type: "article" });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const { prev, next } = adjacentDocs(slug);
  const headings = docHeadings(doc);
  return (
    <DocShell activeSlug={slug} toc={headings}>
      <div className="v6-docs__surface">
        <article className="v6-prose">
          <div className="v6-docs__meta"><span className="v6-kicker">{doc.group}</span></div>
          <h1 className="v6-dl">{doc.title}</h1>
          <p className="v6-lead" style={{ marginTop: 14 }}>{doc.summary}</p>
          <div className="v6-note" style={{ marginTop: 22 }}><b>Outcome</b>{doc.outcome}</div>
          <Blocks blocks={doc.blocks} />
          {EXAMPLES[slug] ? <DocCode label={EXAMPLES[slug][0]} code={EXAMPLES[slug][1]} /> : null}
          {doc.related?.length ? (
            <>
              <h2 style={{ marginTop: 46 }}>Related</h2>
              <ul>{doc.related.map((r) => { const rd = getDoc(r); return rd ? <li key={r}><Link href={`${BASE}/docs/${rd.slug}`}>{rd.title}</Link></li> : null; })}</ul>
            </>
          ) : null}
          <div className="v6-docs__nav">
            {prev ? <Link href={`${BASE}/docs/${prev.slug}`}><span className="l">Previous</span><span className="t">{prev.title}</span></Link> : <span />}
            {next ? <Link className="is-next" href={`${BASE}/docs/${next.slug}`}><span className="l">Next</span><span className="t">{next.title}</span></Link> : <span />}
          </div>
        </article>
      </div>
    </DocShell>
  );
}

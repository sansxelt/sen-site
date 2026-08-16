import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { v6meta } from "../../_system/meta";
import { DocShell, Blocks, DocCode } from "../../_content/docs-ui";
import { DOCS, getDoc, adjacentDocs, docHeadings } from "../../_content/docs";
import { V6_BASE } from "@/lib/v6-routes";

const BASE = V6_BASE;
// Real, runnable examples against the shipped API surface. Only pages where an example is genuinely truthful
// carry one; the rest render without a code block rather than inventing a call that does not exist.
//
// THAT RULE WAS WRITTEN, AND THEN BROKEN IN TWO OF THE THREE EXAMPLES THAT FOLLOWED IT.
//
// The repair example called POST /v1/webhooks. There is no such endpoint: /v1 holds credits, keys and
// verifications, and webhook management lives on a different surface entirely. It is deleted rather than
// repointed, because subscribing to deliveries is not what a reader of the repair page came for, and the
// renderer already handles a page with no example.
//
// The first example posted to api.vraelis.com with an Authorization: Bearer header. The host does not exist
// and the header is not the one the route reads; it is vraelis.com/api/v1 and x-api-key. Worse, it showed a
// single call returning a running verification. A submission with no reviewed_plan_id answers 202
// review_required and runs nothing, which is the product's central promise working exactly as designed, and
// the one example a new reader copies was the one place on the site that denied it.
//
// The line continuations are "\\", not "\". A backslash at the end of a line inside a template literal is a
// LineContinuation: it eats itself AND the newline, so the previous block rendered as one unbroken line with
// no backslashes in it. app/dev-preview/v6/developers/page.tsx already had this right.
const EXAMPLES: Record<string, [string, string]> = {
  "getting-started": ["Submit a claim and get a plan for review", `curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{ "deployment_url": "https://app.example.com",
        "claim": "A paid customer keeps Pro access after signing back in." }'

# 202. Nothing ran and nothing was charged: no plan has been approved yet.
{
  "state": "review_required",
  "review_required": true,
  "human_reviewed": false,
  "reviewed_plan_id": "rvp_3c9e26ef",
  "requirements": ["Signing back in keeps Pro access", "..."]
}

# Approve that plan, then resubmit the same claim with "reviewed_plan_id" to run exactly what was approved.`],
  "completion": ["Read a decision", `GET /v1/verifications/vrf_ff9d6c0d

{
  "id": "vrf_ff9d6c0d",
  "decision": "verified",
  "claim": "A paid customer keeps Pro access after signing back in.",
  "evidence": { "screenshots": 4, "steps": 14 }
}`],
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
      <div className="v6-docs__article">
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
          <div className="v6-docs__pager">
            {prev ? <Link href={`${BASE}/docs/${prev.slug}`}><span className="l">Previous</span><span className="t">{prev.title}</span></Link> : <span />}
            {next ? <Link className="is-next" href={`${BASE}/docs/${next.slug}`}><span className="l">Next</span><span className="t">{next.title}</span></Link> : <span />}
          </div>
        </article>
      </div>
    </DocShell>
  );
}

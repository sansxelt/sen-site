import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { v6meta } from "../../_system/meta";
import { DocShell, Blocks, DocCode } from "../../_content/docs-ui";
import { DOCS, getDoc, adjacentDocs, docHeadings, docToMarkdown } from "../../_content/docs";
import { SURFACES } from "../../_content/coverage";
import { V6_BASE } from "@/lib/v6-routes";
import { robotsMeta } from "@/lib/stealth";

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
//
// UPDATED 2026-09-28. The submit example now shows approve_url, the link a person opens, because an API key
// can no longer approve a plan. The completion example used to read back { "id", "evidence": { "screenshots":
// 4, "steps": 14 } }, a shape the route has never returned; it now shows the real field names from
// GET /v1/verifications/{id}, trimmed.
const EXAMPLES: Record<string, [string, string]> = {
  "getting-started": ["Submit a claim and get a plan for a person to approve", `curl -X POST https://vraelis.com/api/v1/verifications \\
  -H "x-api-key: $VRAELIS_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{ "deployment_url": "https://app.example.com",
        "claim": "A signed-in user can cancel their plan from Billing and then sees Cancelled." }'

# 202. Nothing ran and nothing was charged: no person has approved the plan yet.
{
  "state": "review_required",
  "review_required": true,
  "human_reviewed": false,
  "reviewed_plan_id": "rvp_3c9e26ef",
  "approve_url": "https://app.vraelis.com/review/rvp_3c9e26ef",
  "requirements": ["Cancelling from Billing ends the plan", "Billing then shows Cancelled", "..."]
}

# A person approves at approve_url. Then resubmit the same claim with "reviewed_plan_id" to run it.`],
  "completion": ["Read a decision", `GET /v1/verifications/vrf_ff9d6c0d

{
  "verification_id": "vrf_ff9d6c0d",
  "state": "completed",
  "decision": "verified",
  "claim": "A paid customer keeps Pro access after signing back in.",
  "evidence": [
    { "checking": "Pro access after signing back in", "result": "passed", "failed_at_step": null }
  ],
  "recheck_of": null,
  "human_reviewed": true
}`],
};

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  // AN UNRESOLVED SLUG MUST NOT INVITE INDEXING.
  //
  // The component below calls notFound(), and Next answers 200 rather than 404 for a STREAMED response.
  // Metadata is resolved from THIS segment, not from app/not-found.tsx, so the noindex added there never
  // reached these: /docs/<anything> and /research/<anything> answered 200 with index, follow and a
  // not-found body. That is an unbounded indexable surface under two prefixes.
  if (!doc) return { title: "Not found", robots: robotsMeta(false) };
  return v6meta({ title: doc.title, description: doc.summary, path: `/docs/${doc.slug}`, type: "article" });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const { prev, next } = adjacentDocs(slug);
  const headings = docHeadings(doc);
  return (
    <DocShell activeSlug={slug} toc={headings} crumb={[doc.group, doc.title]}
      markdown={docToMarkdown(doc, SURFACES.map((x) => ({ name: x.name, brief: x.brief, tier: x.tier === "Next" ? "Not built yet" : x.tier })))}>
      <div className="v6-docs__article">
        <article className="v6-prose">
          <h1>{doc.title}</h1>
          <p className="v6-docs__lead">{doc.summary}</p>
          {/* One quiet panel, two rows. These were two heavy boxes stacked under the title. */}
          <dl className="v6-docs__facts">
            <div><dt>Outcome</dt><dd>{doc.outcome}</dd></div>
            {doc.limit ? <div><dt>Does not do</dt><dd>{doc.limit}</dd></div> : null}
          </dl>
          <Blocks blocks={doc.blocks} />
          {EXAMPLES[slug] ? <DocCode label={EXAMPLES[slug][0]} code={EXAMPLES[slug][1]} /> : null}
          {doc.related?.length ? (
            <>
              <h2 id="related">Related</h2>
              <ul className="v6-docs__related">{doc.related.map((r) => { const rd = getDoc(r); return rd ? <li key={r}><Link href={`${BASE}/docs/${rd.slug}`}>{rd.title}<span aria-hidden> →</span></Link></li> : null; })}</ul>
            </>
          ) : null}
          {/* Previous and next as an even pair across the column. It was one lone box floating right. */}
          <nav className="v6-docs__pager" aria-label="Previous and next page">
            {prev ? <Link href={`${BASE}/docs/${prev.slug}`}><span className="l">← Previous</span><span className="t">{prev.title}</span></Link> : <span />}
            {next ? <Link className="is-next" href={`${BASE}/docs/${next.slug}`}><span className="l">Next →</span><span className="t">{next.title}</span></Link> : <span />}
          </nav>
        </article>
      </div>
    </DocShell>
  );
}

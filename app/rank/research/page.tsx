import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { publishedArticles, readingMinutes, formatDate, CATEGORIES, type Article } from "./_articles";
import { ResearchFilter } from "./filter";

export const metadata = ogMeta({
  title: "Research",
  description:
    "Why independent verification matters as AI writes more software. Notes on outcome verification, the gap between a finished agent and a true result, and what evidence a completion claim should require.",
  path: "/research",
});

// Editorial hierarchy: one featured piece, two secondary, then a chronological feed. The hierarchy is a
// claim about importance, so `featured` is authored rather than "whatever is newest".
function Card({ a, size }: { a: Article; size: "lead" | "mid" | "row" }) {
  const lead = size === "lead";
  const mid = size === "mid";
  return (
    <Link
      href={`/research/${a.slug}`}
      style={{
        display: "block", textDecoration: "none", color: "inherit",
        borderTop: "1px solid var(--line-2)", paddingTop: lead ? 22 : 16,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: lead ? 14 : 9 }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--acc-deep)" }}>{a.category}</span>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", color: "var(--fg-5)" }}>{readingMinutes(a)} min</span>
      </div>
      <h2 className="display" style={{
        fontSize: lead ? "clamp(1.75rem, 3.6vw, 2.7rem)" : mid ? "1.22rem" : "1.08rem",
        lineHeight: 1.13, letterSpacing: "-0.02em", margin: "0 0 10px", textWrap: "balance",
      }}>{a.title}</h2>
      <p style={{
        margin: 0, color: "var(--fg-3)", maxWidth: lead ? "58ch" : "46ch",
        fontSize: lead ? "1.05rem" : "0.925rem", lineHeight: 1.55,
      }}>{a.summary}</p>
      <p style={{ margin: "12px 0 0", fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)" }}>{formatDate(a.date)}</p>
    </Link>
  );
}

export default function ResearchPage() {
  const all = publishedArticles();
  const lead = all.find((a) => a.featured) ?? all[0];
  const rest = all.filter((a) => a.slug !== lead?.slug);
  const secondary = rest.slice(0, 2);
  const feed = rest.slice(2);
  const used = new Set(all.map((a) => a.category));

  return (
    <section className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.4 }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 1000 }}>

        <div style={{ maxWidth: 660, marginBottom: "clamp(38px, 5vw, 60px)" }}>
          <p className="eyebrow">Research</p>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3.1rem)", marginBottom: 14, letterSpacing: "-0.025em" }}>
            Why verification becomes the bottleneck.
          </h1>
          {/* The homepage says what Vraelis does. This section says why the problem exists at all, which is
              a different job and needs a different register. */}
          <p className="lead-copy">
            AI writes more software every month and the number of people able to personally confirm it works
            has not moved. These are notes on that gap: what a completion claim actually establishes, why a
            system cannot settle the question about itself, and what evidence should be required before
            anyone relies on the result.
          </p>
        </div>

        {lead && (
          <div style={{ marginBottom: 40 }}>
            <Card a={lead} size="lead" />
          </div>
        )}

        {secondary.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 26, marginBottom: 46 }}>
            {secondary.map((a) => <Card key={a.slug} a={a} size="mid" />)}
          </div>
        )}

        {/* Filters live inside the page rather than becoming navigation entries, so the nav stays four
            items and the categories can change without touching the site header. */}
        <ResearchFilter
          categories={CATEGORIES.filter((c) => used.has(c))}
          items={feed.map((a) => ({
            slug: a.slug, title: a.title, summary: a.summary, category: a.category,
            date: formatDate(a.date), minutes: readingMinutes(a),
          }))}
        />

        {feed.length === 0 && (
          <p style={{ borderTop: "1px solid var(--line-2)", paddingTop: 18, color: "var(--fg-4)", fontSize: 14 }}>
            More notes are being written. The next one covers a full verification loop, from a failed claim
            through a repair to a second verdict, using the output of a real run.
          </p>
        )}
      </div>
    </section>
  );
}

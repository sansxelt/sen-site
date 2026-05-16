import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import { LearnPieceView } from "@/components/learn/learn-piece-view";
import { getPieceWithChapters } from "@/lib/learn-db";
import { isAdminEmail } from "@/lib/admin";

// DB-backed Learn detail page. /learn/p/[slug] always lands on the
// first chapter so the canonical share URL stays clean. Chapters
// 2+ live at /learn/p/[slug]/[chapter-slug].
//
// 404s on drafts so unpublished work doesn't leak via slug guessing.

export const revalidate = 300; // 5 min, so new pieces propagate without redeploy

const CANONICAL_BASE = "https://www.VRAELIS.ai";

type Params = { slug: string };

function authorName(
  authorEmail: string | null,
  authorDisplayName: string | null,
): string {
  if (authorDisplayName && authorDisplayName.trim().length > 0) {
    return authorDisplayName;
  }
  if (!authorEmail || isAdminEmail(authorEmail)) return "VRAELIS (OWNER)";
  return authorEmail;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const piece = await getPieceWithChapters(slug);
  if (!piece || piece.status !== "published") {
    return { title: "Not found" };
  }
  const url = `${CANONICAL_BASE}/learn/p/${piece.slug}`;
  return {
    title: piece.title,
    description: piece.excerpt ?? undefined,
    alternates: { canonical: url },
    authors: [{ name: authorName(piece.author_email, piece.author_display_name) }],
    openGraph: {
      title: piece.title,
      description: piece.excerpt ?? undefined,
      type: "article",
      url,
      siteName: "VRAELIS",
      publishedTime: piece.published_at ?? undefined,
      modifiedTime: piece.updated_at,
      authors: [authorName(piece.author_email, piece.author_display_name)],
      tags: [piece.topic, piece.subtopic ?? ""].filter(Boolean),
    },
    twitter: {
      card: "summary_large_image",
      title: piece.title,
      description: piece.excerpt ?? undefined,
    },
  };
}

export default async function LearnPiecePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const piece = await getPieceWithChapters(slug);
  if (!piece || piece.status !== "published" || piece.chapters.length === 0) {
    notFound();
  }

  // JSON-LD Article schema. Google reads this for rich-result
  // eligibility (article cards in search, author/date display) and
  // for general topical understanding. Inline <script> in the page
  // is the standard pattern; Next.js handles the SSR fine.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: piece.title,
    description: piece.excerpt ?? undefined,
    datePublished: piece.published_at ?? undefined,
    dateModified: piece.updated_at,
    author: {
      "@type": "Person",
      name: authorName(piece.author_email, piece.author_display_name),
    },
    publisher: {
      "@type": "Organization",
      name: "VRAELIS",
      url: "https://www.VRAELIS.ai",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${CANONICAL_BASE}/learn/p/${piece.slug}`,
    },
    articleSection: piece.topic,
    keywords: [piece.topic, piece.subtopic, ...piece.sources.map((s) => s.title ?? s.url).filter(Boolean)]
      .filter(Boolean)
      .join(", "),
    citation: piece.sources.map((s) => ({
      "@type": "CreativeWork",
      name: s.title ?? s.url,
      url: s.url,
    })),
  };

  return (
    <>
      <AuroraBackground />
      <LearnShell>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <LearnPieceView piece={piece} activeChapter={piece.chapters[0]} />
      </LearnShell>
    </>
  );
}

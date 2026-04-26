import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import { LearnPieceView } from "@/components/learn/learn-piece-view";
import { getPieceWithChapters } from "@/lib/learn-db";

// Specific-chapter page for multi-chapter pieces. The first chapter
// canonicalizes to /learn/p/[slug] (no chapter segment). Visiting
// it via this route 308-redirects so we don't index two URLs for
// the same content.

export const revalidate = 300;

type Params = { slug: string; chapter: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, chapter } = await params;
  const piece = await getPieceWithChapters(slug);
  if (!piece || piece.status !== "published") return { title: "Not found" };
  const ch = piece.chapters.find((c) => c.slug === chapter);
  if (!ch) return { title: "Not found" };
  return {
    title: `${ch.title} · ${piece.title}`,
    description: piece.excerpt ?? undefined,
  };
}

export default async function LearnPieceChapterPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, chapter } = await params;
  const piece = await getPieceWithChapters(slug);
  if (!piece || piece.status !== "published" || piece.chapters.length === 0) {
    notFound();
  }
  const idx = piece.chapters.findIndex((c) => c.slug === chapter);
  if (idx < 0) notFound();
  // Canonicalize: chapter 0 lives at /learn/p/[slug], not here.
  if (idx === 0) redirect(`/learn/p/${piece.slug}`);

  return (
    <>
      <AuroraBackground />
      <LearnShell>
        <LearnPieceView piece={piece} activeChapter={piece.chapters[idx]} />
      </LearnShell>
    </>
  );
}

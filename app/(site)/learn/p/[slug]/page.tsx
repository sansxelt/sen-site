import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import { LearnPieceView } from "@/components/learn/learn-piece-view";
import { getPieceWithChapters } from "@/lib/learn-db";

// DB-backed Learn detail page. /learn/p/[slug] always lands on the
// first chapter so the canonical share URL stays clean — chapters
// 2+ live at /learn/p/[slug]/[chapter-slug].
//
// 404s on drafts so unpublished work doesn't leak via slug guessing.

export const revalidate = 300; // 5 min — new pieces propagate without redeploy

type Params = { slug: string };

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
  return {
    title: piece.title,
    description: piece.excerpt ?? undefined,
    openGraph: {
      title: piece.title,
      description: piece.excerpt ?? undefined,
      type: "article",
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

  return (
    <>
      <AuroraBackground />
      <LearnShell>
        <LearnPieceView piece={piece} activeChapter={piece.chapters[0]} />
      </LearnShell>
    </>
  );
}

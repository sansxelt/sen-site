import type { ReactNode } from "react";
import { LearnSidebar } from "./learn-sidebar";
import { TOPICS, countArticlesInTopic, type TopicKey } from "@/lib/learn-content";
import { listPublishedPieces } from "@/lib/learn-db";

// Wraps every /learn page in a 2-column layout: sticky sidebar on
// the left, content on the right. Sidebar is hidden below `lg` so
// mobile gets a single column. The activeTopic / activeSubtopic
// props let article pages tell the sidebar which row to highlight
// (URL alone can't, since article URLs are /learn/[slug]).
//
// Topic counts are computed server-side here (hardcoded ARTICLES
// + DB-published pieces) and passed down to the client sidebar
// via prop so the sidebar numbers always match the topic-card
// counts on /learn.
export async function LearnShell({
  children,
  activeTopic,
  activeSubtopic,
}: {
  children: ReactNode;
  activeTopic?: TopicKey;
  activeSubtopic?: string;
}) {
  const dbPieces = await listPublishedPieces({ limit: 200 });
  const topicCounts: Record<string, number> = {};
  for (const t of TOPICS) {
    const dbCount = dbPieces.filter((p) => p.topic === t.key).length;
    topicCounts[t.key] = countArticlesInTopic(t.key) + dbCount;
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
      <div className="flex gap-8 lg:gap-10">
        <div className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto py-6">
            <LearnSidebar
              activeTopic={activeTopic}
              activeSubtopic={activeSubtopic}
              topicCounts={topicCounts}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { LearnSidebar } from "./learn-sidebar";
import type { TopicKey } from "@/lib/learn-content";

// Wraps every /learn page in a 2-column layout: sticky sidebar on
// the left, content on the right. Sidebar is hidden below `lg` so
// mobile gets a single column. The activeTopic / activeSubtopic
// props let article pages tell the sidebar which row to highlight
// (URL alone can't, since article URLs are /learn/[slug]).
export function LearnShell({
  children,
  activeTopic,
  activeSubtopic,
}: {
  children: ReactNode;
  activeTopic?: TopicKey;
  activeSubtopic?: string;
}) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
      <div className="flex gap-8 lg:gap-10">
        <div className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto py-6">
            <LearnSidebar
              activeTopic={activeTopic}
              activeSubtopic={activeSubtopic}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

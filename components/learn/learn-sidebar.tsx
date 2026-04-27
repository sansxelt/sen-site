"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TOPICS,
  countArticlesInTopic,
  type TopicKey,
} from "@/lib/learn-content";
import { useState } from "react";

// Sticky left rail for /learn pages. Renders the full topic tree
// with expandable subtopics. Highlights the active topic / subtopic
// based on URL (works on /learn/topics/[topic] and
// /learn/topics/[topic]/[subtopic]). On article pages, falls back to
// the article's topic via `activeTopic` prop.

type Props = {
  // The article page can't pull the active topic from the URL
  // (URL is /learn/[slug], not /learn/topics/...), so it passes
  // the value down explicitly.
  activeTopic?: TopicKey;
  activeSubtopic?: string;
  // Server-computed counts: hardcoded + DB-published pieces per
  // topic. Overrides the hardcoded-only fallback used when this
  // prop isn't passed.
  topicCounts?: Record<string, number>;
};

export function LearnSidebar({ activeTopic, activeSubtopic, topicCounts }: Props) {
  const pathname = usePathname() ?? "";
  // Auto-expand the active topic so the user can see where they are.
  // Other topics start collapsed to keep the rail readable; they
  // expand on click.
  const initialExpanded = new Set<TopicKey>();
  if (activeTopic) initialExpanded.add(activeTopic);
  // Also infer from URL for the topic + subtopic landing pages.
  const m = pathname.match(/^\/learn\/topics\/([^/]+)/);
  if (m) initialExpanded.add(m[1] as TopicKey);
  const [expanded, setExpanded] = useState<Set<TopicKey>>(initialExpanded);

  const toggle = (key: TopicKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isTopicActive = (key: TopicKey) => {
    if (activeTopic === key) return true;
    return pathname === `/learn/topics/${key}`;
  };
  const isSubtopicActive = (topicKey: TopicKey, subKey: string) => {
    if (activeTopic === topicKey && activeSubtopic === subKey) return true;
    return pathname === `/learn/topics/${topicKey}/${subKey}`;
  };

  return (
    <aside className="learn-sidebar">
      <div className="mb-3">
        <Link
          href="/learn"
          className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
            pathname === "/learn"
              ? "bg-white/10 text-white"
              : "text-neutral-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          All articles
        </Link>
      </div>

      <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        Topics
      </div>

      <nav className="flex flex-col gap-0.5">
        {TOPICS.map((topic) => {
          const open = expanded.has(topic.key);
          const count = topicCounts?.[topic.key] ?? countArticlesInTopic(topic.key);
          const active = isTopicActive(topic.key);
          return (
            <div key={topic.key}>
              <div className="flex items-center gap-1">
                <Link
                  href={`/learn/topics/${topic.key}`}
                  className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
                  }`}
                >
                  <span className="flex-1 truncate">{topic.label}</span>
                  <span className={`text-[11px] tabular-nums ${count > 0 ? "text-neutral-300" : "text-neutral-600"}`}>{count}</span>
                </Link>
                {topic.subtopics.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggle(topic.key)}
                    className="rounded-md p-1 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
                    aria-label={open ? `Collapse ${topic.label}` : `Expand ${topic.label}`}
                    aria-expanded={open}
                  >
                    <span aria-hidden className="block text-[10px] leading-none">
                      {open ? "▾" : "▸"}
                    </span>
                  </button>
                )}
              </div>
              {open && topic.subtopics.length > 0 && (
                <div className="ml-7 mt-0.5 flex flex-col gap-0.5 border-l border-white/[0.06] pl-3">
                  {topic.subtopics.map((sub) => {
                    const subActive = isSubtopicActive(topic.key, sub.key);
                    return (
                      <Link
                        key={sub.key}
                        href={`/learn/topics/${topic.key}/${sub.key}`}
                        className={`rounded-md px-2.5 py-1 text-xs transition ${
                          subActive
                            ? "bg-white/10 text-white"
                            : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
                        }`}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

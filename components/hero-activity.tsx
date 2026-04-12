"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HeroScenario = {
  ask: string;
  apps: Array<{
    description: string;
    name: string;
    time: string;
  }>;
  summary: string;
  word: string;
};

const scenarios: HeroScenario[] = [
  {
    ask: "What was I creating before Discord?",
    apps: [
      {
        description: "Blocking out gameplay systems and testing flow.",
        name: "Roblox Studio",
        time: "1h 42m",
      },
      {
        description: "References, docs, and quick examples.",
        name: "Browser",
        time: "48m",
      },
      {
        description: "Feedback loops and quick team replies.",
        name: "Discord",
        time: "21m",
      },
    ],
    summary:
      "You spent most of your time creating, with the strongest focus block in your editor before checking references and messages.",
    word: "creating",
  },
  {
    ask: "What was I building before I switched tabs?",
    apps: [
      {
        description: "Shipping core systems and tightening logic.",
        name: "VS Code",
        time: "1h 36m",
      },
      {
        description: "API docs, stack traces, and examples.",
        name: "Browser",
        time: "54m",
      },
      {
        description: "Commits, issues, and branch notes.",
        name: "GitHub",
        time: "26m",
      },
    ],
    summary:
      "You were building steadily, with most of the session spent in code before moving into docs and repo cleanup.",
    word: "building",
  },
  {
    ask: "What was I writing before I paused?",
    apps: [
      {
        description: "Drafting copy and tightening structure.",
        name: "Notion",
        time: "1h 18m",
      },
      {
        description: "Reference links, fact checks, and examples.",
        name: "Browser",
        time: "41m",
      },
      {
        description: "Quick comments and stakeholder replies.",
        name: "Slack",
        time: "19m",
      },
    ],
    summary:
      "You were writing with a steady pace, then breaking briefly into research and replies before returning to the draft.",
    word: "writing",
  },
  {
    ask: "What was I researching before I opened chat?",
    apps: [
      {
        description: "Comparing sources and gathering references.",
        name: "Browser",
        time: "1h 27m",
      },
      {
        description: "Collecting notes and saving takeaways.",
        name: "Notion",
        time: "36m",
      },
      {
        description: "Questions, updates, and clarifications.",
        name: "Discord",
        time: "17m",
      },
    ],
    summary:
      "You were researching across multiple sources, then consolidating notes before jumping into a short conversation.",
    word: "researching",
  },
  {
    ask: "What was I designing before feedback came in?",
    apps: [
      {
        description: "Working through layout, spacing, and states.",
        name: "Figma",
        time: "1h 24m",
      },
      {
        description: "Visual references and competitor patterns.",
        name: "Browser",
        time: "44m",
      },
      {
        description: "Review notes and quick design comments.",
        name: "Slack",
        time: "16m",
      },
    ],
    summary:
      "You were designing in focused stretches, with short breaks for visual reference checks and incoming feedback.",
    word: "designing",
  },
];

export function HeroActivity({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener("change", updatePreference);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, 2400);

    const swapTimer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % scenarios.length);
      setVisible(true);
    }, 3000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(swapTimer);
    };
  }, [index, reducedMotion]);

  const activeScenario = useMemo(() => scenarios[index], [index]);

  return (
    <>
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-200 sm:text-xs">
          <span className="h-2 w-2 rounded-full bg-white/80" />
          Premium workspace memory for focused work
        </div>

        <h1 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-7xl">
          <span className="block">The AI that</span>
          <span className="block">remembers what</span>
          <span className="sr-only">
            The AI that remembers what you were {activeScenario.word}.
          </span>
          <span className="block" aria-hidden="true">
            you were{" "}
            <span className="relative inline-flex min-h-[1.1em] min-w-[7ch] items-center">
              <span
                className={`inline-block transition-all duration-700 ease-out ${
                  visible || reducedMotion
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-0"
                }`}
              >
                {activeScenario.word}.
              </span>
            </span>
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-7 text-neutral-200 sm:mt-6 sm:text-lg">
          sansxel quietly captures work context, keeps it organized, and
          gives you a calm way to resume, reflect, and move forward without
          losing the thread.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/account"
            className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            {isSignedIn ? "Open workspace" : "Get started"}
          </Link>
          {!isSignedIn && (
            <Link
              href="/#auth"
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
            >
              Create account
            </Link>
          )}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Fast", "Resume work instantly with a lightweight desktop feel."],
            ["Private", "Clear controls for pause, export, and deletion."],
            ["Useful", "Built around context, not generic busywork."],
          ].map(([title, text]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="text-sm font-medium text-white">{title}</div>
              <div className="mt-1 text-sm leading-6 text-neutral-200">
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4">
          <div className="rounded-[24px] border border-white/10 bg-neutral-900/90 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="text-sm font-medium text-white">Today</div>
                <div className="text-xs text-neutral-200">
                  Thursday - 4h 18m tracked
                </div>
              </div>
              <Link
                href="/account"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 transition hover:bg-white/10"
              >
                Workspace
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {activeScenario.apps.map((app) => (
                <div
                  key={`${activeScenario.word}-${app.name}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white">
                      {app.name}
                    </div>
                    <div className="text-xs text-neutral-200">{app.time}</div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-neutral-200">
                    {app.description}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-sky-200">
                sansxel summary
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-200">
                {activeScenario.summary}
              </p>
            </div>

            <Link
              href="/account"
              className="mt-5 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
            >
              <div className="text-xs text-neutral-300">Ask sansxel</div>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
                {activeScenario.ask}
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

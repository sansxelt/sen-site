"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ActivityCard = {
  description: string;
  name: string;
  time: string;
};

type MetricCard = {
  label: string;
  value: string;
};

type MemoryItem = {
  note: string;
  time: string;
  title: string;
};

type HeroScenario = {
  accent: string;
  ask: string;
  header: string;
  insight: string;
  metrics?: MetricCard[];
  mode: "activity" | "metrics" | "memory";
  previewLabel: string;
  summary: string;
  timeline?: ActivityCard[];
  trail?: MemoryItem[];
  word: string;
};

const scenarios: HeroScenario[] = [
  {
    accent: "Today",
    ask: "What was I creating before Discord?",
    header: "Workspace",
    insight: "Strongest focus block happened inside your editor before references and team replies.",
    mode: "activity",
    previewLabel: "Activity recall",
    summary:
      "You spent most of your time creating, with your clearest momentum showing up before the first context switch.",
    timeline: [
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
    word: "creating",
  },
  {
    accent: "Signals",
    ask: "Where was I losing momentum while planning?",
    header: "Workspace",
    insight: "Most hesitation happened after the outline was set and before the next step was chosen.",
    metrics: [
      { label: "Focus score", value: "82%" },
      { label: "Context saved", value: "14 notes" },
      { label: "Next actions", value: "3 clear" },
    ],
    mode: "metrics",
    previewLabel: "Planning signals",
    summary:
      "You were planning in structured bursts, with the AI surfacing where the next decision was getting sticky.",
    word: "planning",
  },
  {
    accent: "Memory",
    ask: "What was I designing before feedback came in?",
    header: "Workspace",
    insight: "The last stable design direction was saved before feedback started to fragment the session.",
    mode: "memory",
    previewLabel: "Design trail",
    summary:
      "You were designing through layout and state decisions, then breaking into short feedback checks before returning.",
    trail: [
      {
        note: "Locked spacing and card rhythm for the auth screen.",
        time: "2:14 PM",
        title: "Checkpoint saved",
      },
      {
        note: "Compared reference flows and removed two crowded blocks.",
        time: "2:36 PM",
        title: "Pattern review",
      },
      {
        note: "Prepared the next revision before opening comments.",
        time: "2:52 PM",
        title: "Ready to resume",
      },
    ],
    word: "designing",
  },
  {
    accent: "Revenue",
    ask: "How was monetization trending while I was analyzing?",
    header: "Workspace",
    insight: "Retention and conversion improved together once onboarding friction dropped.",
    metrics: [
      { label: "Day-7 retention", value: "+8.4%" },
      { label: "Trial conversion", value: "12.8%" },
      { label: "MRR trend", value: "+$4.2k" },
    ],
    mode: "metrics",
    previewLabel: "Monetization view",
    summary:
      "You were analyzing product health across retention and revenue, with the clearest lift tied to smoother onboarding.",
    word: "analyzing",
  },
  {
    accent: "Today",
    ask: "What was I building before I switched tabs?",
    header: "Workspace",
    insight: "The main build block stayed intact until you broke for implementation checks.",
    mode: "activity",
    previewLabel: "Build recall",
    summary:
      "You were building steadily, with the session centered around shipping core behavior before checking documentation.",
    timeline: [
      {
        description: "Shipping core systems and tightening logic.",
        name: "VS Code",
        time: "1h 31m",
      },
      {
        description: "Patterns, docs, and implementation checks.",
        name: "Browser",
        time: "47m",
      },
      {
        description: "Commit notes and quick repo cleanup.",
        name: "GitHub",
        time: "18m",
      },
    ],
    word: "building",
  },
  {
    accent: "Memory",
    ask: "What was I writing before I paused?",
    header: "Workspace",
    insight: "The draft had a stable shape before messages pulled you away from the writing block.",
    mode: "memory",
    previewLabel: "Writing trail",
    summary:
      "You were writing in long stretches, then briefly stepping into references and replies before returning to the draft.",
    trail: [
      {
        note: "Locked the opening paragraph and shortened the supporting copy.",
        time: "11:08 AM",
        title: "Draft checkpoint",
      },
      {
        note: "Pulled two examples to support the argument.",
        time: "11:21 AM",
        title: "Reference pass",
      },
      {
        note: "Left off near the close and CTA language.",
        time: "11:34 AM",
        title: "Resume point",
      },
    ],
    word: "writing",
  },
  {
    accent: "Signals",
    ask: "What was I refining before the next review?",
    header: "Workspace",
    insight: "Most refinements happened in small polish loops, not in large structural changes.",
    metrics: [
      { label: "Polish passes", value: "9" },
      { label: "UI issues closed", value: "6" },
      { label: "Open blockers", value: "1" },
    ],
    mode: "metrics",
    previewLabel: "Refinement signals",
    summary:
      "You were refining the experience in short focused passes, with the AI showing where the rough edges were disappearing.",
    word: "refining",
  },
  {
    accent: "Today",
    ask: "What was I researching before chat opened?",
    header: "Workspace",
    insight: "The strongest source cluster stayed around implementation references and competitive patterns.",
    mode: "activity",
    previewLabel: "Research recall",
    summary:
      "You were researching across multiple sources, then consolidating takeaways before moving into discussion.",
    timeline: [
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
    word: "researching",
  },
  {
    accent: "Memory",
    ask: "Where was I iterating before I stopped?",
    header: "Workspace",
    insight: "The strongest progress came from tight iteration loops with quick validation in between.",
    mode: "memory",
    previewLabel: "Iteration trail",
    summary:
      "You were iterating rapidly, keeping changes small enough that the session still has a clean path back in.",
    trail: [
      {
        note: "Adjusted spacing, tested, then kept the cleaner version.",
        time: "4:02 PM",
        title: "Iteration 04",
      },
      {
        note: "Changed hierarchy and removed one noisy detail.",
        time: "4:11 PM",
        title: "Iteration 05",
      },
      {
        note: "Left off with one more pass clearly queued.",
        time: "4:19 PM",
        title: "Next pass ready",
      },
    ],
    word: "iterating",
  },
  {
    accent: "Signals",
    ask: "What was I debugging before the fix landed?",
    header: "Workspace",
    insight: "The error cluster narrowed fast once the reproduction path was stable.",
    metrics: [
      { label: "Repros captured", value: "4" },
      { label: "Crash rate", value: "-63%" },
      { label: "Likely causes", value: "2 left" },
    ],
    mode: "metrics",
    previewLabel: "Debug signals",
    summary:
      "You were debugging with a cleaner signal than before, with the AI reducing the search space around the likely cause.",
    word: "debugging",
  },
  {
    accent: "Today",
    ask: "What was I reviewing before I replied?",
    header: "Workspace",
    insight: "Most review time went into finding risks and tightening the next response.",
    mode: "activity",
    previewLabel: "Review recall",
    summary:
      "You were reviewing carefully, balancing detail checks with fast decisions about what needed to change next.",
    timeline: [
      {
        description: "Scanning diffs and identifying regressions.",
        name: "GitHub",
        time: "52m",
      },
      {
        description: "Opening files and validating behavior.",
        name: "VS Code",
        time: "39m",
      },
      {
        description: "Writing feedback and next-step notes.",
        name: "Slack",
        time: "14m",
      },
    ],
    word: "reviewing",
  },
  {
    accent: "Memory",
    ask: "What was I shipping before the release note?",
    header: "Workspace",
    insight: "The release path was already clear before the final packaging step started.",
    mode: "memory",
    previewLabel: "Release trail",
    summary:
      "You were shipping with the key milestones already in place, so coming back in should feel direct and low-friction.",
    trail: [
      {
        note: "Finalized the last release blocker and marked it ready.",
        time: "6:03 PM",
        title: "Release checkpoint",
      },
      {
        note: "Prepared notes and confirmed the version details.",
        time: "6:12 PM",
        title: "Release notes",
      },
      {
        note: "Left off right before the publish step.",
        time: "6:18 PM",
        title: "Ready to ship",
      },
    ],
    word: "shipping",
  },
];

const playOrder = [0, 4, 1, 7, 3, 10, 2, 8, 5, 11, 6, 9];

function DashboardFrame({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4">
        <div className="rounded-[24px] border border-white/10 bg-neutral-900/90 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="text-sm font-medium text-white">{label}</div>
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

          {children}
        </div>
      </div>
    </div>
  );
}

function ActivityPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <DashboardFrame label={scenario.accent}>
      <div className="mt-5 space-y-3">
        {scenario.timeline?.map((app) => (
          <div
            key={`${scenario.word}-${app.name}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white">{app.name}</div>
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
          {scenario.previewLabel}
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          {scenario.summary}
        </p>
      </div>

      <Link
        href="/account"
        className="mt-5 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
      >
        <div className="text-xs text-neutral-300">Ask sansxel</div>
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
          {scenario.ask}
        </div>
      </Link>
    </DashboardFrame>
  );
}

function MetricsPreview({ scenario }: { scenario: HeroScenario }) {
  const bars = [44, 68, 57, 81, 73, 90, 76];

  return (
    <DashboardFrame label={scenario.accent}>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {scenario.metrics?.map((metric) => (
          <div
            key={`${scenario.word}-${metric.label}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
              {metric.label}
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-end gap-2">
          {bars.map((bar, index) => (
            <div key={`${scenario.word}-bar-${index}`} className="flex-1">
              <div
                className="rounded-t-xl bg-gradient-to-t from-white/20 to-white/70 transition-all duration-700"
                style={{ height: `${bar}px` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-neutral-200">
          {scenario.insight}
        </p>
      </div>

      <Link
        href="/account"
        className="mt-5 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
      >
        <div className="text-xs text-neutral-300">Ask sansxel</div>
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
          {scenario.ask}
        </div>
      </Link>
    </DashboardFrame>
  );
}

function MemoryPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <DashboardFrame label={scenario.accent}>
      <div className="mt-5 space-y-3">
        {scenario.trail?.map((item) => (
          <div
            key={`${scenario.word}-${item.title}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{item.title}</div>
              <div className="text-xs text-neutral-400">{item.time}</div>
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-200">
              {item.note}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">
          {scenario.previewLabel}
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          {scenario.summary}
        </p>
      </div>

      <Link
        href="/account"
        className="mt-5 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
      >
        <div className="text-xs text-neutral-300">Ask sansxel</div>
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
          {scenario.ask}
        </div>
      </Link>
    </DashboardFrame>
  );
}

export function HeroActivity({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  const [step, setStep] = useState(0);
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
    }, 5600);

    const swapTimer = window.setTimeout(() => {
      setStep((current) => (current + 1) % playOrder.length);
      setVisible(true);
    }, 6400);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(swapTimer);
    };
  }, [reducedMotion, step]);

  const activeScenario = scenarios[playOrder[step]];

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
            <span className="relative inline-flex min-h-[1.1em] min-w-[8ch] items-center">
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

      {activeScenario.mode === "metrics" ? (
        <MetricsPreview scenario={activeScenario} />
      ) : activeScenario.mode === "memory" ? (
        <MemoryPreview scenario={activeScenario} />
      ) : (
        <ActivityPreview scenario={activeScenario} />
      )}
    </>
  );
}

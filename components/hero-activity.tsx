"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type InsightCard = {
  label: string;
  value: string;
};

type HeroScenario = {
  accent: string;
  ask: string;
  assistantCards?: InsightCard[];
  header: string;
  insight: string;
  metrics?: MetricCard[];
  mode: "activity" | "assistant" | "metrics" | "memory";
  modeLabel: string;
  previewLabel: string;
  promptLabel: string;
  summary: string;
  timeline?: ActivityCard[];
  trail?: MemoryItem[];
  word: string;
};

const WORD_CYCLE_MS = 5200;
const WORD_FADE_MS = 450;

const scenarios: HeroScenario[] = [
  {
    accent: "Today",
    ask: "What was I creating before feedback pulled me away?",
    header: "Workspace",
    insight:
      "Your deepest flow stayed in the editor until feedback checks started to fragment the session.",
    mode: "activity",
    modeLabel: "Live activity",
    previewLabel: "Creative recall",
    promptLabel: "Resume creation",
    summary:
      "sansxel rebuilds the exact stretch where you were creating, so you can return to the same momentum instead of rethinking the work.",
    timeline: [
      {
        description: "Blocking out interaction states and scene flow.",
        name: "Roblox Studio",
        time: "1h 38m",
      },
      {
        description: "Reference pulls and quick implementation checks.",
        name: "Browser",
        time: "41m",
      },
      {
        description: "Feedback notes and next edits.",
        name: "Discord",
        time: "18m",
      },
    ],
    word: "creating",
  },
  {
    accent: "Workspace",
    ask: "What was I making right before I switched projects?",
    assistantCards: [
      { label: "Primary block", value: "Homepage auth polish" },
      { label: "Next move", value: "Tighten provider spacing" },
      { label: "Confidence", value: "High" },
    ],
    header: "Builder",
    insight:
      "The strongest block happened before the second context switch, when the task stack was still clean.",
    mode: "assistant",
    modeLabel: "Direct answer",
    previewLabel: "Resume answer",
    promptLabel: "Resume making",
    summary:
      "The AI answers in plain language, with the exact block, intent, and next step already surfaced for you.",
    word: "making",
  },
  {
    accent: "Today",
    ask: "Where did I leave off while building?",
    header: "Workspace",
    insight:
      "The build path stayed focused until you paused for docs and repo checks.",
    mode: "activity",
    modeLabel: "Live activity",
    previewLabel: "Build recall",
    promptLabel: "Resume build",
    summary:
      "Building sessions stay readable, so the system can show what you touched, why you switched, and where to pick back up.",
    timeline: [
      {
        description: "Shipping core logic and wiring account state.",
        name: "VS Code",
        time: "1h 29m",
      },
      {
        description: "Library docs and route checks.",
        name: "Browser",
        time: "36m",
      },
      {
        description: "Commit cleanup and issue review.",
        name: "GitHub",
        time: "16m",
      },
    ],
    word: "building",
  },
  {
    accent: "Memory",
    ask: "What direction was I crafting before the review?",
    header: "Workspace",
    insight:
      "The design direction was already narrowing before comments introduced new branches.",
    mode: "memory",
    modeLabel: "Memory trail",
    previewLabel: "Design trail",
    promptLabel: "Resume craft",
    summary:
      "Crafting work is saved as checkpoints, so you can re-enter the same visual direction without hunting through tabs.",
    trail: [
      {
        note: "Locked the cleaner card rhythm for the auth panel.",
        time: "2:14 PM",
        title: "Checkpoint saved",
      },
      {
        note: "Removed the noisy provider copy and tightened spacing.",
        time: "2:28 PM",
        title: "Polish pass",
      },
      {
        note: "Queued one final mobile alignment pass.",
        time: "2:37 PM",
        title: "Resume point",
      },
    ],
    word: "crafting",
  },
  {
    accent: "Memory",
    ask: "What was I writing before chat opened?",
    header: "Workspace",
    insight:
      "The draft had a clear shape before incoming messages broke the writing block.",
    mode: "memory",
    modeLabel: "Memory trail",
    previewLabel: "Writing trail",
    promptLabel: "Resume writing",
    summary:
      "Writing sessions keep their structure, so sansxel can bring you back to the paragraph, source, and next sentence that mattered.",
    trail: [
      {
        note: "Locked the opening paragraph and shortened the support copy.",
        time: "11:08 AM",
        title: "Draft checkpoint",
      },
      {
        note: "Pulled two examples to strengthen the CTA.",
        time: "11:21 AM",
        title: "Reference pass",
      },
      {
        note: "Left off near the closing line and next section handoff.",
        time: "11:34 AM",
        title: "Ready to resume",
      },
    ],
    word: "writing",
  },
  {
    accent: "Signals",
    ask: "Where was I planning too slowly?",
    header: "Planner",
    insight:
      "Momentum dipped after the outline was set, not while the ideas were still forming.",
    metrics: [
      { label: "Decision lag", value: "14 min" },
      { label: "Clear next steps", value: "3" },
      { label: "Saved notes", value: "11" },
    ],
    mode: "metrics",
    modeLabel: "Signal view",
    previewLabel: "Planning signals",
    promptLabel: "Planning answer",
    summary:
      "Planning views show where direction was clear, where it slowed down, and what should happen next without extra guesswork.",
    word: "planning",
  },
  {
    accent: "Today",
    ask: "What was I researching before I replied?",
    header: "Workspace",
    insight:
      "The strongest source cluster stayed around implementation references and competitive patterns.",
    mode: "activity",
    modeLabel: "Live activity",
    previewLabel: "Research recall",
    promptLabel: "Resume research",
    summary:
      "Research sessions stay organized by source and purpose, so resuming feels like opening a map instead of redoing the search.",
    timeline: [
      {
        description: "Comparing examples and implementation references.",
        name: "Browser",
        time: "1h 16m",
      },
      {
        description: "Saving notes and short takeaways.",
        name: "Notion",
        time: "33m",
      },
      {
        description: "Questions and quick team clarifications.",
        name: "Discord",
        time: "14m",
      },
    ],
    word: "researching",
  },
  {
    accent: "Revenue",
    ask: "How was retention trending while I was analyzing?",
    header: "Signals",
    insight:
      "Retention and conversion both lifted after onboarding friction dropped and the first-value moment got faster.",
    metrics: [
      { label: "Day-7 retention", value: "+8.4%" },
      { label: "Trial conversion", value: "12.8%" },
      { label: "MRR trend", value: "+$4.2k" },
    ],
    mode: "metrics",
    modeLabel: "Signal view",
    previewLabel: "Growth signals",
    promptLabel: "Growth answer",
    summary:
      "When the work turns analytical, the interface shifts into retention, monetization, and conversion views that explain what changed.",
    word: "analyzing",
  },
  {
    accent: "Forecast",
    ask: "What changed in revenue while I was forecasting?",
    header: "Forecast",
    insight:
      "The clearest upside came from better team retention, not from pushing trial volume harder.",
    metrics: [
      { label: "Projected MRR", value: "$28.4k" },
      { label: "Expansion lift", value: "+17%" },
      { label: "Churn risk", value: "Low" },
    ],
    mode: "metrics",
    modeLabel: "Forecast view",
    previewLabel: "Forecast view",
    promptLabel: "Forecast answer",
    summary:
      "Forecasting should look different from simple activity recall, so sansxel pivots into forward-looking revenue and retention signals.",
    word: "forecasting",
  },
  {
    accent: "Workspace",
    ask: "What part was I refining before the next pass?",
    assistantCards: [
      { label: "Polish passes", value: "9" },
      { label: "Issues closed", value: "6" },
      { label: "Next fix", value: "Mobile header spacing" },
    ],
    header: "Refinement",
    insight:
      "Most refinements happened in small loops, not through large rewrites.",
    mode: "assistant",
    modeLabel: "Direct answer",
    previewLabel: "Refinement answer",
    promptLabel: "Refinement answer",
    summary:
      "Refinement mode answers what changed, what improved, and what still needs attention without drowning the screen in noise.",
    word: "refining",
  },
  {
    accent: "Memory",
    ask: "Where did I leave off while iterating?",
    header: "Workspace",
    insight:
      "The strongest progress came from quick iteration loops with tight validation in between.",
    mode: "memory",
    modeLabel: "Memory trail",
    previewLabel: "Iteration trail",
    promptLabel: "Resume iteration",
    summary:
      "Iteration mode keeps the path back clean, so you can jump into the next pass instead of replaying every previous tweak.",
    trail: [
      {
        note: "Adjusted spacing, tested it, and kept the cleaner version.",
        time: "4:02 PM",
        title: "Iteration 04",
      },
      {
        note: "Changed hierarchy and removed one noisy element.",
        time: "4:11 PM",
        title: "Iteration 05",
      },
      {
        note: "Left off with one final pass already queued.",
        time: "4:19 PM",
        title: "Next pass ready",
      },
    ],
    word: "iterating",
  },
  {
    accent: "Signals",
    ask: "What was breaking while I was debugging?",
    header: "Debugger",
    insight:
      "The failure cluster narrowed fast once the reproduction path stayed stable for a full pass.",
    metrics: [
      { label: "Repros captured", value: "4" },
      { label: "Crash rate", value: "-63%" },
      { label: "Likely causes", value: "2 left" },
    ],
    mode: "metrics",
    modeLabel: "Signal view",
    previewLabel: "Debug signals",
    promptLabel: "Debug answer",
    summary:
      "Debugging mode trades generic history for sharper signals, so the likely cause and last stable state are visible right away.",
    word: "debugging",
  },
  {
    accent: "Today",
    ask: "What risks was I reviewing before I answered?",
    header: "Workspace",
    insight:
      "Most review time went into identifying regression risk and choosing the next fix with confidence.",
    mode: "activity",
    modeLabel: "Live activity",
    previewLabel: "Review recall",
    promptLabel: "Review answer",
    summary:
      "Review mode shows the files, checks, and responses around a decision so you can reply with context instead of memory alone.",
    timeline: [
      {
        description: "Scanning diffs and spotting regressions.",
        name: "GitHub",
        time: "54m",
      },
      {
        description: "Opening files and validating behavior.",
        name: "VS Code",
        time: "37m",
      },
      {
        description: "Writing review notes and next steps.",
        name: "Slack",
        time: "13m",
      },
    ],
    word: "reviewing",
  },
  {
    accent: "Customers",
    ask: "What was moving conversion while I was selling?",
    assistantCards: [
      { label: "Conversion lift", value: "+14%" },
      { label: "Best closer", value: "Clear Pro value" },
      { label: "Next test", value: "Annual CTA" },
    ],
    header: "Revenue",
    insight:
      "The sharpest conversion lift came after pricing clarity improved, not after adding more traffic.",
    mode: "assistant",
    modeLabel: "Direct answer",
    previewLabel: "Sales answer",
    promptLabel: "Sales answer",
    summary:
      "Selling mode turns memory into a readable revenue answer, with the clearest conversion levers already highlighted.",
    word: "selling",
  },
  {
    accent: "Memory",
    ask: "What was I onboarding before I paused?",
    header: "Workspace",
    insight:
      "The flow was smooth until the last setup step, where the new user path needed one clearer handoff.",
    mode: "memory",
    modeLabel: "Memory trail",
    previewLabel: "Onboarding trail",
    promptLabel: "Onboarding answer",
    summary:
      "Onboarding work stays legible as a sequence, so you can reopen the exact blocker instead of re-walking the whole flow.",
    trail: [
      {
        note: "Tightened the welcome copy and removed one extra CTA.",
        time: "9:18 AM",
        title: "Setup pass",
      },
      {
        note: "Matched the callback state to the first account screen.",
        time: "9:29 AM",
        title: "Flow alignment",
      },
      {
        note: "Left one final empty-state clarification to resolve.",
        time: "9:37 AM",
        title: "Next fix",
      },
    ],
    word: "onboarding",
  },
  {
    accent: "Release",
    ask: "What was left before I started shipping?",
    assistantCards: [
      { label: "Last blocker", value: "Resolved" },
      { label: "Release notes", value: "Ready" },
      { label: "Next step", value: "Publish build" },
    ],
    header: "Workspace",
    insight:
      "The release path was already clean before the final packaging step began.",
    mode: "assistant",
    modeLabel: "Direct answer",
    previewLabel: "Release answer",
    promptLabel: "Release answer",
    summary:
      "Shipping mode answers the last blocker, the release state, and the next step in a single glance.",
    word: "shipping",
  },
];

const playOrder = [0, 7, 2, 11, 4, 14, 1, 9, 5, 13, 3, 10, 6, 15, 8, 12];

function DashboardFrame({
  children,
  label,
  modeLabel,
}: {
  children: React.ReactNode;
  label: string;
  modeLabel: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4">
        <div className="rounded-[24px] border border-white/10 bg-neutral-900/90 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="text-sm font-medium text-white">{label}</div>
              <div className="text-xs text-neutral-200">
                Thursday · 4h 18m tracked
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
                {modeLabel}
              </div>
              <Link
                href="/account"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 transition hover:bg-white/10"
              >
                {label}
              </Link>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function PromptCard({
  ask,
  promptLabel,
}: {
  ask: string;
  promptLabel: string;
}) {
  return (
    <Link
      href="/account"
      className="mt-5 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
    >
      <div className="text-xs text-neutral-300">{promptLabel}</div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
        {ask}
      </div>
    </Link>
  );
}

function ActivityPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <DashboardFrame label={scenario.header} modeLabel={scenario.modeLabel}>
      <div className="mt-5 space-y-3">
        {scenario.timeline?.map((app) => (
          <div
            key={`${scenario.word}-${app.name}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{app.name}</div>
              <div className="text-xs text-neutral-300">{app.time}</div>
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

      <PromptCard ask={scenario.ask} promptLabel={scenario.promptLabel} />
    </DashboardFrame>
  );
}

function MetricsPreview({ scenario }: { scenario: HeroScenario }) {
  const barSets: Record<string, number[]> = {
    analyzing: [28, 42, 54, 61, 66, 74, 82],
    debugging: [61, 54, 48, 32, 26, 21, 18],
    forecasting: [34, 39, 48, 57, 68, 79, 88],
    planning: [46, 58, 52, 67, 63, 76, 72],
  };

  const bars = barSets[scenario.word] ?? [40, 52, 60, 55, 68, 74, 81];

  return (
    <DashboardFrame label={scenario.header} modeLabel={scenario.modeLabel}>
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
        <div className="flex h-28 items-end gap-2">
          {bars.map((bar, index) => (
            <div key={`${scenario.word}-bar-${index}`} className="flex-1">
              <div
                className="rounded-t-xl bg-gradient-to-t from-cyan-500/30 via-sky-400/45 to-white/80 transition-all duration-700"
                style={{ height: `${bar}px` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-neutral-200">
          {scenario.insight}
        </p>
      </div>

      <PromptCard ask={scenario.ask} promptLabel={scenario.promptLabel} />
    </DashboardFrame>
  );
}

function MemoryPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <DashboardFrame label={scenario.header} modeLabel={scenario.modeLabel}>
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

      <PromptCard ask={scenario.ask} promptLabel={scenario.promptLabel} />
    </DashboardFrame>
  );
}

function AssistantPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <DashboardFrame label={scenario.header} modeLabel={scenario.modeLabel}>
      <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-violet-200">
          {scenario.previewLabel}
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          {scenario.summary}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
          sansxel response
        </div>
        <p className="mt-3 text-sm leading-6 text-white">{scenario.insight}</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {scenario.assistantCards?.map((item) => (
          <div
            key={`${scenario.word}-${item.label}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
              {item.label}
            </div>
            <div className="mt-3 text-sm font-medium text-white">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <PromptCard ask={scenario.ask} promptLabel={scenario.promptLabel} />
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
    }, WORD_CYCLE_MS - WORD_FADE_MS);

    const swapTimer = window.setTimeout(() => {
      setStep((current) => (current + 1) % playOrder.length);
      setVisible(true);
    }, WORD_CYCLE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(swapTimer);
    };
  }, [reducedMotion, step]);

  const activeScenario = scenarios[playOrder[step]];
  const cycleLabel = useMemo(
    () => `${activeScenario.word} mode`,
    [activeScenario.word],
  );

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
            <span className="relative inline-flex min-h-[1.1em] min-w-[9ch] items-center overflow-hidden align-bottom">
              <span
                className={`inline-block transition-all duration-500 ease-out ${
                  visible || reducedMotion
                    ? "translate-y-0 opacity-100"
                    : "translate-y-3 opacity-0"
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

        <div className="mt-5 max-w-xl">
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-neutral-400 sm:text-xs">
            <span>Live homepage scenario</span>
            <span>{cycleLabel}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              key={`progress-${activeScenario.word}`}
              className={`h-full rounded-full bg-white ${
                reducedMotion ? "w-full" : "animate-[heroCycle_5200ms_linear_forwards]"
              }`}
            />
          </div>
        </div>

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

      <div
        key={activeScenario.word}
        className={`transition-all duration-500 ease-out ${
          visible || reducedMotion
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0"
        }`}
      >
        {activeScenario.mode === "metrics" ? (
          <MetricsPreview scenario={activeScenario} />
        ) : activeScenario.mode === "memory" ? (
          <MemoryPreview scenario={activeScenario} />
        ) : activeScenario.mode === "assistant" ? (
          <AssistantPreview scenario={activeScenario} />
        ) : (
          <ActivityPreview scenario={activeScenario} />
        )}
      </div>

      <style jsx>{`
        @keyframes heroCycle {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}

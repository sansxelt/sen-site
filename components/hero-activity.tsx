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

type AnswerCard = {
  label: string;
  value: string;
};

type HeroScenario = {
  accent: string;
  ask: string;
  body: string;
  cta: string;
  header: string;
  headline: string[];
  metrics?: MetricCard[];
  mode: "activity" | "answer" | "metrics" | "memory";
  promptLabel: string;
  summary: string;
  timeline?: ActivityCard[];
  trail?: MemoryItem[];
  answerCards?: AnswerCard[];
};

const CYCLE_MS = 5200;
const FADE_MS = 500;

const scenarios: HeroScenario[] = [
  {
    accent: "Creation recall",
    ask: "What was I creating before feedback pulled me away?",
    body:
      "sansxel rebuilds the exact stretch where you were shaping the work, so you can return to the same momentum instead of reconstructing it.",
    cta: "Open workspace",
    header: "Workspace",
    headline: [
      "The AI that remembers",
      "what you were creating.",
    ],
    mode: "activity",
    promptLabel: "Resume creation",
    summary:
      "Your deepest block stayed inside the editor until quick feedback checks started to fragment the session.",
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
  },
  {
    accent: "Planning signals",
    ask: "Where was planning slowing down?",
    body:
      "sansxel turns scattered sessions into a readable plan, showing where momentum was clear, where it dipped, and what to do next.",
    cta: "See planning flow",
    header: "Planner",
    headline: [
      "The AI that remembers",
      "how you were planning.",
    ],
    metrics: [
      { label: "Decision lag", value: "14 min" },
      { label: "Clear next steps", value: "3" },
      { label: "Saved notes", value: "11" },
    ],
    mode: "metrics",
    promptLabel: "Planning answer",
    summary:
      "Momentum dipped after the outline was set, not while the ideas were still forming.",
  },
  {
    accent: "Analysis signals",
    ask: "What changed while I was analyzing growth?",
    body:
      "When the work turns analytical, sansxel shifts with it and surfaces the retention, conversion, and revenue signals that actually moved.",
    cta: "Review signals",
    header: "Signals",
    headline: [
      "The AI that remembers",
      "what you were analyzing.",
    ],
    metrics: [
      { label: "Day-7 retention", value: "+8.4%" },
      { label: "Trial conversion", value: "12.8%" },
      { label: "MRR trend", value: "+$4.2k" },
    ],
    mode: "metrics",
    promptLabel: "Growth answer",
    summary:
      "Retention and conversion both improved after onboarding friction dropped and the first-value moment got faster.",
  },
  {
    accent: "Writing trail",
    ask: "What was I writing before I paused?",
    body:
      "Writing sessions keep their shape, so sansxel can bring you back to the paragraph, source, and next sentence that mattered.",
    cta: "Resume writing",
    header: "Workspace",
    headline: [
      "The AI that remembers",
      "where you left off writing.",
    ],
    mode: "memory",
    promptLabel: "Resume writing",
    summary:
      "The draft already had a stable structure before incoming messages broke the writing block.",
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
        note: "Left off near the close and final handoff.",
        time: "11:34 AM",
        title: "Ready to resume",
      },
    ],
  },
  {
    accent: "Build recall",
    ask: "Where did I leave off while building?",
    body:
      "Build sessions stay readable, so sansxel can show what you touched, why you switched, and where to pick back up without friction.",
    cta: "Resume build",
    header: "Workspace",
    headline: [
      "The AI that remembers",
      "how you were building.",
    ],
    mode: "activity",
    promptLabel: "Resume build",
    summary:
      "The build path stayed focused until you paused for docs and repo checks.",
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
  },
  {
    accent: "Direct answer",
    ask: "What was moving conversion while I was selling?",
    answerCards: [
      { label: "Conversion lift", value: "+14%" },
      { label: "Best closer", value: "Clear Pro value" },
      { label: "Next test", value: "Annual CTA" },
    ],
    body:
      "Some moments should feel like getting a sharp answer, not opening another dashboard. sansxel shifts into that mode too.",
    cta: "Ask sansxel",
    header: "Revenue",
    headline: [
      "The AI that remembers",
      "what you were selling.",
    ],
    mode: "answer",
    promptLabel: "Sales answer",
    summary:
      "The sharpest conversion lift came after pricing clarity improved, not after adding more traffic.",
  },
];

function HeroFrame({
  children,
  header,
  accent,
}: {
  children: React.ReactNode;
  header: string;
  accent: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4">
        <div className="rounded-[24px] border border-white/10 bg-neutral-900/90 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="text-sm font-medium text-white">{header}</div>
              <div className="text-xs text-neutral-200">
                Thursday · 4h 18m tracked
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-300">
              {accent}
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function PromptCard({
  label,
  question,
}: {
  label: string;
  question: string;
}) {
  return (
    <Link
      href="/account"
      className="mt-5 block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5"
    >
      <div className="text-xs text-neutral-300">{label}</div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
        {question}
      </div>
    </Link>
  );
}

function ActivityPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <HeroFrame accent={scenario.accent} header={scenario.header}>
      <div className="mt-5 space-y-3">
        {scenario.timeline?.map((item) => (
          <div
            key={`${item.name}-${item.time}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{item.name}</div>
              <div className="text-xs text-neutral-300">{item.time}</div>
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-200">
              {item.description}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-sky-200">
          Session summary
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          {scenario.summary}
        </p>
      </div>

      <PromptCard label={scenario.promptLabel} question={scenario.ask} />
    </HeroFrame>
  );
}

function MetricsPreview({ scenario }: { scenario: HeroScenario }) {
  const bars =
    scenario.header === "Signals"
      ? [28, 42, 54, 61, 66, 74, 82]
      : [46, 58, 52, 67, 63, 76, 72];

  return (
    <HeroFrame accent={scenario.accent} header={scenario.header}>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {scenario.metrics?.map((metric) => (
          <div
            key={metric.label}
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
            <div key={`${scenario.header}-${index}`} className="flex-1">
              <div
                className="rounded-t-xl bg-gradient-to-t from-cyan-500/30 via-sky-400/45 to-white/80"
                style={{ height: `${bar}px` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-neutral-200">
          {scenario.summary}
        </p>
      </div>

      <PromptCard label={scenario.promptLabel} question={scenario.ask} />
    </HeroFrame>
  );
}

function MemoryPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <HeroFrame accent={scenario.accent} header={scenario.header}>
      <div className="mt-5 space-y-3">
        {scenario.trail?.map((item) => (
          <div
            key={`${item.title}-${item.time}`}
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
          Resume point
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          {scenario.summary}
        </p>
      </div>

      <PromptCard label={scenario.promptLabel} question={scenario.ask} />
    </HeroFrame>
  );
}

function AnswerPreview({ scenario }: { scenario: HeroScenario }) {
  return (
    <HeroFrame accent={scenario.accent} header={scenario.header}>
      <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-violet-200">
          sansxel response
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          {scenario.summary}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {scenario.answerCards?.map((item) => (
          <div
            key={item.label}
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

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm leading-6 text-white">{scenario.ask}</p>
      </div>
    </HeroFrame>
  );
}

function ScenarioPreview({ scenario }: { scenario: HeroScenario }) {
  if (scenario.mode === "metrics") {
    return <MetricsPreview scenario={scenario} />;
  }

  if (scenario.mode === "memory") {
    return <MemoryPreview scenario={scenario} />;
  }

  if (scenario.mode === "answer") {
    return <AnswerPreview scenario={scenario} />;
  }

  return <ActivityPreview scenario={scenario} />;
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
    }, CYCLE_MS - FADE_MS);

    const swapTimer = window.setTimeout(() => {
      setStep((current) => (current + 1) % scenarios.length);
      setVisible(true);
    }, CYCLE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(swapTimer);
    };
  }, [reducedMotion, step]);

  const activeScenario = scenarios[step];

  return (
    <div
      key={`${activeScenario.header}-${step}`}
      className={`contents ${
        visible || reducedMotion
          ? "opacity-100"
          : "opacity-0"
      }`}
    >
      <div className="max-w-2xl transition-all duration-500 ease-out">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-200 sm:text-xs">
          <span className="h-2 w-2 rounded-full bg-white/80" />
          Premium workspace memory for focused work
        </div>

        <h1 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-7xl">
          {activeScenario.headline.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>

        <p className="mt-5 max-w-xl text-sm leading-7 text-neutral-200 sm:mt-6 sm:text-lg">
          {activeScenario.body}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/account"
            className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            {isSignedIn ? "Open workspace" : activeScenario.cta}
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
            [
              "Fast",
              "Resume work instantly with the right context already surfaced.",
            ],
            [
              "Clear",
              "See what mattered in the session without replaying the whole day.",
            ],
            [
              "Useful",
              "The interface changes with the kind of work you were actually doing.",
            ],
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

      <div className="transition-all duration-500 ease-out">
        <ScenarioPreview scenario={activeScenario} />
      </div>
    </div>
  );
}

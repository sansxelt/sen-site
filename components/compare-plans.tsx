"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { pricingPlans, type PricingPlan, type PricingPlanKey } from "../lib/pricing";
import {
  buildExplanation,
  recommendPlanKey,
  type CompareAnswers,
} from "../lib/compare-explanations";

/**
 * "Compare", a guided pick-a-plan flow.
 *
 * Wizard:
 *   1. Pick plans to compare
 *   2. Answer 3 short questions
 *   3. The result step picks the right plan from the user's answers and
 *      reveals a tailored 2-sentence explanation character-by-character,
 *      so it reads like a model is typing.  All client-side, no API
 *      calls, no credits, no network round-trip.
 */

// ── Question set ───────────────────────────────────────────────────────────

type AudienceAnswer = "me" | "team" | "org";
type UsageAnswer    = "light" | "daily" | "heavy" | "hardcore";
type ApiAnswer      = "no" | "maybe" | "yes";

type Answers = {
  audience?: AudienceAnswer;
  usage?:    UsageAnswer;
  api?:      ApiAnswer;
};

const QUESTIONS = [
  {
    key: "audience" as const,
    label: "Who's this for?",
    options: [
      { value: "me",   title: "Just me",       desc: "Personal workflows, side projects, learning" },
      { value: "team", title: "My team",       desc: "A small group sharing outputs and context" },
      { value: "org",  title: "An organization", desc: "Company-wide rollout, admin controls, governance" },
    ],
  },
  {
    key: "usage" as const,
    label: "How heavy is your AI usage?",
    options: [
      { value: "light",    title: "Light",        desc: "A handful of questions a day" },
      { value: "daily",    title: "Daily driver", desc: "Most creative work runs through it" },
      { value: "heavy",    title: "Heavy",        desc: "Building real products + deliverables" },
      { value: "hardcore", title: "All-out",      desc: "Every day, all day, everything" },
    ],
  },
  {
    key: "api" as const,
    label: "Need API access for custom builds?",
    options: [
      { value: "no",    title: "Not really",      desc: "Just using it inside sansxel" },
      { value: "maybe", title: "Maybe someday",   desc: "I could see wiring it into things later" },
      { value: "yes",   title: "Yes, essential", desc: "I'm plugging it into my own apps / workflows" },
    ],
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────

type Step = "pick" | "questions" | "result";

export function ComparePlans() {
  const [open, setOpen]         = useState(false);
  const [step, setStep]         = useState<Step>("pick");
  const [selected, setSelected] = useState<Set<PricingPlanKey>>(new Set());
  const [answers, setAnswers]   = useState<Answers>({});
  const [qIndex, setQIndex]     = useState(0);

  function reset() {
    setStep("pick");
    setSelected(new Set());
    setAnswers({});
    setQIndex(0);
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  // ── Esc to close + body scroll lock ──────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Portal target, document.body only exists client-side, and we have
  // to portal because [data-route-transition] uses will-change:transform
  // which turns any fixed-position descendant into a relative-positioned
  // one (containing block swap).  Without this the modal appears below
  // the fold instead of centered in the viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function togglePlan(key: PricingPlanKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function answerQuestion(value: string) {
    const q = QUESTIONS[qIndex];
    setAnswers((prev) => ({ ...prev, [q.key]: value as never }));

    // Advance or finish
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex((i) => i + 1);
    } else {
      setStep("result");
    }
  }

  function backStep() {
    if (step === "questions" && qIndex > 0) { setQIndex((i) => i - 1); return; }
    if (step === "questions")               { setStep("pick"); return; }
    if (step === "result")                  { setQIndex(QUESTIONS.length - 1); setStep("questions"); return; }
  }

  const selectedPlans = useMemo(
    () => pricingPlans.filter((p) => selected.has(p.key)),
    [selected],
  );

  return (
    <>
      {/* ── Trigger link, designed to inline inside body copy ────── */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline text-neutral-300 underline decoration-neutral-600 decoration-1 underline-offset-[3px] transition hover:text-white hover:decoration-neutral-400"
      >
        Compare plans with AI
      </button>

      {/*
        Modal shell, portalled to document.body so will-change:transform
        on [data-route-transition] doesn't turn our fixed position into
        a relative-to-ancestor position.  Always vertically centered;
        height capped at calc(100dvh - 24px) so it never exceeds the
        screen on phones; body scrolls internally.
      */}
      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 sm:rounded-[32px]"
              style={{ maxHeight: "calc(100dvh - 24px)" }}
            >
              <div className="flex-shrink-0 border-b border-white/5 px-4 py-4 sm:px-7 sm:py-5">
                <Header
                  step={step}
                  qIndex={qIndex}
                  totalQs={QUESTIONS.length}
                  onBack={step === "pick" ? null : backStep}
                  onClose={handleClose}
                />
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7 sm:py-6">
                <AnimatePresence mode="wait" initial={false}>
                  {step === "pick" && (
                    <StepFrame key="pick">
                      <PickPlansStep
                        selected={selected}
                        onToggle={togglePlan}
                        onNext={() => setStep("questions")}
                      />
                    </StepFrame>
                  )}

                  {step === "questions" && (
                    <StepFrame key={`q-${qIndex}`}>
                      <QuestionStep
                        index={qIndex}
                        total={QUESTIONS.length}
                        question={QUESTIONS[qIndex]}
                        selected={answers[QUESTIONS[qIndex].key]}
                        onAnswer={answerQuestion}
                      />
                    </StepFrame>
                  )}

                  {step === "result" && answers.audience && answers.usage && answers.api && (
                    <StepFrame key="result">
                      <ResultStep
                        answers={answers as Required<Answers>}
                        comparedPlans={selectedPlans}
                        onRestart={() => { reset(); }}
                        onClose={handleClose}
                      />
                    </StepFrame>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </>
  );
}

// ── Internal bits ──────────────────────────────────────────────────────────

function StepFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0  }}
      exit={{    opacity: 0, x: -16 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Header({
  step, qIndex, totalQs, onBack, onClose,
}: {
  step: Step;
  qIndex: number;
  totalQs: number;
  onBack: null | (() => void);
  onClose: () => void;
}) {
  const progress = step === "pick" ? 0
                 : step === "questions" ? (qIndex + 1) / (totalQs + 1)
                 : 1;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1.5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : <div className="w-[30px] shrink-0" />}

        <div className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
          Compare plans
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10 sm:w-24">
          <motion.div
            className="h-full bg-white"
            // Explicit initial so Framer Motion doesn't briefly render
            // an auto/default width on mount, without this a ~2px nub
            // shows on the "pick plans" step where progress is 0.
            initial={{ width: "0%" }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 p-1.5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Step 1: pick plans to compare ──────────────────────────────────────────
function PickPlansStep({
  selected, onToggle, onNext,
}: {
  selected: Set<PricingPlanKey>;
  onToggle: (key: PricingPlanKey) => void;
  onNext: () => void;
}) {
  const canAdvance = selected.size >= 2;

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
        Pick plans to compare.
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        Tap at least 2. We&apos;ll guide you to the right one in a few seconds.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 sm:gap-3">
        {pricingPlans.filter((plan) => !plan.hidden).map((plan) => {
          const isSelected = selected.has(plan.key);
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => onToggle(plan.key)}
              className={`text-left rounded-2xl border p-4 transition ${
                isSelected
                  ? "border-white bg-white/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{plan.name}</div>
                  <div className="mt-0.5 text-xs text-neutral-400">{plan.note}</div>
                </div>
                <div className="text-sm font-medium text-neutral-200">{plan.monthlyLabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="text-xs text-neutral-500">
          {selected.size < 2
            ? `Pick ${2 - selected.size} more to start`
            : `${selected.size} selected`}
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          className="sansxel-white-button rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Step 2: questions ──────────────────────────────────────────────────────
function QuestionStep({
  index, total, question, selected, onAnswer,
}: {
  index: number;
  total: number;
  question: (typeof QUESTIONS)[number];
  selected: string | undefined;
  onAnswer: (value: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
        Question {index + 1} of {total}
      </div>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {question.label}
      </h2>

      <div className="mt-5 grid gap-2 sm:gap-3">
        {question.options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onAnswer(opt.value)}
              className={`text-left rounded-2xl border p-4 transition ${
                isSelected
                  ? "border-white bg-white/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="text-sm font-semibold text-white">{opt.title}</div>
              <div className="mt-1 text-xs text-neutral-400">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: recommendation + compare (streams from Claude) ────────────────
type ResultStatus = "loading" | "streaming" | "done" | "error";

function ResultStep({
  answers, comparedPlans, onRestart, onClose,
}: {
  answers:       Required<Answers>;
  comparedPlans: PricingPlan[];
  onRestart:     () => void;
  onClose:       () => void;
}) {
  // Deterministic pick from the user's answers.  Pure fn, runs in render.
  const planKey = useMemo(
    () => recommendPlanKey(answers as CompareAnswers),
    [answers.audience, answers.usage, answers.api],
  );
  const recommended = pricingPlans.find((p) => p.key === planKey)!;

  const [explanation, setExplanation] = useState<string>("");
  const [status,      setStatus]      = useState<ResultStatus>("loading");

  // Reveal the templated explanation character-by-character.  This is what
  // gives the "AI is typing" feel without any API call, the copy was built
  // synchronously in buildExplanation() and is just being unveiled over
  // time.  ~12 ms per char ≈ natural typing speed.
  useEffect(() => {
    const fullText = buildExplanation(planKey, answers as CompareAnswers);
    let i = 0;
    let intervalId: number | undefined;

    // Short pause first so the "thinking" pill registers visually, it
    // reinforces the sense that something is being reasoned about.
    const startDelay = window.setTimeout(() => {
      setStatus("streaming");
      intervalId = window.setInterval(() => {
        i++;
        setExplanation(fullText.slice(0, i));
        if (i >= fullText.length) {
          window.clearInterval(intervalId);
          setStatus("done");
        }
      }, 12);
    }, 180);

    return () => {
      window.clearTimeout(startDelay);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [answers, planKey]);

  const goHref =
    recommended.key === "free"       ? "/account"
  : recommended.key === "teams"      ? "/contact"
  : recommended.key === "enterprise" ? "/contact"
                                     : `/checkout?plan=${recommended.key}&cycle=monthly`;

  const loadingHeadline = status === "loading";

  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
        <span>Recommendation</span>
        {status === "streaming" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] normal-case tracking-normal text-neutral-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            thinking
          </span>
        )}
      </div>

      <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {loadingHeadline ? (
          <span className="inline-block h-7 w-56 animate-pulse rounded bg-white/5" />
        ) : (
          <>{recommended.name} fits you best.</>
        )}
      </h2>

      <p className="mt-2 min-h-[3rem] text-sm leading-6 text-neutral-300">
        {explanation || (
          <span className="inline-block h-4 w-full animate-pulse rounded bg-white/5" />
        )}
      </p>

      {/* Side-by-side compare of what the user picked */}
      {comparedPlans.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                <th className="p-3 font-medium"></th>
                {comparedPlans.map((p) => (
                  <th key={p.key} className="p-3 font-medium">
                    <span className={p.key === recommended.key ? "text-emerald-300" : "text-neutral-300"}>
                      {p.name}
                      {p.key === recommended.key && " ★"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs text-neutral-300">
              <tr className="border-b border-white/5">
                <td className="p-3 text-neutral-500">Price</td>
                {comparedPlans.map((p) => (<td key={p.key} className="p-3">{p.monthlyLabel}</td>))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 text-neutral-500">Seats</td>
                {comparedPlans.map((p) => (<td key={p.key} className="p-3">{p.seats}</td>))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 text-neutral-500">Memory</td>
                {comparedPlans.map((p) => (<td key={p.key} className="p-3">{p.memoryWindow}</td>))}
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-3 text-neutral-500">Support</td>
                {comparedPlans.map((p) => (<td key={p.key} className="p-3">{p.support}</td>))}
              </tr>
              <tr>
                <td className="p-3 text-neutral-500">Usage</td>
                {comparedPlans.map((p) => (<td key={p.key} className="p-3">{p.monthlyCredits}</td>))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Link
          href={goHref}
          onClick={onClose}
          className="sansxel-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          {recommended.ctaLabel}
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
        >
          Start over
        </button>
      </div>
    </div>
  );
}

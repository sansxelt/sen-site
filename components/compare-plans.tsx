"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { pricingPlans, type PricingPlan, type PricingPlanKey } from "../lib/pricing";

/**
 * "Compare" — a guided pick-a-plan flow powered by Claude.
 *
 * Wizard:
 *   1. Pick plans to compare
 *   2. Answer 3 short questions
 *   3. Claude streams a recommendation — first token hits the UI in
 *      ~500ms, full response in ~1.5s.  recommendPlan() is kept as a
 *      fallback for when ANTHROPIC_API_KEY is missing or the stream
 *      errors out, so the flow never blocks on an AI failure.
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
      { value: "yes",   title: "Yes — essential", desc: "I'm plugging it into my own apps / workflows" },
    ],
  },
] as const;

// ── Scoring ────────────────────────────────────────────────────────────────

function recommendPlan(answers: Answers): PricingPlanKey {
  // Team / org first — short-circuit.
  if (answers.audience === "org")  return "enterprise";
  if (answers.audience === "team") return "teams";

  // API access with personal use forces the Pro tier (only personal plan with API).
  if (answers.api === "yes") return "pro";

  // Otherwise scale by usage intensity.
  switch (answers.usage) {
    case "light":    return "free";
    case "daily":    return "apprentice";
    case "heavy":    return "studio";
    case "hardcore": return "pro";
    default:         return "apprentice";
  }
}

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
      {/* ── Trigger link — designed to inline inside body copy ────── */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline text-neutral-300 underline decoration-neutral-600 decoration-1 underline-offset-[3px] transition hover:text-white hover:decoration-neutral-400"
      >
        Compare plans with AI
      </button>

      {/* ── Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9990] flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md sm:items-center sm:p-8"
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
              className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-neutral-950 p-5 sm:p-8"
            >
              <Header
                step={step}
                qIndex={qIndex}
                totalQs={QUESTIONS.length}
                onBack={step === "pick" ? null : backStep}
                onClose={handleClose}
              />

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
                      selectedPlanKeys={[...selected]}
                      onRestart={() => { reset(); }}
                      onClose={handleClose}
                    />
                  </StepFrame>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/5 p-1.5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Back"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : <div className="w-[30px]" />}

        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
          Compare plans
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full bg-white"
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
        {pricingPlans.map((plan) => {
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
  answers, comparedPlans, selectedPlanKeys, onRestart, onClose,
}: {
  answers:          Required<Answers>;
  comparedPlans:    PricingPlan[];
  selectedPlanKeys: PricingPlanKey[];
  onRestart:        () => void;
  onClose:          () => void;
}) {
  // Heuristic fallback — used if Anthropic isn't configured or streaming fails.
  const fallbackKey = recommendPlan(answers);

  const [planKey, setPlanKey] = useState<PricingPlanKey>(fallbackKey);
  const [explanation, setExplanation] = useState<string>("");
  const [status,      setStatus]      = useState<ResultStatus>("loading");

  // Fire the stream on mount.  Abort if the user closes the modal or hits Back.
  useEffect(() => {
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/compare/recommend", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ answers, selectedPlanKeys }),
          signal:  ctrl.signal,
        });

        if (!res.ok || !res.body) {
          // Fall back to heuristic with the plan's static description.
          const plan = pricingPlans.find((p) => p.key === fallbackKey)!;
          setExplanation(plan.description);
          setStatus("done");
          return;
        }

        setStatus("streaming");
        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let planKeyParsed = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse "PLAN_KEY=<key>" off the first line as soon as it's there.
          if (!planKeyParsed) {
            const match = buffer.match(/PLAN_KEY\s*=\s*(\w+)/i);
            if (match) {
              const key = match[1].toLowerCase() as PricingPlanKey;
              if (pricingPlans.some((p) => p.key === key)) {
                setPlanKey(key);
                planKeyParsed = true;
              }
            }
          }

          // Everything after the first blank line is the prose explanation.
          const parts = buffer.split(/\n\s*\n/);
          if (parts.length > 1) {
            setExplanation(parts.slice(1).join("\n\n").trim());
          }
        }

        // Stream closed cleanly — but if nothing came through (AI errored
        // out server-side, credits exhausted, etc.) fall back to the
        // plan's own description so the panel is never blank.
        setExplanation((prev) => {
          if (prev.trim().length > 0) return prev;
          const plan = pricingPlans.find((p) => p.key === fallbackKey)!;
          return plan.description;
        });
        setStatus("done");
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.error("[compare] stream failed:", err);
        const plan = pricingPlans.find((p) => p.key === fallbackKey)!;
        setExplanation(plan.description);
        setStatus("error");
      }
    })();

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommended = pricingPlans.find((p) => p.key === planKey)
                   ?? pricingPlans.find((p) => p.key === fallbackKey)!;

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

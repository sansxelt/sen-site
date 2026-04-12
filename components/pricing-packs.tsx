"use client";

import { useState } from "react";
import Link from "next/link";
import { pricingPlans, getPlanActionHref, type PricingPlan } from "../lib/pricing";

const basicPlans    = pricingPlans.slice(0, 3); // Free, Apprentice, Studio
const advancedPlans = pricingPlans.slice(3);    // Pro, Teams, Enterprise

// ─── Single card face ─────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: PricingPlan }) {
  return (
    <div className="flex h-full flex-col rounded-[28px] border border-white/[0.12] bg-neutral-950 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{plan.name}</div>
          <div className="mt-0.5 text-xs text-neutral-500">{plan.note}</div>
        </div>
        {plan.badge && (
          <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-black">
            {plan.badge}
          </span>
        )}
      </div>

      <div className="mt-5">
        <div className="text-2xl font-semibold tracking-tight text-white">
          {plan.monthlyLabel}
        </div>
        {plan.yearlyLabel && (
          <div className="mt-0.5 text-xs text-neutral-600">{plan.yearlyLabel}</div>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-500">{plan.description}</p>

      <ul className="mt-4 space-y-2">
        {plan.points.map((point) => (
          <li key={point} className="flex items-center gap-2.5 text-xs text-neutral-300">
            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
            {point}
          </li>
        ))}
      </ul>

      <Link
        href={getPlanActionHref(plan)}
        className="mt-auto block rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-xs font-medium text-white transition hover:bg-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {plan.ctaLabel}
      </Link>
    </div>
  );
}

// ─── Card stack / pack ────────────────────────────────────────────────────

function CardPack({
  plans,
  label,
  locked = false,
  fanDir = "left",
}: {
  plans: PricingPlan[];
  label: string;
  locked?: boolean;
  fanDir?: "left" | "right";
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hovered, setHovered] = useState(false);

  const d = fanDir === "right" ? 1 : -1; // direction multiplier

  // Render order: back → mid → front (so front paints last / on top)
  const slots = [
    { plan: plans[(activeIdx + 2) % plans.length], planIdx: (activeIdx + 2) % plans.length, depth: 2 },
    { plan: plans[(activeIdx + 1) % plans.length], planIdx: (activeIdx + 1) % plans.length, depth: 1 },
    { plan: plans[activeIdx],                       planIdx: activeIdx,                       depth: 0 },
  ];

  function styleFor(depth: number): React.CSSProperties {
    const isBack = depth === 2;
    const isMid  = depth === 1;

    const transform = hovered
      ? isBack ? `rotate(${14 * d}deg) translateX(${56 * d}px) translateY(20px)`
      : isMid  ? `rotate(${5  * d}deg) translateX(${28 * d}px) translateY(8px)`
               : "rotate(0deg) translateY(-8px)"
      : isBack ? `rotate(${5   * d}deg) translateX(${18 * d}px) translateY(10px)`
      : isMid  ? `rotate(${2.5 * d}deg) translateX(${9  * d}px) translateY(5px)`
               : "rotate(0deg)";

    const zIndex  = depth === 0 ? 30 : depth === 1 ? 20 : 10;
    const opacity = hovered
      ? 1
      : locked
        ? [0.72, 0.38, 0.22][depth]
        : [1, 0.65, 0.42][depth];
    const blurPx = hovered
      ? locked ? [0, 1, 2][depth]   : [0, 0.5, 1][depth]
      : locked ? [1, 5, 8][depth]   : [0, 1, 2][depth];

    return {
      position: "absolute",
      inset: 0,
      transform,
      zIndex,
      opacity,
      filter: blurPx > 0 ? `blur(${blurPx}px)` : "none",
      transition: "all 0.42s cubic-bezier(0.16, 1, 0.3, 1)",
      cursor: "pointer",
    };
  }

  function advance() {
    setActiveIdx((i) => (i + 1) % plans.length);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Label + hint */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
          {label}
        </span>
        <p className="text-[11px] text-neutral-400">
          {locked
            ? hovered
              ? `Click any card to browse · ${plans.length} total`
              : `Hover to preview · ${plans.length} plans`
            : `Click any card to browse · ${plans.length} total`}
        </p>
      </div>

      {/* Stack */}
      <div
        className="relative"
        style={{ width: 336, height: 468 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {slots.map(({ plan, depth }) => (
          <div
            key={plan.key}
            style={styleFor(depth)}
            onClick={advance}
          >
            <PlanCard plan={plan} />
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-end gap-1.5">
        {plans.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === activeIdx
                ? "w-5 bg-white/60"
                : "w-1.5 bg-white/15 hover:bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────

export function PricingPacks() {
  return (
    <div className="mt-16 flex flex-col items-center gap-12 sm:mt-20 lg:flex-row lg:items-start lg:justify-center lg:gap-16 xl:gap-24">
      <CardPack plans={basicPlans}    label="Basic Plans"            fanDir="left"  />
      <CardPack plans={advancedPlans} label="Advanced & Corporate"   fanDir="right" locked />
    </div>
  );
}

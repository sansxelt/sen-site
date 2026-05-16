"use client";

import { useState } from "react";
import { pricingPlans, type PricingPlan } from "../lib/pricing";

type Cycle = "monthly" | "yearly";

const personalPlans = pricingPlans.filter((p) => p.segment === "individual" && !p.hidden);
const businessPlans = pricingPlans.filter((p) => p.segment === "team"       && !p.hidden);

// ─── Single card face ─────────────────────────────────────────────────────

function PlanCard({ plan, cycle, subAlign = "left" }: { plan: PricingPlan; cycle: Cycle; subAlign?: "left" | "right" }) {
  const [loading, setLoading] = useState(false);

  const showYearly = plan.key !== "free" && cycle === "yearly" && !!plan.yearlyLabel;

  const mainLabel = showYearly ? plan.yearlyLabel! : plan.monthlyLabel;
  const subLabel  = showYearly ? plan.monthlyLabel  : plan.yearlyLabel;

  async function handleCta(e: React.MouseEvent) {
    e.stopPropagation();

    if (plan.key === "free")             { window.location.href = "/account"; return; }
    if (plan.ctaVariant === "contact")   { window.location.href = "/contact"; return; }

    // Native checkout, stay on vraelis.ai, no redirect to Stripe.com.
    setLoading(true);
    window.location.href = `/checkout?plan=${plan.key}&cycle=${cycle}`;
  }

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
        <div className="text-2xl font-semibold tracking-tight text-white transition-all duration-300">
          {mainLabel}
        </div>
        {subLabel && (
          <div className={`mt-0.5 text-xs text-neutral-600 transition-all duration-300 ${subAlign === "right" ? "text-right" : ""}`}>
            {showYearly ? `or ${subLabel}` : subLabel}
          </div>
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

      <button
        onClick={handleCta}
        disabled={loading}
        className="mt-auto block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {loading ? "Redirecting…" : showYearly ? `${plan.ctaLabel} · Yearly` : plan.ctaLabel}
      </button>
    </div>
  );
}

// ─── Card stack / pack ────────────────────────────────────────────────────

function CardPack({
  plans,
  label,
  cycle,
  fanDir = "left",
  dotsAlign = "right",
  labelAlign = "left",
  subAlign = "left",
}: {
  plans: PricingPlan[];
  label: string;
  cycle: Cycle;
  fanDir?: "left" | "right";
  dotsAlign?: "left" | "right";
  labelAlign?: "left" | "right";
  subAlign?: "left" | "right";
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hovered, setHovered] = useState(false);

  const d = fanDir === "right" ? 1 : -1;

  const slots = plans.length >= 3
    ? [
        { plan: plans[(activeIdx + 2) % plans.length], depth: 2 },
        { plan: plans[(activeIdx + 1) % plans.length], depth: 1 },
        { plan: plans[activeIdx],                       depth: 0 },
      ]
    : plans.length === 2
    ? [
        { plan: plans[(activeIdx + 1) % 2], depth: 2 },
        { plan: plans[activeIdx],           depth: 0 },
      ]
    : [{ plan: plans[0], depth: 0 }];

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
    const opacity = hovered ? 1 : [1, 0.65, 0.42][depth];
    const blurPx  = hovered ? [0, 0.5, 1][depth] : [0, 1, 2][depth];

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

  return (
    <div className="flex flex-col gap-3.5" style={{ width: 336 }}>
      <div className={`flex flex-col gap-1 ${labelAlign === "right" ? "items-end text-right" : "items-start text-left"}`}>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
          {label}
        </span>
        <p className="text-[11px] text-neutral-400">
          {labelAlign === "right"
            ? `${plans.length} total · Click any card to browse`
            : `Click any card to browse · ${plans.length} total`}
        </p>
      </div>

      <div
        className="relative"
        style={{ width: 336, height: 468 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {slots.map(({ plan, depth }) => (
          <div key={plan.key} style={styleFor(depth)} onClick={() => setActiveIdx((i) => (i + 1) % plans.length)}>
            <PlanCard plan={plan} cycle={cycle} subAlign={subAlign} />
          </div>
        ))}
      </div>

      <div className={`flex items-center gap-1.5 ${dotsAlign === "left" ? "justify-start" : "justify-end"}`}>
        {plans.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === activeIdx ? "w-5 bg-white/60" : "w-1.5 bg-white/15 hover:bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Billing toggle ───────────────────────────────────────────────────────

function CycleToggle({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div className="flex w-full items-center justify-center gap-3">
      {/* invisible spacer mirrors the badge so the pill stays truly centered */}
      <span className="invisible rounded-full px-2.5 py-1 text-[11px] font-medium" aria-hidden>
        Save ~17%
      </span>

      <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1">
        {(["monthly", "yearly"] as Cycle[]).map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200"
            style={
              cycle === c
                ? { background: "#fff", color: "#000" }
                : { color: "rgba(255,255,255,0.45)" }
            }
          >
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <span
        className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition-all duration-300"
        style={{ opacity: cycle === "yearly" ? 1 : 0, pointerEvents: "none" }}
      >
        Save ~17%
      </span>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────

export function PricingPacks() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [hoveredSide, setHoveredSide] = useState<"left" | "right" | null>(null);

  const sideStyle = (side: "left" | "right"): React.CSSProperties => ({
    opacity:    hoveredSide !== null && hoveredSide !== side ? 0.55 : 1,
    filter:     hoveredSide !== null && hoveredSide !== side ? "blur(1.5px)" : "none",
    transition: "opacity 0.4s ease, filter 0.4s ease",
  });

  return (
    <div style={{ width: "fit-content", margin: "0 auto" }}>
      <CycleToggle cycle={cycle} onChange={setCycle} />

      <div className="mt-5 flex flex-col gap-9 lg:flex-row lg:items-start lg:gap-12 xl:gap-[4.5rem]">
        <div style={sideStyle("left")} onMouseEnter={() => setHoveredSide("left")} onMouseLeave={() => setHoveredSide(null)}>
          <CardPack plans={personalPlans} label="Personal Plans" cycle={cycle} fanDir="left" dotsAlign="right" labelAlign="right" />
        </div>
        <div style={sideStyle("right")} onMouseEnter={() => setHoveredSide("right")} onMouseLeave={() => setHoveredSide(null)}>
          <CardPack plans={businessPlans} label="Team Plans" cycle={cycle} fanDir="right" dotsAlign="left" subAlign="right" />
        </div>
      </div>
    </div>
  );
}

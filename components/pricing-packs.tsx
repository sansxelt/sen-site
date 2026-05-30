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

    // Native checkout, stay on vraelis.com, no redirect to Stripe.com.
    setLoading(true);
    window.location.href = `/checkout?plan=${plan.key}&cycle=${cycle}`;
  }

  return (
    <div className="flex h-full flex-col p-6" style={{ borderRadius: 28, border: "1px solid rgba(199,205,215,0.10)", background: "rgba(14,20,33,0.95)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#ECEFF4", fontFamily: '"Inter Tight", sans-serif', letterSpacing: "-0.01em" }}>{plan.name}</div>
          <div style={{ marginTop: 2, fontSize: 11, color: "#5A6478", fontFamily: '"Inter Tight", sans-serif' }}>{plan.note}</div>
        </div>
        {plan.badge && (
          <span style={{ flexShrink: 0, borderRadius: 100, background: "#ECEFF4", padding: "2px 10px", fontSize: 10, fontWeight: 600, color: "#0A0F18", fontFamily: '"Inter Tight", sans-serif', letterSpacing: "0.01em" }}>
            {plan.badge}
          </span>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", color: "#ECEFF4", transition: "all 300ms", fontFamily: '"Inter Tight", sans-serif' }}>
          {mainLabel}
        </div>
        {subLabel && (
          <div style={{ marginTop: 2, fontSize: 11, color: "#5A6478", textAlign: subAlign === "right" ? "right" : "left", transition: "all 300ms", fontFamily: '"Inter Tight", sans-serif' }}>
            {showYearly ? `or ${subLabel}` : subLabel}
          </div>
        )}
      </div>

      <p style={{ marginTop: 12, fontSize: 12, lineHeight: 1.6, color: "#5A6478", fontFamily: '"Inter Tight", sans-serif' }}>{plan.description}</p>

      <ul style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {plan.points.map((point) => (
          <li key={point} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#C7CDD7", fontFamily: '"Inter Tight", sans-serif' }}>
            <div style={{ width: 5, height: 5, flexShrink: 0, borderRadius: "50%", background: "rgba(199,205,215,0.25)" }} />
            {point}
          </li>
        ))}
      </ul>

      <button
        onClick={handleCta}
        disabled={loading}
        style={{ marginTop: "auto", display: "block", width: "100%", borderRadius: 12, border: "1px solid rgba(199,205,215,0.12)", background: "rgba(199,205,215,0.05)", padding: "10px 16px", textAlign: "center", fontSize: 12, fontWeight: 500, color: "#ECEFF4", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1, transition: "background 150ms", fontFamily: '"Inter Tight", sans-serif' }}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: labelAlign === "right" ? "flex-end" : "flex-start", textAlign: labelAlign === "right" ? "right" : "left" }}>
        <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.18em", color: "#5A6478", fontFamily: '"JetBrains Mono", monospace' }}>
          {label}
        </span>
        <p style={{ fontSize: 11, color: "#5A6478", fontFamily: '"Inter Tight", sans-serif' }}>
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
            style={{
              height: 4, borderRadius: 100, border: "none", cursor: "pointer",
              transition: "all 300ms",
              width: i === activeIdx ? 20 : 6,
              background: i === activeIdx ? "rgba(199,205,215,0.60)" : "rgba(199,205,215,0.15)",
            }}
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

      <div style={{ display: "flex", alignItems: "center", borderRadius: 100, border: "1px solid rgba(199,205,215,0.10)", background: "rgba(199,205,215,0.04)", padding: 4 }}>
        {(["monthly", "yearly"] as Cycle[]).map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            style={{
              borderRadius: 100, padding: "6px 16px", border: "none",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              fontFamily: '"Inter Tight", sans-serif',
              transition: "all 200ms",
              ...(cycle === c
                ? { background: "#ECEFF4", color: "#0A0F18" }
                : { background: "transparent", color: "rgba(199,205,215,0.45)" }),
            }}
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

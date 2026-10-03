"use client";

// THE BILLING CYCLE ON /pricing (plan C /pricing, T6). Two parts that share one piece of state:
//
//   PricingToggle  the wrapper. The page passes it the server-rendered hero and plans as children, with every
//                  price and checkout link in the DOM twice, once per cycle, each marked data-cyc="monthly" or
//                  data-cyc="yearly". It renders them inside one element and writes data-cycle on it;
//                  pricing.css shows the matching set and hides the other with display: none, so the hidden
//                  links cannot be focused, while the translation crawl (which walks every text node) still
//                  collects the yearly words.
//   PricingSwitch  the Monthly/Yearly control, anywhere inside the wrapper (the page puts it under the hero's
//                  lead). A radio group, because the translator skips <select> (plan 0.6): two native radios,
//                  visually hidden inside their labels, so arrow keys, Tab and screen readers work as the
//                  browser made them, and a thumb that slides under the chosen one over 140ms (none with
//                  reduced motion).
//
// Nothing is fetched or computed here. Checkout reads `cycle` (app/rank/app/checkout/page.tsx), and the links for
// both cycles are already in the page, so a switch only swaps two boxes of the same size: nothing below them
// moves (CLS 0). Monthly is the default, on the server and before hydration.
import { createContext, useContext, useId, useState, type ReactNode } from "react";

export type Cycle = "monthly" | "yearly";

const CycleContext = createContext<{ cycle: Cycle; setCycle: (c: Cycle) => void } | null>(null);

/**
 * Holds the billing cycle for everything inside it and writes it as data-cycle on one wrapping element.
 *
 * Props:
 *   children   server-rendered content: both price sets, each marked data-cyc="monthly" | "yearly".
 *   className  the wrapper's class (the page styles [data-cycle] on it).
 *   initial    the cycle shown first. Default "monthly".
 * Usage: <PricingToggle className="v6-pp"><IndexHero ... actions={<PricingSwitch />} /><Plans /></PricingToggle>
 */
export function PricingToggle({ children, className, initial = "monthly" }: {
  children: ReactNode; className?: string; initial?: Cycle;
}) {
  const [cycle, setCycle] = useState<Cycle>(initial);
  return (
    <CycleContext.Provider value={{ cycle, setCycle }}>
      <div className={className} data-cycle={cycle}>{children}</div>
    </CycleContext.Provider>
  );
}

const OPTIONS: { value: Cycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

/**
 * The Monthly/Yearly segmented control. Must sit inside PricingToggle; outside one it renders nothing.
 *
 * Props:
 *   label  the group's accessible name, read before the two options. Default "Billing cycle".
 * Usage: <PricingSwitch />
 */
export function PricingSwitch({ label = "Billing cycle" }: { label?: string }) {
  const ctx = useContext(CycleContext);
  const name = useId();
  if (!ctx) return null;
  return (
    <div className="v6-cyc" role="radiogroup" aria-label={label} data-cycle={ctx.cycle}>
      <span className="v6-cyc__thumb" aria-hidden />
      {OPTIONS.map((o) => (
        <label className="v6-cyc__opt" key={o.value}>
          <input
            type="radio" name={name} value={o.value}
            checked={ctx.cycle === o.value}
            onChange={() => ctx.setCycle(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

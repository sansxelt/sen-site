"use client";

import { motion, useReducedMotion } from "framer-motion";
import { createElement } from "react";
import type { CSSProperties, ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

type AsTag = "div" | "section" | "li" | "h1" | "h2" | "h3" | "p" | "span";

// Drop-in wrapper that fades + lifts its children into view the first
// time they cross the viewport. Stagger by setting `delay` on each
// sibling (e.g. `delay={i * 0.06}`). Falls back to an undecorated tag
// when prefers-reduced-motion is on.
export function Reveal({
  children,
  delay = 0,
  y = 14,
  duration = 0.7,
  amount = 0.2,
  as = "div",
  className,
  style,
  id,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  amount?: number;
  as?: AsTag;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return createElement(as, { id, className, style }, children);
  }

  const Motion = motion[as];
  return (
    <Motion
      id={id}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration, ease: EASE, delay }}
      className={className}
      style={style}
    >
      {children}
    </Motion>
  );
}

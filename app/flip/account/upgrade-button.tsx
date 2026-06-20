"use client";

import { type CSSProperties } from "react";

// Navigates to the on-site embedded checkout (no redirect off vraelis.com).
// Auth is enforced by the /flip/checkout page (redirects to sign-in if needed).
export function UpgradeButton({
  className,
  label = "Upgrade to Pro",
  style,
  plan = "seller",
  cycle = "monthly",
}: {
  className?: string;
  label?: string;
  style?: CSSProperties;
  plan?: string;
  cycle?: string;
}) {
  return (
    <a
      href={`/flip/checkout?plan=${plan}&cycle=${cycle}`}
      className={className ?? "btn"}
      style={style}
    >
      {label} <span aria-hidden>→</span>
    </a>
  );
}

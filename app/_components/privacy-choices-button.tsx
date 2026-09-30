"use client";

import type { CSSProperties, ReactNode } from "react";
import { openPrivacyChoices } from "@/lib/privacy-choice";

// THE "PRIVACY CHOICES" CONTROL. A button, not a link: it opens the dialog in place and goes nowhere, so a
// link would announce a navigation that never happens. It is styled to match the links beside it by
// app/_components/privacy-choices.css (one rule per footer it sits in), so it reads as one more item in the
// row. Kept apart from the dialog so a server component (the account frame) can render it without pulling
// the dialog's code into its bundle a second time.
export function PrivacyChoicesButton({ className, style, children = "Privacy choices", onClick }: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Runs first, e.g. to close the mobile drawer the button sits in. */
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={className ? `vr-pc-trigger ${className}` : "vr-pc-trigger"}
      style={style}
      aria-haspopup="dialog"
      onClick={() => { onClick?.(); openPrivacyChoices(); }}
    >
      {children}
    </button>
  );
}

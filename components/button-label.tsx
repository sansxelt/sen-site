import type { ReactNode } from "react";
import "./button-motion.css";

/** The second label is visual only; the control keeps one accessible name. */
export function ButtonLabel({ children }: { children: ReactNode }) {
  if (typeof children !== "string") return <>{children}</>;
  return <span className="motion-label"><span>{children}</span><span aria-hidden="true">{children}</span></span>;
}

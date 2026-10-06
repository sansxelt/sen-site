import type { ReactNode } from "react";
import "./button-motion.css";

/** One stable label; the control itself provides hover and press feedback. */
export function ButtonLabel({ children }: { children: ReactNode }) {
  if (typeof children !== "string") return <>{children}</>;
  return <span className="motion-label">{children}</span>;
}

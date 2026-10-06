"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Only the account step moves; the frame stays stable between routes. */
export function AuthStage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="auth-entry__stage" key={pathname}>{children}</div>;
}

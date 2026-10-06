"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n/client";

/** Keep complete text nodes for the catalogue on translated pages. */
export function TitleEntrance({ children, offset = 0 }: { children: ReactNode; offset?: number }) {
  const locale = useLocale();
  if (typeof children !== "string" || locale !== "en") return <span className="v6-title-line">{children}</span>;
  return <>{children.split(/\s+/).map((word, i) => <Fragment key={i}>{i ? " " : null}<span className="v6-title-word"><span style={{ "--word-delay": `${90 + Math.min(offset + i, 14) * 38}ms` } as CSSProperties}>{word}</span></span></Fragment>)}</>;
}

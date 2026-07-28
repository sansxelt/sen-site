// Vraelis icon language: ONE drawn stroke set for the whole product.
// Every icon is a 24x24 path rendered with fill:none, stroke:currentColor, round caps/joins,
// via the Ic() helper below. No emoji, no glyph characters, no icon fonts, no external packages.
// This module has no "use client" directive on purpose: server components render these as
// static SVG (zero JS shipped), and client components can import it too.
//
// Sizing conventions (keep these consistent per context):
//   17px, sw 1.7  — sidebar navigation (the original Ic default)
//   22px, sw 1.7  — empty-state tiles (via <EmptyIcon />)
//   12px, sw 2.4  — compact marks inside decision pills (via <DecisionMark />)
//   13-14px, sw 2 — leading icons on small action buttons and micro section labels
//   17-20px       — leading icons on section headings
import type { CSSProperties } from "react";

export function Ic({ d, size = 17, sw = 1.7, style }: { d: string; size?: number; sw?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style}>
      <path d={d} />
    </svg>
  );
}

export const I = {
  // navigation set (moved here from rank-ui.tsx)
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  data: "M3 3v18h18M7 14l3-3 3 3 5-6",
  coin: "M12 8v8M9.5 10.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
  card: "M3 6h18v12H3zM3 10h18",
  code: "M8 9l-3 3 3 3M16 9l3 3-3 3",
  terminal: "M3 4h18v16H3zM7 10l2.5 2L7 14M12.5 15H17",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1",
  vote: "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  folder: "M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  building: "M4 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M13 9h6a1 1 0 0 1 1 1v11M3 21h18M7 7h2M7 11h2M7 15h2M16 13h1M16 17h1",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z",
  deploy: "M12 15V3m0 0l-4 4m4-4l4 4M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4",
  back: "M19 12H5M11 18l-6-6 6-6",
  signout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",

  // status marks (decision pills, step results)
  x: "M17.5 6.5l-11 11M6.5 6.5l11 11",
  eye: "M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  wrenchCheck: "M13.4 4.6a3.4 3.4 0 0 0-4.6 4.6l-5.2 5.2a1.4 1.4 0 0 0 2 2l5.2-5.2a3.4 3.4 0 0 0 4.6-4.6l-2.1 2.1-2-2 2.1-2.1zM13.5 17.5l2.6 2.6 4.9-4.9",
  dash: "M8 12h8",

  // action affordances
  pencil: "M17 3.5a2.75 2.75 0 0 1 3.9 3.9L7.7 20.6 3 21.4l.8-4.7L17 3.5z",
  trash: "M4 7h16M9.5 7V4.75a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M18.5 7l-.9 12.2a1.6 1.6 0 0 1-1.6 1.5H8a1.6 1.6 0 0 1-1.6-1.5L5.5 7M10 11v6M14 11v6",
  retry: "M21 12a9 9 0 1 1-2.64-6.36M21 3v5.5h-5.5",
  slash: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.65 5.65l12.7 12.7",
  key: "M8 11.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM11.2 12.8 21 3M17.5 6.5 20.2 9.2",

  // subject icons (empty states, section headers)
  mail: "M3 6.5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11zM3.5 7l8.5 6 8.5-6",
  lock: "M6.5 10.5V8a5.5 5.5 0 0 1 11 0v2.5M5.5 10.5h13a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1zM12 14.5v2.5",
  camera: "M3.5 8.5a1.5 1.5 0 0 1 1.5-1.5h2.3l1.6-2.3a1 1 0 0 1 .8-.45h4.6a1 1 0 0 1 .8.45L16.7 7H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18zM12 16.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z",
  fileText: "M14.5 3H6.8a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V6.7L14.5 3zM14.5 3v3.7h3.7M9.2 12h5.6M9.2 15.6h5.6",
  list: "M8.5 6h12M8.5 12h12M8.5 18h12M4 6h.01M4 12h.01M4 18h.01",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.4 9.3a2.6 2.6 0 0 1 5.1.8c0 1.7-2.5 2.2-2.5 3.6M12 17.2h.01",
  swap: "M20 7.5H4M16.5 4 20 7.5 16.5 11M4 16.5h16M7.5 13 4 16.5 7.5 20",
  chevron: "M6 9.5l6 6 6-6",
  menu: "M4 7h16M4 12h16M4 17h16",
} as const;

// Empty-state tile: the drawn replacement for the old bare glyph characters inside .empty__icon.
export function EmptyIcon({ d }: { d: string }) {
  return <div className="empty__icon" aria-hidden><Ic d={d} size={22} /></div>;
}

// Decision / lifecycle -> the compact mark carried INSIDE a status pill, same color as the pill text.
// The pill already says the status in words; the mark only reinforces it, so unknown or in-progress
// states deliberately render nothing (no mark is better than a meaningless one).
const DECISION_MARK: Record<string, string> = {
  ready: I.check,
  repair_verified: I.wrenchCheck,
  needs_review: I.eye,
  blocked: I.x,
  verified: I.check,
  approved: I.check,
  resolved: I.check,
  failed: I.x,
  applied_by_user: I.clock,
};

export function DecisionMark({ decision, size = 12 }: { decision?: string | null; size?: number }) {
  const d = decision ? DECISION_MARK[decision] : undefined;
  if (!d) return null;
  return <Ic d={d} size={size} sw={2.4} />;
}

// THE LARKSPUR RECORD'S SHAPE, AND THE LINKS UNDER ITS CHAPTERS (server-safe: no hooks, no "use client").
//
// These lived in _system/strike-story.tsx, a client module. _content/strike.ts imported the value STRIKE_LINKS
// from it, so every server page that read STRIKE (the sector and use-case pages) pulled the homepage story into
// its bundle, and on the server the client reference left STRIKE_CHAPTERS[i].link undefined. They live here
// now; strike.ts and strike-story.tsx both import them, and strike-story.tsx re-exports them under the same
// names so older importers keep working.
import type { StaticImageData } from "next/image";
import { V6_BASE } from "@/lib/v6-routes";

export type StrikeStep = { say: string; ms: number; ok: boolean };

export type StrikeRecord = {
  /** The address the run checked: the fixture, in its broken mode. */
  url: string;
  claim: string;
  /** The CLI's own output, line by line, with its colour codes, exactly as captured. */
  cli: { command: string; lines: string[] } | null;
  plan: { id: string; requirements: string[]; flows: { name: string; steps: number }[]; approvedAt: string | null };
  run: null | {
    id: string;
    recorded: string;
    seconds: number;
    journeys: { name: string; steps: StrikeStep[] }[];
    /** The record's critical issue, verbatim, plus what the run's screenshot shows on that contact and a
     *  plain note of anything else the record holds, so the panel never implies it was the only failure. */
    failure: { contact: string; at: string; expected: string; observed: string; shown: string; more?: string } | null;
    shots: { run: StaticImageData | string; failure: StaticImageData | string };
    /** How the finding's screenshot is cut down to the part that shows it: a scale and a transform origin. */
    failureCrop?: { scale: number; origin: string };
    repairPrompt: string;
  };
};

/** The link under each of the first three chapters of the homepage story. */
export const STRIKE_LINKS = {
  cli: { href: `${V6_BASE}/agents`, label: "Set up the CLI" },
  approval: { href: `${V6_BASE}/security`, label: "Who can approve a plan" },
  coverage: { href: `${V6_BASE}/platform#coverage`, label: "What it can check today" },
};

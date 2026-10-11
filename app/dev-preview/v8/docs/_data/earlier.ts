import { DOCS, type Block as V6Block, type Doc } from "../../../v6/_content/docs";
import { SURFACES } from "../../../v6/_content/coverage";
import type { Block, Page } from "./types";

// THE EARLIER REFERENCES TAB. Every v6 doc that is not rewritten for Vraelis Contour, rendered from the v6 Doc
// data unchanged, under a banner that says it is history. These pages describe the earlier browser-testing
// product (and, for recorded-reports, the earlier recorded-evidence component). They are noindex, and their
// links into the closed console are dropped. Slugs are the v6 slugs, so old links still resolve.

const ORDER = [
  "getting-started", "the-loop", "what-you-can-check",
  "ai-assistants", "cli", "api", "ci", "webhooks",
  "review", "run-activity", "completion", "findings", "repair", "recheck",
  "systems", "guarantees", "memory",
  "recorded-reports",
] as const;

const GROUPS: Record<string, string> = {
  "Getting started": "Getting started",
  "Ways to run": "Ways to run",
  "The check": "The check",
  "The record": "The record",
};

const BROWSER_BANNER = { label: "Historical. This product is retired.", text: "This page describes the earlier browser-testing product and is kept only as history. Its service, API, console and accounts are closed: do not run the install commands or call the endpoints shown here." };
// The recorded-reports page described a different earlier component, so its banner names that one.
const RECORDED_BANNER = { label: "Historical. This component is retired.", text: "This page describes the earlier recorded-evidence component and is kept only as history. It is not current and not available." };

/** Prose from the retired product with nothing left to run: its endpoint URLs and its command spans become words. */
const RUNNABLE_URL = /https?:\/\/(?:app\.)?vraelis\.com(?:\/[^\s)\]`"']*)?/g;
const RUNNABLE_CODE = /`(?:vraelis|npx|npm|curl|irm|node|pnpm|yarn|export)[^`]*`/g;
function inert(text: string): string {
  return text.replace(RUNNABLE_URL, "(retired endpoint)").replace(RUNNABLE_CODE, "(retired command)");
}

function convert(b: V6Block): Block | null {
  switch (b.t) {
    // The earlier service is retired, so nothing on these pages may be runnable (founder 2026-10-11): code blocks
    // (install commands, API calls, CI snippets, webhook handlers) are replaced by a notice, and endpoint URLs and
    // command spans inside the prose are neutralised. The prose itself stays as history.
    case "code": return { t: "note", label: "Removed.", text: "This example called the earlier service, which is retired. Its commands and endpoints are no longer shown." };
    case "p": return { ...b, text: inert(b.text) };
    case "note": return { ...b, text: inert(b.text) };
    case "ul": case "steps": return { ...b, items: b.items.map(inert) };
    case "table": return { ...b, rows: b.rows.map((r) => r.map(inert)) };
    case "h2": return { t: "h2", text: b.text };
    case "h3": return { t: "h3", text: b.text, id: b.id };
    // The coverage list the browser product published, as it stood. Kept as a table so the twin can carry it.
    case "surfaces": return {
      t: "table", label: "Surfaces at the time", head: ["Surface", "Status at the time", "Summary"],
      rows: SURFACES.map((s) => [s.name, s.tier === "Next" ? "Not built" : s.tier, s.brief]),
    };
    // v6 figures were console screenshots of the earlier product; none of the docs below carries one.
    case "figure": return null;
    default: return null;
  }
}

function toPage(doc: Doc): Page {
  const recorded = doc.slug === "recorded-reports";
  const group = recorded ? "Recorded evidence" : GROUPS[doc.group] ?? doc.group;
  const facts: Block = { t: "facts", rows: [["Outcome", doc.outcome], ...(doc.limit ? [["Does not do", doc.limit] as [string, string]] : [])] };
  return {
    tab: "earlier", group, slug: doc.slug,
    title: doc.title,
    description: `Earlier implementation reference. ${doc.summary}`,
    lead: doc.summary,
    banner: recorded ? RECORDED_BANNER : BROWSER_BANNER,
    blocks: [facts, ...doc.blocks.map(convert).filter((b): b is Block => b !== null)],
  };
}

export const EARLIER_PAGES: Page[] = ORDER.map((slug) => {
  const doc = DOCS.find((d) => d.slug === slug);
  if (!doc) throw new Error(`v6 doc ${slug} is missing`);
  return toPage(doc);
});

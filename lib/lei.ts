// Live Execution Interface (LEI) shared types + helpers.
//
// LEI is the /app workspace's reactive layer: the AI morphs UI panels
// based on what the user drops in, what they say, and what intent the
// text reveals. Costs are mirrored from lib/credits.ts so the input
// chip can preview cost without a server round-trip.

import { CREDIT_COSTS, type CreditKind } from "./credits";

export type AttachmentKind = "image" | "video" | "file" | "code";

export type LeiAttachment = {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  // For image/video: object URL (revoked when attachment removed).
  // For file/code: the extracted text content (truncated).
  previewUrl?: string;
  text?: string;
};

export type LeiPanel =
  | { kind: "none" }
  | { kind: "image"; attachmentId: string }
  | { kind: "video"; attachmentId: string }
  | { kind: "file"; attachmentId: string }
  | { kind: "code"; language?: string; source: string }
  | { kind: "timeline"; topic: string };

export type VoiceModeStyle = "v2v" | "v2t";

export const ATTACHMENT_TEXT_CAP = 24_000;

export function classifyFile(file: File): AttachmentKind {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const codeExt = /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|cs|rb|php|swift|kt|sh|sql|yml|yaml|toml|json|css|scss|html?)$/i;
  if (codeExt.test(file.name)) return "code";
  return "file";
}

// Plans whose weekly caps are unlimited — these never burn credits
// for the gated kinds (chat/image/voice) under normal usage. Mirrors
// PLAN_LIMITS in lib/plan-limits.ts; kept as a static set here so the
// LEI cost preview stays a pure client-side helper.
const PLAN_BYPASSES_CREDITS = new Set(["pro", "teams", "enterprise"]);

export type CostPreview = {
  kind: CreditKind;
  credits: number;
  usd: string;
  // True when the user's plan covers this kind without burning credits.
  // The chip should still show the credit cost (so they understand the
  // pricing model) but with a "Free with your plan" framing.
  planCovers: boolean;
};

export function previewCreditCost(args: {
  inputText: string;
  hasImage?: boolean;
  hasVideo?: boolean;
  voiceMode?: boolean;
  plan?: string;
}): CostPreview {
  const planCovers = PLAN_BYPASSES_CREDITS.has((args.plan ?? "").toLowerCase());
  if (args.hasImage) {
    return fmt("image", planCovers);
  }
  if (args.hasVideo) {
    // Video gen mock cost — bigger than image. Reflects "if this were
    // real" pricing so the UI doesn't lie.
    return { kind: "image", credits: 30, usd: "$0.30", planCovers };
  }
  if (args.voiceMode) {
    return fmt("voice_minute", planCovers);
  }
  return fmt("chat", planCovers);
}

function fmt(kind: CreditKind, planCovers: boolean): CostPreview {
  const credits = CREDIT_COSTS[kind];
  return { kind, credits, usd: `$${(credits / 100).toFixed(2)}`, planCovers };
}

// Cheap intent detector: scans text for keywords that should morph the
// UI to a different panel even before a dropped file or AI response.
// Conservative — only fires when the signal is unambiguous.
export function detectIntent(text: string): LeiPanel | null {
  const t = text.toLowerCase();
  if (/\b(video|timeline|edit clip|trim|mp4|footage)\b/.test(t)) {
    return { kind: "timeline", topic: text.slice(0, 60) };
  }
  if (
    /```/.test(text) ||
    /\b(function|class |const |def |import |fn |interface |struct )/.test(text)
  ) {
    const langMatch = /```(\w+)/.exec(text);
    return {
      kind: "code",
      language: langMatch?.[1],
      source: text,
    };
  }
  return null;
}

export function makeAttachmentId(): string {
  return `att_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

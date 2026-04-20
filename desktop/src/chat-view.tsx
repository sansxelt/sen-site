import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ALL_MODEL_OPTIONS,
  type ChatContentBlock,
  type ChatImageAttachment,
  type ChatMessage,
  type ChatToolResultBlock,
  type ChatToolUseBlock,
  createDesktopApiKey,
  fetchSpeech,
  generateImage,
  getSubscription,
  listDesktopApiKeys,
  listSources,
  type ModelTier,
  type Persona,
  revokeDesktopApiKey,
  shareThread,
  streamChat,
  streamChatWithTools,
  summarizeThread,
  transcribeAudio,
} from "./api";
import { usePreferences } from "./preferences";
import type { DesktopSession } from "./auth";
import { parseSections } from "./sections";
import { useSmoothStream } from "./use-smooth-stream";
import {
  buildThreadPreview,
  createThread,
  deriveThreadTitle,
  loadChatState,
  saveChatState,
  sortThreads,
  type DesktopThread,
} from "./chat-history";
import {
  loadRecentFiles,
  pushRecentFile,
  type RecentFile,
} from "./chat-input-menu";
import {
  type CanvasBlock,
  DesktopCanvas,
  extractLatestCanvas,
  stripCanvasBlocks,
} from "./canvas";
import {
  type CodeArtifact,
  CodePreview,
  findCodeArtifacts,
} from "./code-preview";

type DesktopChatViewProps = {
  session: DesktopSession;
  onOpenPlan: () => void;
  onOpenSources?: () => void;
  // v0.1.8 — workspace-level view switcher used by the `navigate`
  // tool. Values come from the Workspace `View` union.
  onNavigate?: (view: string) => void;
};

// v0.1.8 — A record of one tool call inside an assistant turn.
// Keyed by tool_use id (which Anthropic supplies); rendered as a
// chip under the assistant bubble so the user can see what got run.
export type ToolExecution = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "ok" | "error";
  summary: string;
};

type VoiceState = "idle" | "recording" | "transcribing" | "warming" | "speaking";

// v0.1.4 — drag-and-drop attachment. Text files inline their body
// into the next user message; image files become real vision inputs
// passed to the chat route as base64 (Anthropic image content blocks);
// other binaries surface as a name+size chip only.
type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  kind: "text" | "image" | "binary";
  body?: string;
  // Set on image attachments only. dataUrl is the full
  // "data:image/png;base64,..." form for thumbnail display; image
  // holds the parsed pieces we need to send to the chat route.
  dataUrl?: string;
  image?: ChatImageAttachment;
};

// Anthropic vision caps each image at 1MB, and so do we — anything
// larger is downscaled with a canvas resize before send. Keep this
// in sync with MAX_IMAGE_BYTES in app/api/ai/chat/route.ts.
const MAX_IMAGE_BYTES = 1_000_000;
const VISION_MIME_TYPES: ChatImageAttachment["media_type"][] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

function isVisionMime(type: string): type is ChatImageAttachment["media_type"] {
  return (VISION_MIME_TYPES as readonly string[]).includes(type);
}

// v0.1.8 — Coerce a structured-content message back to a flat string
// for places that just want the human-readable text (preview, search,
// markdown export, summarize-thread input). Tool_use / tool_result
// blocks render as chips, not text, so we drop them here.
function messageContentText(message: ChatMessage): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

// Cheap upper bound on the byte length of a base64 string.
function base64ByteLength(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// Read a file as a data URL (no extra wrapping). Used by image
// attachments so we can both render the thumbnail and feed the
// base64 payload to the chat route in one shot.
function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

// If the original image is larger than 1MB or has an unsupported
// MIME type, resample it through a canvas at progressively smaller
// scales until it fits under MAX_IMAGE_BYTES as a JPEG. Returns
// null if the browser can't decode the image at all.
async function resizeImageToBudget(
  file: File,
): Promise<{ media_type: ChatImageAttachment["media_type"]; data: string; dataUrl: string } | null> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = blobUrl;
    });
    if (!img) return null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const tryEncode = (scale: number, quality: number): string => {
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    };

    // Try decreasingly aggressive resamples until we fit under 1MB.
    const attempts: Array<{ scale: number; quality: number }> = [
      { scale: 1.0, quality: 0.85 },
      { scale: 0.8, quality: 0.8 },
      { scale: 0.6, quality: 0.75 },
      { scale: 0.45, quality: 0.7 },
      { scale: 0.3, quality: 0.65 },
      { scale: 0.2, quality: 0.6 },
    ];
    for (const { scale, quality } of attempts) {
      const dataUrl = tryEncode(scale, quality);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (base64ByteLength(base64) <= MAX_IMAGE_BYTES) {
        return { media_type: "image/jpeg", data: base64, dataUrl };
      }
    }
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

const TEXT_FILE_REGEX = /\.(txt|md|markdown|json|jsonc|yaml|yml|toml|csv|tsv|xml|html|htm|css|scss|less|js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|sql|env|gitignore|log|ini|conf)$/i;

function isLikelyTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (file.type === "application/json") return true;
  if (TEXT_FILE_REGEX.test(file.name)) return true;
  return false;
}

function attachmentKind(file: File): ChatAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (isLikelyTextFile(file)) return "text";
  return "binary";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const deltaMs = Date.now() - date.getTime();
  const deltaMin = Math.floor(deltaMs / (1000 * 60));
  if (deltaMin < 1) return "just now";
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaH = Math.floor(deltaMin / 60);
  if (deltaH < 24) return `${deltaH}h ago`;
  const deltaD = Math.floor(deltaH / 24);
  if (deltaD < 7) return `${deltaD}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "thread";
}

function buildMarkdownExport(thread: DesktopThread): string {
  const lines: string[] = [];
  lines.push(`# ${thread.title}`);
  lines.push("");
  lines.push(`_Exported ${new Date().toLocaleString()}_`);
  lines.push("");
  for (const message of thread.messages) {
    const speaker = message.role === "user" ? "**You:**" : "**sansxel-1:**";
    lines.push(speaker);
    lines.push("");
    lines.push(messageContentText(message));
    lines.push("");
  }
  return lines.join("\n");
}

function draftKey(threadId: string): string {
  return `sansxel.draft.${threadId}`;
}

type DesktopPlanKey =
  | "free"
  | "apprentice"
  | "studio"
  | "pro"
  | "teams"
  | "enterprise";

type LauncherRootId =
  | "files"
  | "recent"
  | "image"
  | "research"
  | "search"
  | "actions";

type LauncherActionId =
  | "fix"
  | "rewrite"
  | "explain"
  | "analyze"
  | "agent-mode"
  | "deep-think"
  | "auto-mode"
  | "add-sources"
  | "scan-files"
  | "use-memory"
  | "canvas"
  | "generate-ui"
  | "create-doc"
  | "github"
  | "files"
  | "apis";

type ComposerContext = {
  hasInput: boolean;
  hasAttachments: boolean;
  hasImageAttachments: boolean;
  hasTextAttachments: boolean;
  hasBinaryAttachments: boolean;
  hasCode: boolean;
  hasUrls: boolean;
  inputPreview: string;
  suggestedRoot: LauncherRootId;
  suggestedAction: LauncherActionId;
  summaryLabel: string;
};

type LauncherActionMeta = {
  id: LauncherActionId;
  label: string;
  shortLabel: string;
  section: "Intelligence" | "Context" | "Creation" | "Integrations";
  eyebrow: string;
  description: string;
  preview: string;
  cues: string[];
  requiredPlan?: DesktopPlanKey;
  comingSoon?: boolean;
};

type QuickActionMeta = {
  id: LauncherActionId;
  label: string;
  hint: string;
};

type LauncherRootMeta = {
  id: LauncherRootId;
  label: string;
  eyebrow: string;
  description: string;
  preview: string;
  requiredPlan?: DesktopPlanKey;
};

type LauncherPreviewCard = {
  eyebrow: string;
  title: string;
  description: string;
  cues: string[];
  badge?: string;
  status?: string;
};

const PLAN_RANK: Record<DesktopPlanKey, number> = {
  free: 0,
  apprentice: 1,
  studio: 1,
  pro: 2,
  teams: 3,
  enterprise: 3,
};

const PLAN_LABEL: Record<DesktopPlanKey, string> = {
  free: "Free",
  apprentice: "Apprentice",
  studio: "Studio",
  pro: "Pro",
  teams: "Teams",
  enterprise: "Enterprise",
};

const ACTION_META: Record<LauncherActionId, LauncherActionMeta> = {
  fix: {
    id: "fix",
    label: "Fix",
    shortLabel: "FX",
    section: "Intelligence",
    eyebrow: "Fast rescue",
    description: "Patch something broken, tighten logic, or clean up a rough draft without overcomplicating it.",
    preview: "Best when you've already pasted the thing that needs help and want the strongest corrective pass next.",
    cues: ["Uses current input", "Great for code and text", "Quick-turn action"],
  },
  rewrite: {
    id: "rewrite",
    label: "Rewrite",
    shortLabel: "RW",
    section: "Creation",
    eyebrow: "Sharper wording",
    description: "Make rough writing cleaner, more confident, and easier to ship while keeping the original meaning.",
    preview: "Ideal for emails, docs, UI copy, bios, and anything that needs polish before you send it.",
    cues: ["Preserves intent", "Quick output", "Works with drafts or notes"],
  },
  explain: {
    id: "explain",
    label: "Explain",
    shortLabel: "EX",
    section: "Intelligence",
    eyebrow: "Clarity mode",
    description: "Break down code, screenshots, files, or strategy in plain language and call out the important part first.",
    preview: "Useful when the content is dense and you want the shortest path from confusion to understanding.",
    cues: ["Plain language", "Highlights what matters", "Good with code or files"],
  },
  analyze: {
    id: "analyze",
    label: "Analyze",
    shortLabel: "AN",
    section: "Intelligence",
    eyebrow: "Pattern read",
    description: "Read what you dropped in, spot the signals, and tell you what stands out plus what to do next.",
    preview: "Best for mixed input like notes, data, screenshots, or a fuzzy problem where you want a direction.",
    cues: ["Finds patterns", "Suggests next steps", "Works across formats"],
  },
  "agent-mode": {
    id: "agent-mode",
    label: "Agent Mode",
    shortLabel: "AG",
    section: "Intelligence",
    eyebrow: "Autonomous",
    description: "Switch into a more proactive step-by-step working mode that treats the task like something to execute, not just discuss.",
    preview: "Pairs well with PC copilot and longer tasks where you want planning, sequencing, and momentum.",
    cues: ["Turns on copilot flow", "Best for multi-step work", "Pro feature"],
    requiredPlan: "pro",
  },
  "deep-think": {
    id: "deep-think",
    label: "Deep Think",
    shortLabel: "DT",
    section: "Intelligence",
    eyebrow: "Heavy reasoning",
    description: "Push the launcher toward deep problem solving, stronger tradeoff analysis, and harder code or product questions.",
    preview: "This shifts you onto the deep model lane and frames the ask for deliberate reasoning.",
    cues: ["Switches to sansxel-1 deep", "Longer reasoning", "Pro feature"],
    requiredPlan: "pro",
  },
  "auto-mode": {
    id: "auto-mode",
    label: "Auto Mode",
    shortLabel: "AU",
    section: "Intelligence",
    eyebrow: "Adaptive",
    description: "Let Sansxel choose the most useful framing and start from the strongest first move instead of waiting for perfect instructions.",
    preview: "Good when the ask is messy and you want the assistant to decide whether to plan, write, analyze, or diagnose first.",
    cues: ["Balanced mode", "Good for fuzzy asks", "Apprentice and up"],
    requiredPlan: "apprentice",
  },
  "add-sources": {
    id: "add-sources",
    label: "Add sources",
    shortLabel: "SR",
    section: "Context",
    eyebrow: "Ground it",
    description: "Pull URLs, notes, and attached files into the next answer so the response is anchored in actual material.",
    preview: "Works especially well when you already have links or dropped docs and want synthesis instead of a generic answer.",
    cues: ["Uses links and files", "Better grounding", "Free"],
  },
  "scan-files": {
    id: "scan-files",
    label: "Scan files",
    shortLabel: "SC",
    section: "Context",
    eyebrow: "Read what's here",
    description: "Open the dropped files as working context and tell Sansxel to summarize, compare, or inspect them immediately.",
    preview: "This is the best first click after dropping docs, code, screenshots, or mixed research into the composer.",
    cues: ["Attachment-aware", "Opens on drop", "Free"],
  },
  "use-memory": {
    id: "use-memory",
    label: "Use memory",
    shortLabel: "MM",
    section: "Context",
    eyebrow: "Continue naturally",
    description: "Lean on the thread's existing context so the next answer continues from prior decisions instead of resetting.",
    preview: "Best for long-running work where the latest input only makes sense in the context of what you've already built here.",
    cues: ["Thread-aware", "Feels continuous", "Free"],
  },
  canvas: {
    id: "canvas",
    label: "Canvas",
    shortLabel: "CV",
    section: "Creation",
    eyebrow: "Visual structure",
    description: "Turn a rough ask into a structured workspace with sections, open questions, and the next blocks to fill in.",
    preview: "Useful for plans, product breakdowns, research walls, and anything that benefits from visible structure.",
    cues: ["Organized layout", "Good for planning", "Free"],
  },
  "generate-ui": {
    id: "generate-ui",
    label: "Generate UI",
    shortLabel: "UI",
    section: "Creation",
    eyebrow: "Interface builder",
    description: "Frame the task like a real product UI problem with screens, states, hierarchy, and the visual direction spelled out.",
    preview: "Great when the input is a feature idea, screenshot, or messy product note and you want a usable UI concept.",
    cues: ["UI-focused", "Structured output", "Apprentice and up"],
    requiredPlan: "apprentice",
  },
  "create-doc": {
    id: "create-doc",
    label: "Create doc",
    shortLabel: "DOC",
    section: "Creation",
    eyebrow: "Ship-ready writing",
    description: "Convert rough material into a proper document with title, sections, supporting details, and final wording.",
    preview: "Best for specs, one-pagers, memos, outlines, notes, and internal docs that need to be usable right away.",
    cues: ["Structured document", "Ready to share", "Free"],
  },
  github: {
    id: "github",
    label: "GitHub",
    shortLabel: "GH",
    section: "Integrations",
    eyebrow: "Repo context",
    description: "Pull repo, issue, and PR context into the action system once GitHub is fully wired into this launcher.",
    preview: "Visible now so users know the capability exists, with Studio and up positioned as the unlock tier.",
    cues: ["Integration surface", "Launcher-native later", "Studio feature"],
    requiredPlan: "studio",
    comingSoon: true,
  },
  files: {
    id: "files",
    label: "Files",
    shortLabel: "FL",
    section: "Integrations",
    eyebrow: "Desktop context",
    description: "Use dropped docs, code, and screenshots as structured context instead of burying them in a prompt paragraph.",
    preview: "This is the launcher's most immediate superpower on desktop: drag something in and the action system adapts around it.",
    cues: ["Local-first", "Pairs with drag and drop", "Free"],
  },
  apis: {
    id: "apis",
    label: "APIs",
    shortLabel: "API",
    section: "Integrations",
    eyebrow: "Future surface",
    description: "Reserve space for API-connected tools so the launcher can grow into a real capability hub instead of staying a tiny menu.",
    preview: "Kept visible on purpose so the system feels expandable, but not noisy, as more integrations land.",
    cues: ["Reserved slot", "Premium surface", "Coming soon"],
    requiredPlan: "pro",
    comingSoon: true,
  },
};

const ACTION_SECTION_ORDER: Array<LauncherActionMeta["section"]> = [
  "Intelligence",
  "Context",
  "Creation",
  "Integrations",
];

const ROOT_MENU_ORDER: LauncherRootId[] = [
  "files",
  "recent",
  "image",
  "research",
  "search",
  "actions",
];

const ROOT_META: Record<LauncherRootId, LauncherRootMeta> = {
  files: {
    id: "files",
    label: "Add photos & files",
    eyebrow: "Desktop context",
    description: "Drop screenshots, docs, code, and loose files straight into the composer.",
    preview: "Drag-and-drop auto-opens the launcher and points you at the best next action.",
  },
  recent: {
    id: "recent",
    label: "Recent files",
    eyebrow: "Fast re-attach",
    description: "Bring back the files you were just working with without digging around your desktop again.",
    preview: "Useful for repeated source packs, recurring docs, and picking up where you left off.",
  },
  image: {
    id: "image",
    label: "Create image",
    eyebrow: "Visual generation",
    description: "Turn the current prompt into an image request or use it to generate UI and concept directions.",
    preview: "Best when you already know the look you want and need a fast visual pass next.",
  },
  research: {
    id: "research",
    label: "Deep research",
    eyebrow: "Long-form exploration",
    description: "Frame the next turn like a deeper investigative pass instead of a quick response.",
    preview: "Great for product decisions, comparisons, strategy, and multi-angle questions.",
    requiredPlan: "apprentice",
  },
  search: {
    id: "search",
    label: "Web search",
    eyebrow: "Live grounding",
    description: "Use search-shaped prompts and source-aware framing when the answer should be grounded in current material.",
    preview: "Best when you have links, names, or a narrow question and want a grounded answer instead of a generic take.",
  },
  actions: {
    id: "actions",
    label: "Actions",
    eyebrow: "Smart launcher",
    description: "Open the full adaptive capability system with quick actions, grouped tools, and tier-aware upgrades.",
    preview: "This is where the composer becomes a workspace instead of a plain text box.",
  },
};

const CODE_SIGNAL_PATTERNS = [
  /```/,
  /\bfunction\s+[A-Za-z0-9_]+\s*\(/,
  /\bconst\s+[A-Za-z0-9_]+\s*=/,
  /\bimport\s+.+from\s+['"]/,
  /\bclass\s+[A-Za-z0-9_]+\b/,
  /<\/?[A-Za-z][^>]*>/,
  /\bSELECT\b.+\bFROM\b/i,
  /\bdef\s+[A-Za-z0-9_]+\s*\(/,
];

function normalizePlanKey(plan: string): DesktopPlanKey {
  switch (plan) {
    case "apprentice":
    case "studio":
    case "pro":
    case "teams":
    case "enterprise":
      return plan;
    default:
      return "free";
  }
}

function planAllows(plan: string, requiredPlan?: DesktopPlanKey): boolean {
  if (!requiredPlan) return true;
  const normalized = normalizePlanKey(plan);
  return PLAN_RANK[normalized] >= PLAN_RANK[requiredPlan];
}

function planBadge(requiredPlan?: DesktopPlanKey): string | null {
  return requiredPlan ? PLAN_LABEL[requiredPlan] : null;
}

function looksLikeCode(input: string, attachments: ChatAttachment[]): boolean {
  const text = input.trim();
  if (text && CODE_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }
  return attachments.some((attachment) => {
    if (attachment.kind !== "text") return false;
    if (TEXT_FILE_REGEX.test(attachment.name)) return true;
    return attachment.body ? CODE_SIGNAL_PATTERNS.some((pattern) => pattern.test(attachment.body ?? "")) : false;
  });
}

function inferComposerContext(
  input: string,
  attachments: ChatAttachment[],
): ComposerContext {
  const trimmed = input.trim();
  const hasInput = Boolean(trimmed);
  const hasAttachments = attachments.length > 0;
  const hasImageAttachments = attachments.some((attachment) => attachment.kind === "image");
  const hasTextAttachments = attachments.some((attachment) => attachment.kind === "text");
  const hasBinaryAttachments = attachments.some((attachment) => attachment.kind === "binary");
  const hasUrls = /https?:\/\//i.test(trimmed);
  const hasCode = looksLikeCode(trimmed, attachments);

  if (hasImageAttachments) {
    return {
      hasInput,
      hasAttachments,
      hasImageAttachments,
      hasTextAttachments,
      hasBinaryAttachments,
      hasCode,
      hasUrls,
      inputPreview: trimmed.slice(0, 160),
      suggestedRoot: "actions",
      suggestedAction: "scan-files",
      summaryLabel:
        attachments.length > 1 ? `${attachments.length} images ready` : "Image context ready",
    };
  }

  if (hasCode) {
    return {
      hasInput,
      hasAttachments,
      hasImageAttachments,
      hasTextAttachments,
      hasBinaryAttachments,
      hasCode,
      hasUrls,
      inputPreview: trimmed.slice(0, 160),
      suggestedRoot: "actions",
      suggestedAction: "fix",
      summaryLabel: hasAttachments ? "Code + files detected" : "Code detected",
    };
  }

  if (hasAttachments) {
    return {
      hasInput,
      hasAttachments,
      hasImageAttachments,
      hasTextAttachments,
      hasBinaryAttachments,
      hasCode,
      hasUrls,
      inputPreview: trimmed.slice(0, 160),
      suggestedRoot: "actions",
      suggestedAction: "scan-files",
      summaryLabel:
        attachments.length === 1 ? `${attachments[0].name} attached` : `${attachments.length} files attached`,
    };
  }

  if (hasUrls) {
    return {
      hasInput,
      hasAttachments,
      hasImageAttachments,
      hasTextAttachments,
      hasBinaryAttachments,
      hasCode,
      hasUrls,
      inputPreview: trimmed.slice(0, 160),
      suggestedRoot: "search",
      suggestedAction: "add-sources",
      summaryLabel: "Links detected",
    };
  }

  if (hasInput) {
    return {
      hasInput,
      hasAttachments,
      hasImageAttachments,
      hasTextAttachments,
      hasBinaryAttachments,
      hasCode,
      hasUrls,
      inputPreview: trimmed.slice(0, 160),
      suggestedRoot: "actions",
      suggestedAction: "analyze",
      summaryLabel: "Draft ready",
    };
  }

  return {
    hasInput: false,
    hasAttachments: false,
    hasImageAttachments: false,
    hasTextAttachments: false,
    hasBinaryAttachments: false,
    hasCode: false,
    hasUrls: false,
    inputPreview: "",
    suggestedRoot: "actions",
    suggestedAction: "rewrite",
    summaryLabel: "Smart launcher ready",
  };
}

function buildQuickActions(context: ComposerContext): QuickActionMeta[] {
  if (context.hasImageAttachments) {
    return [
      { id: "scan-files", label: "Analyze image", hint: "Read what is visible and call out the important bits." },
      { id: "explain", label: "Extract text", hint: "Pull text and summarize it cleanly." },
      { id: "analyze", label: "Compare", hint: "Compare what changed or what stands out." },
      { id: "rewrite", label: "Edit plan", hint: "Turn this into a concrete edit brief." },
    ];
  }

  if (context.hasCode) {
    return [
      { id: "fix", label: "Fix", hint: "Patch the issue and explain the root cause." },
      { id: "analyze", label: "Optimize", hint: "Improve the code path and call out tradeoffs." },
      { id: "explain", label: "Explain", hint: "Break the code down in plain language." },
      { id: "deep-think", label: "Deep Think", hint: "Use the heavy reasoning lane on harder code." },
    ];
  }

  if (context.hasAttachments) {
    return [
      { id: "scan-files", label: "Scan files", hint: "Read the attachments and tell me what matters." },
      { id: "analyze", label: "Analyze", hint: "Spot patterns, risks, and next actions." },
      { id: "create-doc", label: "Create doc", hint: "Turn the files into a usable document." },
      { id: "rewrite", label: "Rewrite", hint: "Condense or polish what is here." },
    ];
  }

  return [
    { id: "fix", label: "Fix", hint: "Repair or tighten something fast." },
    { id: "rewrite", label: "Rewrite", hint: "Sharpen wording without losing the point." },
    { id: "explain", label: "Explain", hint: "Make something clearer in plain language." },
    { id: "analyze", label: "Analyze", hint: "Read the situation and tell me what matters." },
  ];
}

function attachmentPromptHint(attachments: ChatAttachment[]): string {
  if (attachments.some((attachment) => attachment.kind === "image")) {
    return "Review the attached image context and tell me what stands out.";
  }
  if (attachments.some((attachment) => attachment.kind === "text")) {
    return "Read the attached files and pull out the key takeaways.";
  }
  return "Review the attached files and tell me what I should do next.";
}

function buildActionPrompt(
  id: LauncherActionId,
  context: ComposerContext,
  userInput: string,
  attachments: ChatAttachment[],
): string {
  const trimmed = userInput.trim();
  const source =
    trimmed ||
    (attachments.length > 0
      ? attachmentPromptHint(attachments)
      : "Help me turn this into the right next move.");

  switch (id) {
    case "fix":
      return `Fix this and explain the root cause briefly:\n\n${source}`;
    case "rewrite":
      return `Rewrite this so it feels clearer, sharper, and more natural without losing the meaning:\n\n${source}`;
    case "explain":
      return `Explain this clearly, call out what matters most, and keep it easy to follow:\n\n${source}`;
    case "analyze":
      return `Analyze this, surface the important patterns, and tell me the strongest next step:\n\n${source}`;
    case "agent-mode":
      return `Treat this like a real task to execute. Plan it step by step, make the decisions explicit, and move it forward:\n\n${source}`;
    case "deep-think":
      return `Think through this carefully. Surface hidden assumptions, evaluate tradeoffs, and recommend the strongest path:\n\n${source}`;
    case "auto-mode":
      return `Decide the best way to tackle this and start with the strongest first move:\n\n${source}`;
    case "add-sources":
      return `Use the links, files, and source material here as grounding. Cross-check what matters and synthesize the answer:\n\n${source}`;
    case "scan-files":
      return `Scan the attached files, summarize what matters, and call out anything risky, missing, or especially important:\n\n${source}`;
    case "use-memory":
      return `Use what this thread already knows plus this new input, and continue from the most relevant context:\n\n${source}`;
    case "canvas":
      return `Turn this into a structured canvas with sections, priorities, open questions, and the next actions:\n\n${source}`;
    case "generate-ui":
      return `Design the UI for this. Give me the structure, components, states, and visual direction:\n\n${source}`;
    case "create-doc":
      return `Turn this into a clean document I can use right away with a strong title, sections, and final wording:\n\n${source}`;
    case "github":
      return trimmed || "I want to work with GitHub context. Ask me for the repo, branch, PR, or issue and then help me from there.";
    case "files":
      return `Use the attached files as first-class context and help me work through them, not just summarize them:\n\n${source}`;
    case "apis":
      return trimmed || "Sketch how this should connect to external APIs, including the integration shape, auth, and risks.";
    default:
      return source;
  }
}

function actionRuntimeStatus(
  id: LauncherActionId,
  opts: {
    agentMode: boolean;
    canvasOpen: boolean;
    tier: ModelTier;
    context: ComposerContext;
  },
): string | null {
  switch (id) {
    case "agent-mode":
      return opts.agentMode ? "Agent mode is currently on." : null;
    case "deep-think":
      return opts.tier === "smart" ? "sansxel-1 deep is selected." : null;
    case "auto-mode":
      return opts.tier === "balanced" ? "Adaptive default lane is active." : null;
    case "scan-files":
      return opts.context.hasAttachments ? opts.context.summaryLabel : null;
    case "canvas":
      return opts.canvasOpen ? "Canvas pane is already open." : null;
    case "use-memory":
      return opts.context.hasInput || opts.context.hasAttachments
        ? "This action will blend the current turn with thread context."
        : "Best when the thread already has useful context to build on.";
    default:
      return null;
  }
}

function buildActionPreview(
  id: LauncherActionId,
  opts: {
    agentMode: boolean;
    canvasOpen: boolean;
    tier: ModelTier;
    context: ComposerContext;
  },
): LauncherPreviewCard {
  const meta = ACTION_META[id];
  return {
    eyebrow: meta.eyebrow,
    title: meta.label,
    description: meta.preview,
    cues: meta.cues,
    badge: meta.comingSoon ? "Coming soon" : planBadge(meta.requiredPlan) ?? undefined,
    status: actionRuntimeStatus(id, opts) ?? undefined,
  };
}

function buildRootPreview(
  root: LauncherRootId,
  context: ComposerContext,
  recentFiles: RecentFile[],
): LauncherPreviewCard {
  const meta = ROOT_META[root];
  switch (root) {
    case "recent":
      return {
        eyebrow: meta.eyebrow,
        title: meta.label,
        description: meta.preview,
        badge: recentFiles.length > 0 ? `${recentFiles.length} saved` : "Empty",
        cues: [
          "Re-attach in one click",
          "Keeps repeated workflows fast",
          recentFiles.length > 0 ? `${recentFiles[0].name} was the most recent.` : "Attach something to start the list.",
        ],
      };
    case "actions":
      return {
        eyebrow: meta.eyebrow,
        title: meta.label,
        description: meta.preview,
        badge: context.summaryLabel,
        cues: [
          "Quick actions update with your context",
          "Tier locks stay visible instead of disappearing",
          "Hover any action to preview what it does before you run it",
        ],
      };
    case "files":
      return {
        eyebrow: meta.eyebrow,
        title: meta.label,
        description: meta.preview,
        badge: context.hasAttachments ? context.summaryLabel : undefined,
        cues: [
          "Drop files anywhere in the chat shell",
          "Attachments become first-class context",
          "The launcher auto-points you to scan or analyze next",
        ],
      };
    case "image":
      return {
        eyebrow: meta.eyebrow,
        title: meta.label,
        description: meta.preview,
        cues: [
          context.hasInput ? "The current draft can become an image prompt immediately." : "Type a visual brief first for the best result.",
          "Works well for mockups, scenes, and UI concepts",
          "Pairs with Generate UI when the ask is product-shaped",
        ],
      };
    case "research":
      return {
        eyebrow: meta.eyebrow,
        title: meta.label,
        description: meta.preview,
        badge: planBadge(meta.requiredPlan) ?? undefined,
        cues: [
          "Useful for complex tradeoffs and multi-angle questions",
          "Better when you give it a clear topic or some source material",
          context.hasInput ? "Your current draft is ready for a deeper pass." : "Seed it with a topic to start.",
        ],
      };
    case "search":
      return {
        eyebrow: meta.eyebrow,
        title: meta.label,
        description: meta.preview,
        badge: context.hasUrls ? "Links detected" : undefined,
        cues: [
          "Best when the answer should be grounded",
          "Pairs well with links, names, or a current-event query",
          context.hasUrls ? "The composer already contains source-like input." : "Paste a link or a narrow query to sharpen it.",
        ],
      };
    default:
      return {
        eyebrow: meta.eyebrow,
        title: meta.label,
        description: meta.preview,
        cues: [meta.description],
      };
  }
}

function buildRecentPreview(file: RecentFile): LauncherPreviewCard {
  return {
    eyebrow: file.kind === "text" ? "Text file" : file.kind === "image" ? "Image file" : "Attached file",
    title: file.name,
    description:
      file.kind === "text" && file.body
        ? file.body.slice(0, 220)
        : "Re-attach this file and the launcher will adapt around it again.",
    badge: formatBytes(file.size),
    status: `Saved ${formatRelative(file.savedAt)}`,
    cues: [
      file.kind === "text" ? "Body is cached for fast re-attach." : "Will reappear as an attachment chip.",
      "Good for repeated workflows",
      "Selecting it keeps the composer in context",
    ],
  };
}

const EMPTY_STATE_BY_TIER: Record<
  ModelTier,
  {
    title: string;
    copilotTitle: string;
    description: string;
    copilotDescription: string;
    topbarCopy: string;
    inputPlaceholder: string;
    capabilities: string[];
    starters: Array<{ label: string; prompt: string; blurb: string }>;
  }
> = {
  fast: {
    title: "Move fast.",
    copilotTitle: "Pinned for quick turns.",
    description:
      "Best for rapid questions, rewrites, and everyday desktop asks when you want speed over depth.",
    copilotDescription:
      "Quick utility mode for short asks while you stay inside the rest of your workflow.",
    topbarCopy: "Fast mode keeps the UI lighter and nudges you toward quick-turn prompts.",
    inputPlaceholder: "Ask for a quick answer, rewrite, or shortcut...",
    capabilities: ["Quick answers", "Short rewrites", "Desktop utility"],
    starters: [
      {
        label: "Rewrite cleanly",
        blurb: "Tighten text without changing the meaning.",
        prompt: "Rewrite this to sound clearer and more confident without making it longer:",
      },
      {
        label: "Get unstuck",
        blurb: "Fast diagnosis for something broken or confusing.",
        prompt: "I need a quick diagnosis and next steps for this problem:",
      },
      {
        label: "Summarize fast",
        blurb: "Boil down a doc, chat, or wall of text.",
        prompt: "Summarize this into the few key takeaways and the next action I should take:",
      },
    ],
  },
  balanced: {
    title: "Build with context.",
    copilotTitle: "Pinned and ready.",
    description:
      "The main workspace mode for writing, coding, planning, and keeping thread memory visible while topics evolve.",
    copilotDescription:
      "A balanced desktop copilot for real work: enough context to stay useful without feeling heavy.",
    topbarCopy: "Default mode leans into writing, planning, and back-and-forth iteration.",
    inputPlaceholder: "Message sansxel-1 with a task, draft, or idea...",
    capabilities: ["Writing + code", "Thread memory", "Voice + desktop flow"],
    starters: [
      {
        label: "Plan something",
        blurb: "Turn a rough idea into steps.",
        prompt: "Help me turn this idea into a concrete plan with the first few actions:",
      },
      {
        label: "Draft with me",
        blurb: "Write something polished from rough input.",
        prompt: "Draft this in a polished way, but keep the tone grounded and human:",
      },
      {
        label: "Think through tradeoffs",
        blurb: "Compare options and recommend one.",
        prompt: "Compare the best options here, explain the tradeoffs, and recommend one path:",
      },
    ],
  },
  smart: {
    title: "Go deeper.",
    copilotTitle: "Pinned for deep work.",
    description:
      "Deep mode is for multi-step reasoning, harder code paths, and prompts where the best answer needs more structure.",
    copilotDescription:
      "Use deep mode when the answer needs stronger reasoning, not just a fast reaction.",
    topbarCopy: "Deep mode shifts the UI toward heavier reasoning and more deliberate prompts.",
    inputPlaceholder: "Give sansxel-1 deep a problem worth thinking through...",
    capabilities: ["Multi-step reasoning", "Harder code paths", "Longer planning"],
    starters: [
      {
        label: "Debug deeply",
        blurb: "Trace a bug like a senior engineer would.",
        prompt: "Debug this systematically. Start with the most likely root causes, then give me the fix path:",
      },
      {
        label: "Design the system",
        blurb: "Think through architecture and constraints.",
        prompt: "Design the best approach for this system or feature, including tradeoffs and risks:",
      },
      {
        label: "Reason it out",
        blurb: "Work through a hard decision carefully.",
        prompt: "Think through this carefully, surface the hidden assumptions, and recommend the strongest path:",
      },
    ],
  },
};

export function DesktopChatView({
  session,
  onOpenPlan,
  onOpenSources,
  onNavigate,
}: DesktopChatViewProps) {
  const { prefs, update } = usePreferences();
  const [threads, setThreads] = useState<DesktopThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [titleFlashId, setTitleFlashId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [tier, setTier] = useState<ModelTier>(prefs.default_tier);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceMode, setVoiceMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [allowedTiers, setAllowedTiers] = useState<Set<ModelTier>>(
    new Set(["fast", "balanced", "smart"]),
  );
  const [planForGating, setPlanForGating] = useState<string>("free");
  // v0.1.4 power features.
  const [dragOver, setDragOver] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showFolded, setShowFolded] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherRoot, setLauncherRoot] = useState<LauncherRootId>("actions");
  const [hoveredActionId, setHoveredActionId] = useState<LauncherActionId | null>(null);
  const [hoveredRecentFile, setHoveredRecentFile] = useState<RecentFile | null>(null);
  // v0.1.4 — "+" menu features. None of these persist across sessions:
  // agent mode + canvas reset on every launch, recent files live in
  // localStorage so they survive reloads without leaking into other
  // accounts (the key is shared because attachments aren't sensitive
  // and the UI always shows the file name before re-attaching).
  const [agentMode, setAgentMode] = useState(false);
  // v0.1.4 — canvas pane. Opens the moment the assistant emits a
  // [canvas:Title]…[/canvas] block; closing is sticky (won't auto-
  // re-open until the next emitted block). The block itself is
  // computed from the latest assistant message.
  const [canvasBlock, setCanvasBlock] = useState<CanvasBlock | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const lastCanvasKeyRef = useRef<string | null>(null);
  // v0.1.4 — live HTML/JS artifact preview. The chat scans assistant
  // bubbles for runnable code blocks; clicking "Run preview" hoists
  // the chosen artifact here and the side panel renders it inside a
  // sandboxed iframe. Opening a canvas closes any open preview and
  // vice versa — only one side panel at a time.
  const [activeArtifact, setActiveArtifact] = useState<CodeArtifact | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => loadRecentFiles());
  // v0.1.8 — tool executions, keyed by `${threadId}:${assistantIdx}`.
  // We never persist these — they're a transient UI affordance so the
  // user can see what just got executed in the current session.
  const [toolExecutions, setToolExecutions] = useState<
    Record<string, ToolExecution[]>
  >({});
  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const launcherRef = useRef<HTMLDivElement | null>(null);
  const draftHydratedRef = useRef<string | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const sendStartRef = useRef<number>(0);
  const lastTurnVoiceRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  // Bumped each time the user explicitly exits voice mode. The recorder
  // captures the value on start; if onstop sees it changed, we abandon
  // the recording (don't transcribe, don't send). Stops "Esc while
  // recording" from sending a hallucinated message.
  const voiceTurnIdRef = useRef(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const voiceStateRef = useRef<VoiceState>("idle");
  const voiceModeRef = useRef(false);
  const threadsRef = useRef<DesktopThread[]>([]);
  const activeThreadIdRef = useRef<string | null>(null);
  const streamingThreadIdRef = useRef<string | null>(null);
  const titleFlashTimerRef = useRef<number | null>(null);
  const speechTokenRef = useRef(0);
  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const interruptHandlerRef = useRef<(() => void) | null>(null);
  const noiseFloorRef = useRef(0.04);
  const heardSpeechRef = useRef(false);
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});
  const sendRef = useRef<(overrideText?: string, fromVoice?: boolean) => Promise<void>>(
    async () => {},
  );

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  // Filter sidebar threads by search query (matches title + preview).
  // Empty query returns all threads unchanged. Folded threads are
  // hidden by default but surface when "Show folded" is toggled or
  // the user is searching.
  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visible = q || showFolded
      ? threads
      : threads.filter((thread) => !thread.folded);
    if (!q) return visible;
    return visible.filter((thread) => {
      return (
        thread.title.toLowerCase().includes(q) ||
        thread.preview.toLowerCase().includes(q) ||
        thread.messages.some((m) => messageContentText(m).toLowerCase().includes(q))
      );
    });
  }, [threads, searchQuery, showFolded]);

  const foldedCount = useMemo(
    () => threads.filter((thread) => thread.folded).length,
    [threads],
  );

  // ⌘F / Ctrl+F focuses the sidebar search input.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && (event.key === "f" || event.key === "F")) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const messages = useMemo(() => activeThread?.messages ?? [], [activeThread]);
  // v0.1.13 \u2014 Toolbar mode (the "PC copilot" / window-mode feature)
  // was deleted: it never worked well outside normal scale and offered
  // no value over the floating Sansxel Copilot. Hardcoded to false so
  // any existing isCopilot conditionals collapse to the normal path.
  const isCopilot = false;
  const activeModel = useMemo(
    () => ALL_MODEL_OPTIONS.find((option) => option.tier === tier) ?? ALL_MODEL_OPTIONS[0],
    [tier],
  );
  const emptyState = EMPTY_STATE_BY_TIER[tier];
  const composerContext = useMemo(
    () => inferComposerContext(input, attachments),
    [input, attachments],
  );
  const quickActions = useMemo(
    () => buildQuickActions(composerContext),
    [composerContext],
  );
  const launcherPreview = useMemo(() => {
    if (hoveredRecentFile) {
      return buildRecentPreview(hoveredRecentFile);
    }
    if (hoveredActionId) {
      return buildActionPreview(hoveredActionId, {
        agentMode,
        canvasOpen,
        tier,
        context: composerContext,
      });
    }
    return buildRootPreview(launcherRoot, composerContext, recentFiles);
  }, [
    hoveredRecentFile,
    hoveredActionId,
    agentMode,
    canvasOpen,
    tier,
    composerContext,
    launcherRoot,
    recentFiles,
  ]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadChatState(session.email);
      if (cancelled) return;
      if (saved.threads.length > 0) {
        setThreads(saved.threads);
        setActiveThreadId(saved.activeThreadId ?? saved.threads[0].id);
      } else {
        const starter = createThread();
        setThreads([starter]);
        setActiveThreadId(starter.id);
      }
      setHistoryReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.email]);

  useEffect(() => {
    if (!historyReady) return;
    void saveChatState(session.email, threads, activeThreadId);
  }, [historyReady, session.email, threads, activeThreadId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sub = await getSubscription(session.token);
        if (cancelled) return;
        setAllowedTiers(new Set(sub.tiers.map((entry) => entry.tier)));
        setPlanForGating(sub.plan);
      } catch {
        // fall back to optimistic defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  useEffect(() => {
    setTier(prefs.default_tier);
  }, [prefs.default_tier]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeThreadId, messages]);

  // v0.1.4 — auto-restore the draft when the active thread changes.
  // Reads from localStorage synchronously on switch. We track the last
  // hydrated thread id so we don't clobber the live input field with
  // a stale draft on every rerender.
  useEffect(() => {
    if (!activeThreadId) return;
    if (draftHydratedRef.current === activeThreadId) return;
    draftHydratedRef.current = activeThreadId;
    try {
      const stored = window.localStorage.getItem(draftKey(activeThreadId));
      setInput(stored ?? "");
    } catch {
      // localStorage unavailable (private mode, etc.) — silently skip.
    }
  }, [activeThreadId]);

  // v0.1.4 — toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(handle);
  }, [toast]);

  useEffect(() => {
    if (!launcherOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!launcherRef.current) return;
      if (!launcherRef.current.contains(event.target as Node)) {
        setLauncherOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLauncherOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [launcherOpen]);

  useEffect(() => {
    return () => {
      if (titleFlashTimerRef.current !== null) {
        window.clearTimeout(titleFlashTimerRef.current);
      }
    };
  }, []);

  const flashTitle = useCallback((threadId: string) => {
    setTitleFlashId(threadId);
    if (titleFlashTimerRef.current !== null) {
      window.clearTimeout(titleFlashTimerRef.current);
    }
    titleFlashTimerRef.current = window.setTimeout(() => {
      setTitleFlashId((current) => (current === threadId ? null : current));
    }, 480);
  }, []);

  const updateThread = useCallback(
    (threadId: string, updater: (thread: DesktopThread) => DesktopThread) => {
      setThreads((current) =>
        current
          .map((thread) => (thread.id === threadId ? updater(thread) : thread))
          .sort(sortThreads),
      );
    },
    [],
  );

  // v0.1.4 — debounce-persist the chat draft to localStorage so we can
  // restore it on app reload / thread switch. 400ms keeps us off the
  // hot path during fast typing while still feeling instant.
  const handleInputChange = useCallback(
    (next: string) => {
      setInput(next);
      const threadId = activeThreadIdRef.current;
      if (!threadId) return;
      if (draftTimerRef.current !== null) {
        window.clearTimeout(draftTimerRef.current);
      }
      draftTimerRef.current = window.setTimeout(() => {
        try {
          if (next) {
            window.localStorage.setItem(draftKey(threadId), next);
          } else {
            window.localStorage.removeItem(draftKey(threadId));
          }
        } catch {
          // ignore quota / unavailable
        }
      }, 400);
    },
    [],
  );

  // v0.1.4 — file drag and drop. Read text files directly so we can
  // append the body inline; everything else (images, binaries) is
  // surfaced as an attachment chip in the input row.
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const next: ChatAttachment[] = [];
    for (const file of list) {
      const kind = attachmentKind(file);
      const id = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      if (kind === "text") {
        try {
          const body = await file.text();
          next.push({ id, name: file.name, size: file.size, kind, body });
        } catch {
          next.push({ id, name: file.name, size: file.size, kind: "binary" });
        }
      } else if (kind === "image") {
        // v0.1.4 vision input: read image as base64, downscale on the
        // client if it's over 1MB or in a non-vision MIME type, then
        // attach both the dataUrl (for thumbnail rendering) and the
        // parsed image payload (for the chat route).
        try {
          let media_type: ChatImageAttachment["media_type"] = "image/png";
          let dataUrl = "";
          let base64 = "";

          if (isVisionMime(file.type) && file.size <= MAX_IMAGE_BYTES) {
            // Small enough + already a vision type — pass through.
            dataUrl = await readAsDataUrl(file);
            base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
            media_type = file.type;
          } else {
            const resized = await resizeImageToBudget(file);
            if (!resized) {
              setToast(`Couldn't read ${file.name} as an image.`);
              continue;
            }
            media_type = resized.media_type;
            dataUrl = resized.dataUrl;
            base64 = resized.data;
          }

          next.push({
            id,
            name: file.name,
            size: file.size,
            kind: "image",
            dataUrl,
            image: { media_type, data: base64 },
          });
        } catch {
          next.push({ id, name: file.name, size: file.size, kind: "binary" });
        }
      } else {
        next.push({ id, name: file.name, size: file.size, kind });
      }
    }
    setAttachments((current) => [...current, ...next]);
    // v0.1.4 — track every successful attachment in localStorage so the
    // "+" menu's Recent files submenu can re-attach them later.
    let recents = recentFiles;
    for (const att of next) {
      const entry: RecentFile = {
        name: att.name,
        size: att.size,
        kind: att.kind,
        body: att.kind === "text" ? att.body : undefined,
        savedAt: new Date().toISOString(),
      };
      recents = pushRecentFile(entry);
    }
    setRecentFiles(recents);
    const nextContext = inferComposerContext(input, [...attachments, ...next]);
    setLauncherRoot(nextContext.suggestedRoot);
    setHoveredActionId(nextContext.suggestedAction);
    setHoveredRecentFile(null);
    setLauncherOpen(true);
    setToast(
      next.length === 1
        ? `${next[0].name} ready.`
        : `${next.length} files ready for ${nextContext.summaryLabel.toLowerCase()}.`,
    );
  }, [attachments, input, recentFiles]);

  // Re-attach a file the user picked from the Recent files submenu.
  // The text body (if any) was cached in localStorage so re-attaching
  // works offline / without any extra disk IO. Binaries / images get
  // a placeholder chip — same as the original drag-drop path.
  const reattachRecent = useCallback((file: RecentFile) => {
    const id = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const entry: ChatAttachment = {
      id,
      name: file.name,
      size: file.size,
      kind: file.kind,
      body: file.kind === "text" ? file.body : undefined,
    };
    setAttachments((current) => [...current, entry]);
    setRecentFiles(pushRecentFile({ ...file, savedAt: new Date().toISOString() }));
    const nextContext = inferComposerContext(input, [...attachments, entry]);
    setLauncherRoot(nextContext.suggestedRoot);
    setHoveredActionId(nextContext.suggestedAction);
    setHoveredRecentFile(file);
    setLauncherOpen(true);
    setToast(`${file.name} added back to the composer.`);
  }, [attachments, input]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((entry) => entry.id !== id));
  }, []);

  // v0.1.4 — ChatGPT-style "+" menu dispatcher. Each action either
  // fires a side-effect (file picker, browser, toggle) or prefills the
  // input with a directive so the user can refine before sending.

  // v0.1.4 — Pin / fold mutators. Pinning re-sorts via sortThreads;
  // folding hides the thread from the default sidebar view but
  // preserves it in storage.
  const togglePinned = useCallback(
    (threadId: string) => {
      updateThread(threadId, (thread) => ({ ...thread, pinned: !thread.pinned }));
    },
    [updateThread],
  );

  const toggleFolded = useCallback(
    (threadId: string) => {
      updateThread(threadId, (thread) => ({ ...thread, folded: !thread.folded }));
    },
    [updateThread],
  );

  // v0.1.4 — Share thread. POSTs the snapshot to the server and copies
  // the returned URL to the clipboard. Toast confirms the link copied.
  const handleShareThread = useCallback(
    async (thread: DesktopThread) => {
      try {
        const result = await shareThread(session.token, {
          thread_id: thread.id,
          title: thread.title,
          messages: thread.messages,
        });
        try {
          await navigator.clipboard.writeText(result.share_url);
          setToast("Link copied");
        } catch {
          setToast(result.share_url);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not share thread.";
        setChatError(message);
      }
    },
    [session.token],
  );

  // v0.1.4 — Markdown export. Builds a clean transcript and triggers
  // a browser download via an invisible anchor.
  const handleExportThread = useCallback((thread: DesktopThread) => {
    const markdown = buildMarkdownExport(thread);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sansxel-${slugifyTitle(thread.title)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  // AI thread summary: after each completed turn, debounce 1.2s then
  // fire summarizeThread() so the sidebar title + description reflect
  // the WHOLE conversation, not just the user's first message. Skips
  // threads with fewer than 2 messages or while streaming.
  useEffect(() => {
    if (streaming) return;
    if (!activeThread) return;
    if (activeThread.messages.length < 2) return;
    const lastMsg = activeThread.messages[activeThread.messages.length - 1];
    if (!lastMsg || !messageContentText(lastMsg).trim()) return;

    const threadId = activeThread.id;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const { title, description } = await summarizeThread(
            session.token,
            activeThread.messages.map((m) => ({
              role: m.role,
              content: messageContentText(m),
            })),
          );
          if (!title) return;
          updateThread(threadId, (current) => ({
            ...current,
            title,
            preview: description || current.preview,
          }));
          flashTitle(threadId);
        } catch {
          // Silent — next turn will retry naturally
        }
      })();
    }, 1200);
    return () => window.clearTimeout(handle);
    // Deps intentionally use stable signals (id + messages.length) rather than
    // the full activeThread object. summarizeThread → updateThread mutates the
    // thread, so depending on the object would loop the effect every 1.2s.
  }, [streaming, activeThread?.id, activeThread?.messages.length, session.token, updateThread, flashTitle]);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const beginVolumeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let index = 0; index < data.length; index += 1) sum += data[index];
      const level = Math.min(1, sum / data.length / 110);
      setAudioLevel(level);

      const state = voiceStateRef.current;
      const now = Date.now();
      const floor = noiseFloorRef.current;
      const speechCutoff = floor + 0.06;
      const silenceCutoff = floor + 0.025;

      if (level < speechCutoff) {
        const alpha = level < floor ? 0.15 : 0.02;
        noiseFloorRef.current = Math.max(0.005, floor * (1 - alpha) + level * alpha);
      }

      if (state === "recording" && voiceModeRef.current) {
        const elapsed = now - recordingStartedAtRef.current;
        if (level > speechCutoff) {
          heardSpeechRef.current = true;
          silenceStartRef.current = null;
        } else if (elapsed > 400 && heardSpeechRef.current && level < silenceCutoff) {
          if (silenceStartRef.current == null) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current > 800) {
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== "inactive") recorder.stop();
            silenceStartRef.current = null;
          }
        } else {
          silenceStartRef.current = null;
        }
      } else {
        silenceStartRef.current = null;
      }

      if ((state === "speaking" || state === "warming") && voiceModeRef.current) {
        if (level > floor + 0.09) {
          if (speechStartRef.current == null) {
            speechStartRef.current = now;
          } else if (now - speechStartRef.current > 140) {
            speechStartRef.current = null;
            interruptHandlerRef.current?.();
          }
        } else {
          speechStartRef.current = null;
        }
      } else {
        speechStartRef.current = null;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  // v0.1.4 — canvas auto-detect. Scan the latest assistant message for
  // a [canvas:Title]…[/canvas] block and pop the side pane open with
  // it. Keyed by (title + content + length) so we only re-open the pane
  // when a NEW block lands; the user can close it without it springing
  // back on every re-render.
  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!lastAssistant) return;
    const block = extractLatestCanvas(messageContentText(lastAssistant));
    if (!block) return;
    const key = `${block.title}::${block.content.length}::${block.content.slice(0, 64)}`;
    if (lastCanvasKeyRef.current === key) return;
    lastCanvasKeyRef.current = key;
    setCanvasBlock(block);
    setCanvasOpen(true);
  }, [messages]);

  const smoothStream = useSmoothStream({
    charsPerFrame: 8,
    onTick: (visible) => {
      const threadId = streamingThreadIdRef.current;
      if (!threadId) return;
      updateThread(threadId, (thread) => {
        const nextMessages = [...thread.messages];
        const last = nextMessages[nextMessages.length - 1];
        if (last && last.role === "assistant") {
          nextMessages[nextMessages.length - 1] = { ...last, content: visible };
        }
        return {
          ...thread,
          messages: nextMessages,
          preview: buildThreadPreview(nextMessages),
          updatedAt: new Date().toISOString(),
        };
      });
    },
  });

  const playVoiceCue = useCallback(() => {
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const now = ctx.currentTime;
    [540, 700, 860].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.03, now + index * 0.1 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.1 + 0.09);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + index * 0.1);
      oscillator.stop(now + index * 0.1 + 0.11);
    });
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 420);
  }, []);

  const stopVoicePlayback = useCallback(
    (resumeRecording = false) => {
      speechTokenRef.current += 1;
      interruptHandlerRef.current = null;
      if (audioElRef.current) {
        try {
          audioElRef.current.pause();
        } catch {
          // ignore
        }
        audioElRef.current = null;
      }
      setVoiceState("idle");
      if (resumeRecording) {
        void startRecordingRef.current();
      }
    },
    [],
  );

  const startRecording = useCallback(async () => {
    try {
      let stream = micStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        stopAnalyser();
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        beginVolumeLoop();
      }

      const recorder = new MediaRecorder(stream);
      // Snapshot the turn id at start. If the user exits before this
      // recorder finishes, the id will have advanced and we'll bail.
      const turnIdAtStart = voiceTurnIdRef.current;
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        // User exited / cancelled this turn — drop everything, do not
        // transcribe, do not auto-send. This kills the "Esc-while-
        // recording sent a message" bug and the late-arrival bug
        // where a stale transcript pops in mid-typing.
        const cancelled = voiceTurnIdRef.current !== turnIdAtStart;
        if (cancelled) {
          recordedChunksRef.current = [];
          if (!voiceModeRef.current && micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
            micStreamRef.current = null;
            stopAnalyser();
          }
          return;
        }
        if (!voiceModeRef.current && micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((track) => track.stop());
          micStreamRef.current = null;
          stopAnalyser();
        }
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setVoiceState("transcribing");
        try {
          const text = await transcribeAudio(session.token, blob);
          // Cancellation may have happened DURING the network call.
          if (voiceTurnIdRef.current !== turnIdAtStart) {
            setVoiceState("idle");
            return;
          }
          const cleaned = text.trim();
          if (cleaned && !isWhisperHallucination(cleaned)) {
            setVoiceState("idle");
            await sendRef.current(cleaned, true);
          } else {
            // Empty / hallucinated transcript — quietly re-arm the mic
            // so the user stays in a hands-free listening loop instead
            // of stranding at "idle" with nothing to do.
            setVoiceState("idle");
            if (voiceModeRef.current) {
              void startRecordingRef.current();
            }
          }
        } catch (err) {
          setChatError(err instanceof Error ? err.message : "Transcribe failed.");
          setVoiceState("idle");
          if (voiceModeRef.current) {
            void startRecordingRef.current();
          }
        }
      };
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      silenceStartRef.current = null;
      heardSpeechRef.current = false;
      recorder.start();
      setVoiceState("recording");
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Mic access denied.");
      setVoiceState("idle");
    }
  }, [beginVolumeLoop, session.token, stopAnalyser]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const exitVoiceMode = useCallback(() => {
    // Invalidate any in-flight recording / transcription. Their onstop
    // handlers will see the turn id changed and bail without sending.
    voiceTurnIdRef.current += 1;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopVoicePlayback(false);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    stopAnalyser();
    setVoiceState("idle");
    setVoiceMode(false);
  }, [stopAnalyser, stopVoicePlayback]);

  const createFreshThread = useCallback(
    (focus = true) => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
        setStreaming(false);
      }
      const thread = createThread();
      setThreads((current) => [thread, ...current].sort(sortThreads));
      if (focus) setActiveThreadId(thread.id);
      setChatError(null);
      setPlanNotice(null);
      setInput("");
      return thread.id;
    },
    [],
  );

  // v0.1.8 — Tool dispatcher. Each handler returns a string the
  // model gets back as the tool_result content (so it can summarise
  // / continue speaking). The second return value is a short
  // user-facing label rendered on the chip ("opened Usage", etc.)
  // and used as the spoken acknowledgment for voice turns.
  const dispatchTool = useCallback(
    async (
      name: string,
      input: Record<string, unknown>,
    ): Promise<{ result: string; summary: string; speak: string }> => {
      const text = (key: string): string =>
        typeof input[key] === "string" ? (input[key] as string) : "";
      try {
        switch (name) {
          case "navigate": {
            const view = text("view");
            if (!view) throw new Error("missing view");
            onNavigate?.(view);
            return {
              result: `Switched the workspace to the ${view} view.`,
              summary: `navigated to ${view}`,
              speak: `opening ${view}`,
            };
          }
          case "start_new_chat": {
            const id = createFreshThread();
            return {
              result: `Started a new chat thread (id ${id}).`,
              summary: "started new chat",
              speak: "starting a new chat",
            };
          }
          case "search_threads": {
            const q = text("query").toLowerCase();
            const matches = threadsRef.current
              .filter((t) =>
                !q ||
                t.title.toLowerCase().includes(q) ||
                t.preview.toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map((t) => ({ id: t.id, title: t.title, preview: t.preview }));
            return {
              result: JSON.stringify({ matches }),
              summary: `searched threads (${matches.length})`,
              speak: `found ${matches.length} thread${matches.length === 1 ? "" : "s"}`,
            };
          }
          case "open_thread": {
            const id = text("id");
            if (!id) throw new Error("missing id");
            const found = threadsRef.current.find((t) => t.id === id);
            if (!found) throw new Error("thread not found");
            setActiveThreadId(id);
            return {
              result: `Switched to thread "${found.title}".`,
              summary: `opened "${found.title}"`,
              speak: "opening thread",
            };
          }
          case "create_api_key": {
            const keyName = text("name") || "sansxel desktop";
            const created = await createDesktopApiKey(session.token, keyName);
            return {
              result: JSON.stringify({
                id: created.key.id,
                prefix: created.key.key_prefix,
                name: created.key.name,
              }),
              summary: `created key "${created.key.name}"`,
              speak: "creating an API key",
            };
          }
          case "revoke_api_key": {
            const id = text("id");
            if (!id) throw new Error("missing id");
            await revokeDesktopApiKey(session.token, id);
            return {
              result: `Revoked key ${id}.`,
              summary: `revoked key ${id.slice(0, 8)}…`,
              speak: "revoking API key",
            };
          }
          case "list_api_keys": {
            const keys = await listDesktopApiKeys(session.token);
            return {
              result: JSON.stringify({
                keys: keys.map((k) => ({
                  id: k.id,
                  name: k.name,
                  prefix: k.key_prefix,
                })),
              }),
              summary: `listed ${keys.length} key${keys.length === 1 ? "" : "s"}`,
              speak: `you have ${keys.length} API key${keys.length === 1 ? "" : "s"}`,
            };
          }
          case "query_memory": {
            return {
              result: "Memory tool coming v0.1.10.",
              summary: "queried memory (stub)",
              speak: "memory search isn't ready yet",
            };
          }
          case "query_sources": {
            const q = text("query").toLowerCase();
            const sources = await listSources(session.token);
            const scored = sources
              .map((s) => {
                const haystack = `${s.title}\n${s.body}`.toLowerCase();
                const score = q && haystack.includes(q) ? 1 : 0;
                return { score, source: s };
              })
              .filter((entry) => entry.score > 0 || !q)
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
              .map(({ source }) => ({
                id: source.id,
                title: source.title,
                snippet: source.body.slice(0, 240),
              }));
            return {
              result: JSON.stringify({ matches: scored }),
              summary: `searched sources (${scored.length})`,
              speak: `found ${scored.length} source match${scored.length === 1 ? "" : "es"}`,
            };
          }
          case "summarize_thread": {
            const id = text("id");
            const target =
              threadsRef.current.find((t) => t.id === id) ?? null;
            if (!target) throw new Error("thread not found");
            const summary = await summarizeThread(
              session.token,
              target.messages
                .filter((m) => typeof m.content === "string")
                .map((m) => ({
                  role: m.role,
                  content: m.content as string,
                })),
            );
            return {
              result: JSON.stringify(summary),
              summary: `summarised "${target.title}"`,
              speak: "summarising the thread",
            };
          }
          case "change_model_tier": {
            const next = text("tier") as ModelTier;
            if (next !== "fast" && next !== "balanced" && next !== "smart") {
              throw new Error("invalid tier");
            }
            setTier(next);
            await update({ default_tier: next });
            return {
              result: `Model tier set to ${next}.`,
              summary: `model tier → ${next}`,
              speak: `switching to ${next}`,
            };
          }
          case "set_persona": {
            const persona = text("persona") as Persona;
            if (
              persona !== "direct" &&
              persona !== "warm" &&
              persona !== "technical" &&
              persona !== "playful"
            ) {
              throw new Error("invalid persona");
            }
            await update({ persona });
            return {
              result: `Persona set to ${persona}.`,
              summary: `persona → ${persona}`,
              speak: `switching to ${persona} persona`,
            };
          }
          default:
            throw new Error(`unknown tool: ${name}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "tool error";
        throw new Error(message);
      }
    },
    [createFreshThread, onNavigate, session.token, update],
  );

  const send = useCallback(async (overrideText?: string, fromVoice = false) => {
    const baseText = (overrideText ?? input).trim();
    // v0.1.4 — fold any text-file attachments into the outgoing
    // user message so the model sees them as inline context. Image
    // attachments now go through Anthropic vision (passed as base64
    // alongside the text); the chat route promotes them into image
    // content blocks. Other binaries are still noted by name + size.
    const attachmentNotes: string[] = [];
    const visionImages: ChatImageAttachment[] = [];
    for (const att of attachments) {
      if (att.kind === "text" && typeof att.body === "string") {
        attachmentNotes.push(`Attached: ${att.name}\n\n${att.body}`);
      } else if (att.kind === "image" && att.image) {
        visionImages.push(att.image);
      } else {
        attachmentNotes.push(`Attached: ${att.name} (${formatBytes(att.size)})`);
      }
    }
    const text = attachmentNotes.length > 0
      ? [baseText, ...attachmentNotes].filter(Boolean).join("\n\n")
      : baseText;
    // Allow sending an image with no text — gives the user a clean
    // "what is this?" workflow. Bail only if BOTH text and images
    // are empty.
    if (!text && visionImages.length === 0) return;
    lastTurnVoiceRef.current = fromVoice;

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const threadId = activeThreadIdRef.current ?? createFreshThread();
    const thread =
      threadsRef.current.find((entry) => entry.id === threadId) ?? createThread({ id: threadId });
    const userMessage: ChatMessage =
      visionImages.length > 0
        ? { role: "user", content: text, images: visionImages }
        : { role: "user", content: text };
    const nextMessages = [...thread.messages, userMessage];
    const nextTitle = deriveThreadTitle(nextMessages, thread.title);
    const titleChanged = nextTitle !== thread.title;

    updateThread(threadId, (current) => ({
      ...current,
      title: nextTitle,
      messages: [...current.messages, userMessage, { role: "assistant", content: "" }],
      preview: buildThreadPreview([...current.messages, userMessage]),
      updatedAt: new Date().toISOString(),
    }));
    if (titleChanged) flashTitle(threadId);

    setInput("");
    setAttachments([]);
    setLauncherOpen(false);
    setHoveredActionId(null);
    setHoveredRecentFile(null);
    // v0.1.4 — clear the persisted draft for this thread now that the
    // message went out; restoring it after a successful send would
    // resurrect text the user already sent.
    try {
      window.localStorage.removeItem(draftKey(threadId));
    } catch {
      // ignore
    }
    if (draftTimerRef.current !== null) {
      window.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    setStreaming(true);
    setChatError(null);
    // v0.1.8 — chips belong to the *current* assistant turn, so
    // clear the per-thread bucket when a new turn begins.
    setToolExecutions((current) => ({ ...current, [threadId]: [] }));
    streamingThreadIdRef.current = threadId;
    sendStartRef.current = Date.now();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // v0.1.8 — tool-aware streaming loop. The model can emit a
      // mix of text deltas and tool_use blocks; we collect them per
      // turn, dispatch each tool to the local registry, then send a
      // follow-up message containing tool_result blocks so the
      // assistant can finish its turn. Loops until no more tool_use
      // blocks come back (capped at 4 rounds to prevent runaways).
      const toolsEnabled = prefs.tools_enabled !== false;
      let conversation: ChatMessage[] = nextMessages;
      const onMeta = (meta: {
        tier_requested: ModelTier | null;
        tier_resolved: ModelTier | null;
      }) => {
        if (
          meta.tier_requested &&
          meta.tier_resolved &&
          meta.tier_requested !== meta.tier_resolved
        ) {
          setPlanNotice(
            `Your plan doesn't include ${meta.tier_requested} yet, so sansxel replied with ${meta.tier_resolved}.`,
          );
        } else {
          setPlanNotice(null);
        }
      };

      const maxRounds = 4;
      smoothStream.reset();

      for (let round = 0; round < maxRounds; round += 1) {
        void round;
        if (!toolsEnabled) {
          // Legacy plain-text path. Stays bit-for-bit identical to
          // the v0.1.7 behavior.
          for await (const chunk of streamChat(session.token, conversation, {
            tier,
            inputMode: fromVoice ? "voice" : "text",
            persona: prefs.persona,
            agentMode,
            toolsEnabled: false,
            signal: controller.signal,
            onMeta,
          })) {
            smoothStream.push(chunk);
          }
          break;
        }

        // Tools-on path: parse typed chunks and dispatch tool_use.
        const turnBlocks: ChatContentBlock[] = [];
        const turnToolUses: ChatToolUseBlock[] = [];
        let turnText = "";

        for await (const chunk of streamChatWithTools(session.token, conversation, {
          tier,
          inputMode: fromVoice ? "voice" : "text",
          persona: prefs.persona,
          agentMode,
          signal: controller.signal,
          onMeta,
        })) {
          if (chunk.type === "text") {
            smoothStream.push(chunk.text);
            turnText += chunk.text;
          } else if (chunk.type === "tool_use") {
            const toolUse: ChatToolUseBlock = {
              type: "tool_use",
              id: chunk.id,
              name: chunk.name,
              input: chunk.input,
            };
            turnToolUses.push(toolUse);
          }
        }

        if (turnText) turnBlocks.push({ type: "text", text: turnText });
        for (const tu of turnToolUses) turnBlocks.push(tu);

        if (turnToolUses.length === 0) {
          break;
        }

        // Execute every tool_use in the turn and stash a chip for
        // each so the user sees what ran. If voice-driven, speak a
        // short ack before kicking off heavy tools.
        const toolResults: ChatToolResultBlock[] = [];
        for (const toolUse of turnToolUses) {
          const exec: ToolExecution = {
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
            status: "running",
            summary: `running ${toolUse.name}…`,
          };
          setToolExecutions((current) => ({
            ...current,
            [threadId]: [...(current[threadId] ?? []), exec],
          }));

          // Voice ack — speak a short cue so the user knows we're
          // about to run an action. Best-effort, never blocks the
          // tool dispatch itself.
          if (fromVoice) {
            try {
              const ackText = `${toolUse.name.replace(/_/g, " ")}…`;
              const blob = await fetchSpeech(session.token, ackText, prefs.voice);
              const ackUrl = URL.createObjectURL(blob);
              const ackAudio = new Audio(ackUrl);
              await ackAudio.play().catch(() => {});
              ackAudio.onended = () => URL.revokeObjectURL(ackUrl);
            } catch {
              // ignore — voice ack is a nicety
            }
          }

          try {
            const dispatched = await dispatchTool(toolUse.name, toolUse.input);
            exec.status = "ok";
            exec.summary = dispatched.summary;
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: dispatched.result,
            });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "tool failed";
            exec.status = "error";
            exec.summary = `failed: ${message}`;
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: message,
              is_error: true,
            });
          }
          // Re-render with the updated status.
          setToolExecutions((current) => ({
            ...current,
            [threadId]: (current[threadId] ?? []).map((e) =>
              e.id === exec.id ? { ...exec } : e,
            ),
          }));
        }

        // Append the assistant turn (with text + tool_use) and the
        // user turn carrying tool_results, then loop for the model
        // to continue.
        conversation = [
          ...conversation,
          { role: "assistant", content: turnBlocks },
          { role: "user", content: toolResults },
        ];
      }

      smoothStream.end();
      const assistant = await smoothStream.drained();
      streamingThreadIdRef.current = null;

      updateThread(threadId, (current) => ({
        ...current,
        preview: buildThreadPreview(current.messages),
        updatedAt: new Date().toISOString(),
      }));

      // v0.1.4 — system notification when a long completion finishes
      // and the user has tabbed away. Wrapped in try/catch since the
      // Notification API can be missing or permission-blocked.
      try {
        const elapsed = Date.now() - sendStartRef.current;
        if (
          elapsed > 4000 &&
          assistant.trim() &&
          typeof document !== "undefined" &&
          !document.hasFocus() &&
          typeof Notification !== "undefined"
        ) {
          const fire = () => {
            try {
              new Notification("sansxel-1 finished", {
                body: "Your reply is ready",
                icon: "/icon.png",
              });
            } catch {
              // ignore
            }
          };
          if (Notification.permission === "granted") {
            fire();
          } else if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            if (permission === "granted") fire();
          }
        }
      } catch {
        // ignore — notifications are a nicety, never block the chat flow
      }

      const shouldSpeak =
        Boolean(assistant.trim()) &&
        (lastTurnVoiceRef.current || prefs.auto_speak_replies);

      if (shouldSpeak) {
        lastTurnVoiceRef.current = false;
        const speechToken = speechTokenRef.current + 1;
        speechTokenRef.current = speechToken;
        setVoiceState("warming");
        const cueTimer = window.setTimeout(() => {
          if (speechTokenRef.current === speechToken) {
            playVoiceCue();
          }
        }, 320);

        try {
          const blob = await fetchSpeech(session.token, assistant, prefs.voice);
          window.clearTimeout(cueTimer);
          if (speechTokenRef.current !== speechToken) return;

          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioElRef.current = audio;
          setVoiceState("speaking");

          interruptHandlerRef.current = () => {
            try {
              audio.pause();
            } catch {
              // ignore
            }
            URL.revokeObjectURL(url);
            if (audioElRef.current === audio) audioElRef.current = null;
            interruptHandlerRef.current = null;
            setVoiceState("idle");
            void startRecordingRef.current();
          };

          const cleanup = () => {
            URL.revokeObjectURL(url);
            interruptHandlerRef.current = null;
            if (audioElRef.current === audio) {
              audioElRef.current = null;
              setVoiceState("idle");
              if (prefs.conversational || voiceModeRef.current) {
                void startRecordingRef.current();
              }
            }
          };

          audio.onended = cleanup;
          audio.onerror = cleanup;
          await audio.play();
        } catch {
          setVoiceState("idle");
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        return;
      }
      setChatError(err instanceof Error ? err.message : "Chat failed.");
      updateThread(threadId, (current) => {
        const last = current.messages[current.messages.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          const trimmed = current.messages.slice(0, -1);
          return {
            ...current,
            messages: trimmed,
            preview: buildThreadPreview(trimmed),
            updatedAt: new Date().toISOString(),
          };
        }
        return current;
      });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }, [
    agentMode,
    attachments,
    createFreshThread,
    dispatchTool,
    flashTitle,
    input,
    playVoiceCue,
    prefs.auto_speak_replies,
    prefs.conversational,
    prefs.persona,
    prefs.tools_enabled,
    prefs.voice,
    session.token,
    smoothStream,
    tier,
    updateThread,
  ]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
    streamingThreadIdRef.current = null;
  }, []);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const enterVoiceMode = useCallback(async () => {
    setVoiceMode(true);
    await startRecording();
  }, [startRecording]);

  // One-shot image generation. Reads the current input as the prompt,
  // appends both a user turn and an assistant turn (with the image as
  // markdown so react-markdown renders it inline), and clears the input.
  // Errors surface in the chat error banner; loading state disables
  // the button so the user can't fire repeated requests.
  const generateImageFromInput = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || generatingImage) return;

    const threadId = activeThreadIdRef.current ?? createFreshThread();
    const thread =
      threadsRef.current.find((entry) => entry.id === threadId) ??
      createThread({ id: threadId });

    const userMessage: ChatMessage = { role: "user", content: prompt };
    const placeholder: ChatMessage = {
      role: "assistant",
      content: "Generating image...",
    };
    const nextMessages = [...thread.messages, userMessage];
    const nextTitle = deriveThreadTitle(nextMessages, thread.title);
    const titleChanged = nextTitle !== thread.title;

    updateThread(threadId, (current) => ({
      ...current,
      title: nextTitle,
      messages: [...current.messages, userMessage, placeholder],
      preview: buildThreadPreview([...current.messages, userMessage]),
      updatedAt: new Date().toISOString(),
    }));
    if (titleChanged) flashTitle(threadId);

    setInput("");
    setLauncherOpen(false);
    setHoveredActionId(null);
    setHoveredRecentFile(null);
    setGeneratingImage(true);
    setChatError(null);

    try {
      const { url, revised_prompt } = await generateImage(session.token, prompt);
      const caption = revised_prompt
        ? `*${revised_prompt}*\n\n![generated image](${url})`
        : `![generated image](${url})`;
      updateThread(threadId, (current) => {
        const messages = [...current.messages];
        const last = messages[messages.length - 1];
        if (last && last.role === "assistant") {
          messages[messages.length - 1] = { ...last, content: caption };
        }
        return {
          ...current,
          messages,
          preview: buildThreadPreview(messages),
          updatedAt: new Date().toISOString(),
        };
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Image generation failed.";
      setChatError(message);
      // Roll the placeholder back so we don't leave a "Generating..."
      // bubble stuck in the thread.
      updateThread(threadId, (current) => {
        const messages = [...current.messages];
        const last = messages[messages.length - 1];
        if (last && last.role === "assistant" && last.content === "Generating image...") {
          messages.pop();
        }
        return {
          ...current,
          messages,
          preview: buildThreadPreview(messages),
          updatedAt: new Date().toISOString(),
        };
      });
    } finally {
      setGeneratingImage(false);
    }
  }, [
    createFreshThread,
    flashTitle,
    generatingImage,
    input,
    session.token,
    updateThread,
  ]);

  // v0.1.13 \u2014 toggleCopilot kept as a no-op stub so the existing
  // ref/dep wiring doesn't have to be ripped out. Toolbar mode is gone
  // \u2014 the actual button that called this was removed from the chat
  // header. The body still forces normal window mode if the prefs got
  // stuck in toolbar from a prior version.
  const toggleCopilot = useCallback(async () => {
    const nextMode = "normal" as const;
    await update({ window_mode: nextMode });
    try {
      await invoke("set_window_mode", { mode: nextMode });
    } catch {
      // saved even if the native call fails in development
    }
  }, [update]);

  const focusComposer = useCallback(() => {
    window.setTimeout(() => {
      composerInputRef.current?.focus();
      const length = composerInputRef.current?.value.length ?? 0;
      composerInputRef.current?.setSelectionRange(length, length);
    }, 0);
  }, []);

  // v0.1.13 \u2014 type-anywhere-to-focus: when the user is on the chat
  // surface and presses "/" or any printable character, focus the
  // composer so they don't have to click it first. Skip when an input
  // / textarea / contentEditable is already focused (so typing inside
  // the search bar / addon modals / etc. isn't hijacked). Modifier
  // key presses (Ctrl/Cmd/Alt + X) skip too \u2014 those are shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      // The "/" hotkey is the explicit focus shortcut; we also accept
      // any single printable character so just typing focuses the
      // composer (the keystroke falls through and lands in the input).
      const isSlash = event.key === "/";
      const isPrintable = event.key.length === 1;
      if (!isSlash && !isPrintable) return;
      if (composerInputRef.current && document.activeElement !== composerInputRef.current) {
        // For "/" we swallow the keystroke; for printable chars we
        // let it through so the typed letter actually appears.
        if (isSlash) event.preventDefault();
        composerInputRef.current.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openLauncher = useCallback(
    (
      root: LauncherRootId = composerContext.suggestedRoot,
      actionId: LauncherActionId | null = composerContext.suggestedAction,
    ) => {
      setLauncherRoot(root);
      setHoveredActionId(actionId);
      setHoveredRecentFile(null);
      setLauncherOpen(true);
    },
    [composerContext],
  );

  const seedComposerPrompt = useCallback(
    (nextPrompt: string) => {
      handleInputChange(nextPrompt);
      setLauncherOpen(false);
      setHoveredActionId(null);
      setHoveredRecentFile(null);
      focusComposer();
    },
    [focusComposer, handleInputChange],
  );

  const handlePrimaryRootAction = useCallback(
    async (root: "image" | "research" | "search") => {
      if (root === "image") {
        if (!input.trim()) {
          seedComposerPrompt("Create an image of: ");
          return;
        }
        await generateImageFromInput();
        setLauncherOpen(false);
        return;
      }

      const rootMeta = ROOT_META[root];
      if (!planAllows(planForGating, rootMeta.requiredPlan)) {
        const unlock = planBadge(rootMeta.requiredPlan) ?? "a paid plan";
        setPlanNotice(`${rootMeta.label} unlocks on ${unlock}. Upgrade inside the desktop app to use it.`);
        onOpenPlan();
        return;
      }

      const hasContext = composerContext.hasInput || composerContext.hasAttachments;
      if (!hasContext) {
        seedComposerPrompt(root === "research" ? "Research this deeply: " : "Search the web for: ");
        return;
      }

      const prompt =
        root === "research"
          ? `Research this deeply. Compare angles, surface what matters most, and end with the strongest recommendation:\n\n${input.trim() || attachmentPromptHint(attachments)}`
          : `Ground this with web search and current sources before answering. Keep it concise but source-aware:\n\n${input.trim() || attachmentPromptHint(attachments)}`;
      await send(prompt);
    },
    [
      attachments,
      composerContext.hasAttachments,
      composerContext.hasInput,
      generateImageFromInput,
      input,
      onOpenPlan,
      planForGating,
      seedComposerPrompt,
      send,
    ],
  );

  const runLauncherAction = useCallback(
    async (
      actionId: LauncherActionId,
      immediate = composerContext.hasInput || composerContext.hasAttachments,
    ) => {
      const meta = ACTION_META[actionId];
      if (!planAllows(planForGating, meta.requiredPlan)) {
        const unlock = planBadge(meta.requiredPlan) ?? "a higher plan";
        setPlanNotice(`${meta.label} unlocks on ${unlock}. Upgrade inside the desktop app to use it.`);
        onOpenPlan();
        return;
      }

      if (meta.comingSoon) {
        setPlanNotice(`${meta.label} is visible now so users can discover it early, but it's not live in this launcher yet.`);
        return;
      }

      if (actionId === "files") {
        setLauncherRoot("files");
        setHoveredActionId(null);
        return;
      }

      if (actionId === "agent-mode") {
        if (!agentMode) {
          setAgentMode(true);
          setToast("Agent mode is on.");
        } else if (!immediate) {
          setAgentMode(false);
          setToast("Agent mode is off.");
          setLauncherOpen(false);
          return;
        }
      }

      if (actionId === "deep-think" && tier !== "smart") {
        setTier("smart");
      }

      if (actionId === "auto-mode" && tier !== "balanced") {
        setTier("balanced");
      }

      if (actionId === "canvas") {
        setCanvasOpen(true);
      }

      if (
        actionId === "add-sources" &&
        !composerContext.hasAttachments &&
        !composerContext.hasUrls &&
        !composerContext.hasInput &&
        onOpenSources
      ) {
        setLauncherOpen(false);
        onOpenSources();
        return;
      }

      if (!immediate) {
        seedComposerPrompt(buildActionPrompt(actionId, composerContext, input, attachments));
        return;
      }

      await send(buildActionPrompt(actionId, composerContext, input, attachments));
    },
    [
      agentMode,
      attachments,
      composerContext,
      input,
      onOpenPlan,
      onOpenSources,
      planForGating,
      seedComposerPrompt,
      send,
      tier,
    ],
  );

  // Reset copilot mode on every launch — sansxel always opens in
  // normal chat mode, never sticky-stuck in toolbar mode from a
  // prior session. Runs once after preferences load.
  const copilotResetRef = useRef(false);
  useEffect(() => {
    if (copilotResetRef.current) return;
    if (prefs.window_mode === "normal") {
      copilotResetRef.current = true;
      return;
    }
    copilotResetRef.current = true;
    void update({ window_mode: "normal" });
    void invoke("set_window_mode", { mode: "normal" }).catch(() => {});
  }, [prefs.window_mode, update]);

  const showEmpty = messages.length === 0;

  return (
    <div
      className={`chat-shell chat-shell--model-${tier}${isCopilot ? " chat-shell--copilot" : ""}${dragOver ? " chat-shell--drag" : ""}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragOver(true);
          setLauncherOpen(true);
          setLauncherRoot("files");
          setHoveredActionId(null);
          setHoveredRecentFile(null);
        }
      }}
      onDragLeave={(event) => {
        // Only clear when the drag actually leaves the shell, not when
        // it crosses internal child boundaries.
        if (event.currentTarget === event.target) {
          setDragOver(false);
        }
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length > 0) {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }
        setDragOver(false);
      }}
    >
      {voiceMode && (
        <VoiceOverlay
          state={voiceState}
          level={audioLevel}
          onExit={exitVoiceMode}
        />
      )}
      {toast && <div className="chat-toast" role="status">{toast}</div>}

      <aside className="chat-history">
        <div className="chat-history-head">
          <div>
            <div className="chat-history-kicker">Desktop history</div>
            <div className="chat-history-sub">
              {threads.length} saved {threads.length === 1 ? "thread" : "threads"}
            </div>
          </div>
          <button
            type="button"
            className="chat-history-new"
            onClick={() => createFreshThread(true)}
          >
            New
          </button>
        </div>

        <ThreadSearch
          ref={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
        />

        <div className="chat-history-list">
          {filteredThreads.map((thread) => (
            <div
              key={thread.id}
              role="button"
              tabIndex={0}
              className={`chat-history-item${thread.id === activeThreadId ? " active" : ""}${titleFlashId === thread.id ? " is-updating" : ""}${thread.pinned ? " pinned" : ""}${thread.folded ? " folded" : ""}`}
              onClick={() => setActiveThreadId(thread.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveThreadId(thread.id);
                }
              }}
            >
              <div className="chat-history-item-title">
                {thread.pinned && <span className="chat-history-pin-tag" aria-hidden>📌</span>}
                {thread.title}
              </div>
              <div className="chat-history-item-preview">{thread.preview}</div>
              <div className="chat-history-item-time">
                {formatThreadTime(thread.updatedAt)}
              </div>
              <div className="chat-history-item-actions" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="chat-history-action"
                  title={thread.pinned ? "Unpin" : "Pin"}
                  aria-label={thread.pinned ? "Unpin thread" : "Pin thread"}
                  onClick={() => togglePinned(thread.id)}
                >
                  📌
                </button>
                <button
                  type="button"
                  className="chat-history-action"
                  title="Share"
                  aria-label="Share thread"
                  onClick={() => void handleShareThread(thread)}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="chat-history-action"
                  title={thread.folded ? "Unfold" : "Fold"}
                  aria-label={thread.folded ? "Unfold thread" : "Fold thread"}
                  onClick={() => toggleFolded(thread.id)}
                >
                  {thread.folded ? "Unfold" : "Fold"}
                </button>
              </div>
            </div>
          ))}
          {filteredThreads.length === 0 && searchQuery && (
            <div className="chat-history-empty">
              No threads match “{searchQuery}”.
            </div>
          )}
        </div>

        <div className="chat-history-foot">
          {foldedCount > 0 && (
            <button
              type="button"
              className="chat-history-foot-toggle"
              onClick={() => setShowFolded((value) => !value)}
            >
              {showFolded ? `Hide folded (${foldedCount})` : `Show folded (${foldedCount})`}
            </button>
          )}
          <div className="chat-history-foot-copy">
            Topics rename themselves when the conversation genuinely shifts.
          </div>
        </div>
      </aside>

      <div className="chat">
        <div className="chat-topbar">
          <div className="chat-title-wrap">
            <div className="chat-title-kicker">
              {isCopilot ? "Toolbar mode" : "Current thread"}
            </div>
            <div className={`chat-title${titleFlashId === activeThreadId ? " is-updating" : ""}`}>
              {activeThread?.title ?? "New chat"}
            </div>
            <div className="chat-title-sub">
              {showEmpty
                ? emptyState.topbarCopy
                : `${messages.filter((message) => message.role === "user").length} prompts in this thread`}
            </div>
          </div>

          <div className="chat-topbar-actions">
            {agentMode && (
              <span className="chat-agent-pill" title="Agent mode is on">
                <span className="chat-agent-pill-dot" />
                Agent ON
              </span>
            )}
            {/* v0.1.13 \u2014 Removed Export and Toolbar mode buttons.
                Export had no obvious affordance (just dumps a .md file)
                and Toolbar mode broke the layout at non-full scale plus
                offered no value over the floating Sansxel Copilot. */}
            <ModelPicker tier={tier} onChange={setTier} allowedTiers={allowedTiers} />
          </div>
        </div>

        {planNotice && (
          <div className="chat-plan-notice">
            {planNotice}
            <button
              type="button"
              className="chat-plan-notice-x"
              onClick={() => setPlanNotice(null)}
              aria-label="Dismiss"
            >
              x
            </button>
          </div>
        )}

        <div className="chat-scroll" ref={scrollRef}>
          {showEmpty ? (
            <div className="chat-empty">
              <div className="chat-empty-stage">
                <div className="chat-empty-mark">{activeModel.display_name}</div>
                <h2>{isCopilot ? emptyState.copilotTitle : emptyState.title}</h2>
                <p>
                  {isCopilot ? emptyState.copilotDescription : emptyState.description}
                </p>
                <div className="chat-empty-capabilities">
                  {emptyState.capabilities.map((capability) => (
                    <span key={capability} className="chat-empty-chip">
                      {capability}
                    </span>
                  ))}
                </div>
              </div>

              <div className="chat-empty-actions">
                {emptyState.starters.map((starter) => (
                  <button
                    key={starter.label}
                    type="button"
                    className="chat-empty-action"
                    onClick={() => void send(starter.prompt)}
                  >
                    <span className="chat-empty-action-label">{starter.label}</span>
                    <span className="chat-empty-action-copy">{starter.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-list">
              {messages.map((message, index) => {
                const isLast = index === messages.length - 1;
                const isInflight =
                  isLast &&
                  message.role === "assistant" &&
                  streaming &&
                  message.content === "";
                const isStillStreaming =
                  isLast &&
                  message.role === "assistant" &&
                  streaming &&
                  message.content !== "";
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat-msg chat-msg--${message.role}`}
                  >
                    {isInflight ? (
                      <BounceDots />
                    ) : message.role === "assistant" ? (
                      <AssistantBubble
                        content={
                          typeof message.content === "string"
                            ? message.content
                            : ""
                        }
                        streaming={isStillStreaming}
                        activeArtifactId={activeArtifact?.id ?? null}
                        // v0.1.8 — show one chip per tool execution
                        // attached to the active assistant turn.
                        toolExecutions={
                          isLast && activeThreadId
                            ? toolExecutions[activeThreadId] ?? []
                            : []
                        }
                        onRunArtifact={(artifact) => {
                          // Only one side panel at a time — close the
                          // canvas if it was open so the right column
                          // doesn't stack two panels on top of each
                          // other.
                          setCanvasOpen(false);
                          setActiveArtifact(artifact);
                        }}
                      />
                    ) : (
                      <>
                        {/* v0.1.4 vision: thumbnails for any images
                            attached to this user turn. Render BEFORE
                            the text so the image acts as visual
                            context for the question. */}
                        {Array.isArray(message.images) && message.images.length > 0 && (
                          <div className="chat-msg-images">
                            {message.images.map((img, imgIdx) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={imgIdx}
                                className="chat-msg-image"
                                alt="attachment"
                                src={`data:${img.media_type};base64,${img.data}`}
                              />
                            ))}
                          </div>
                        )}
                        {message.content}
                      </>
                    )}
                  </div>
                );
              })}
              {chatError && <div className="chat-error">{chatError}</div>}
            </div>
          )}
        </div>

        <form
          className="chat-input"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <input
            ref={filePickerRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(event) => {
              const files = event.target.files;
              if (files && files.length > 0) {
                void handleFiles(files);
              }
              event.target.value = "";
            }}
          />

          {attachments.length > 0 && (
            <div className="chat-attachments">
              {attachments.map((att) => (
                <div key={att.id} className={`chat-attachment chat-attachment--${att.kind}`}>
                  <span className="chat-attachment-name">{att.name}</span>
                  <span className="chat-attachment-meta">
                    {att.kind === "text" ? "text" : att.kind === "image" ? "image" : "file"} · {formatBytes(att.size)}
                  </span>
                  <button
                    type="button"
                    className="chat-attachment-remove"
                    onClick={() => removeAttachment(att.id)}
                    aria-label={`Remove ${att.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="chat-input-frame">
            <textarea
              ref={composerInputRef}
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={(event) => {
                const enterSends = prefs.send_on_enter;
                const isEnter = event.key === "Enter" && !event.shiftKey;
                const isCmdEnter = event.key === "Enter" && (event.ctrlKey || event.metaKey);
                if ((enterSends && isEnter) || (!enterSends && isCmdEnter)) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={
                voiceState === "recording"
                  ? "Listening..."
                  : voiceState === "transcribing"
                    ? "Transcribing..."
                    : voiceState === "warming"
                      ? "Preparing voice..."
                      : voiceState === "speaking"
                        ? "Speaking..."
                        : prefs.send_on_enter
                          ? emptyState.inputPlaceholder
                          : `${emptyState.inputPlaceholder} (Ctrl+Enter to send)`
              }
              rows={1}
              disabled={voiceState === "recording" || voiceState === "transcribing"}
            />

            <div className="chat-input-footer">
              <div className="chat-launcher" ref={launcherRef}>
                <button
                  type="button"
                  className={`chat-launcher-trigger${launcherOpen ? " is-open" : ""}`}
                  onClick={() => {
                    if (launcherOpen) {
                      setLauncherOpen(false);
                      return;
                    }
                    openLauncher();
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={launcherOpen}
                >
                  <span className="chat-launcher-trigger-label">Actions</span>
                  <span className="chat-launcher-trigger-copy">{composerContext.summaryLabel}</span>
                </button>

                {launcherOpen && (
                  <SmartActionLauncher
                    root={launcherRoot}
                    context={composerContext}
                    plan={planForGating}
                    recentFiles={recentFiles}
                    agentMode={agentMode}
                    canvasOpen={canvasOpen}
                    tier={tier}
                    hoveredActionId={hoveredActionId}
                    hoveredRecentFile={hoveredRecentFile}
                    preview={launcherPreview}
                    onRootChange={(root) => {
                      setLauncherRoot(root);
                      setHoveredRecentFile(null);
                      setHoveredActionId(root === "actions" ? composerContext.suggestedAction : null);
                    }}
                    onHoverAction={setHoveredActionId}
                    onHoverRecent={setHoveredRecentFile}
                    onBrowseFiles={() => {
                      filePickerRef.current?.click();
                    }}
                    onPrimaryRootAction={(root) => {
                      void handlePrimaryRootAction(root);
                    }}
                    onRunAction={(actionId) => {
                      void runLauncherAction(actionId);
                    }}
                    onPickRecent={reattachRecent}
                  />
                )}
              </div>

              <div className="chat-input-actions">
                {planForGating === "free" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanNotice("Voice unlocks on paid plans. Open Plan to upgrade inside the desktop app.");
                      onOpenPlan();
                    }}
                    className="chat-icon-btn chat-icon-btn--locked"
                    title="Voice unlocks on paid plans"
                  >
                    <MicIcon />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void enterVoiceMode()}
                    disabled={voiceState !== "idle"}
                    className="chat-icon-btn"
                    title="Talk to sansxel-1"
                  >
                    <MicIcon />
                  </button>
                )}

                {streaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="chat-send chat-send--stop"
                    title="Stop"
                  >
                    <StopIcon />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() && attachments.length === 0}
                    className="chat-send"
                    title="Send"
                  >
                    <SendIcon />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {canvasOpen && canvasBlock && (
        <DesktopCanvas
          block={canvasBlock}
          onClose={() => setCanvasOpen(false)}
          onSaveBack={(updated) => {
            // Append a new user turn echoing the latest canvas. The
            // canvas STAYS open per the spec — re-emitted blocks just
            // swap the contents in-place via the auto-detect effect.
            void send(`Updated canvas:\n\n${updated}`);
          }}
        />
      )}

      {activeArtifact && !canvasOpen && (
        <CodePreview
          artifact={activeArtifact}
          onClose={() => setActiveArtifact(null)}
        />
      )}
    </div>
  );
}

// Whisper systematically hallucinates these short phrases on silence
// or near-silence. We drop them so the user doesn't get a phantom
// "you" message every time they exit voice mode without speaking.
const WHISPER_HALLUCINATIONS = new Set([
  "you",
  "you.",
  "thank you",
  "thank you.",
  "thanks",
  "thanks.",
  "thanks for watching",
  "thanks for watching.",
  "thanks for watching!",
  "thanks for watching the video",
  "thanks for watching the video.",
  "bye",
  "bye.",
  "okay",
  "okay.",
  "ok",
  ".",
  ",",
  "...",
  "uh",
  "um",
  "hmm",
]);

function isWhisperHallucination(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return true;
  if (WHISPER_HALLUCINATIONS.has(normalized)) return true;
  // Single-character noise (a stray letter, period, etc.)
  if (normalized.length <= 2) return true;
  return false;
}

function VoiceOverlay({
  state,
  level,
  onExit,
}: {
  state: VoiceState;
  level: number;
  onExit: () => void;
}) {
  const status =
    state === "recording"
      ? "Listening"
      : state === "transcribing"
        ? "Thinking"
        : state === "warming"
          ? "Preparing voice"
          : state === "speaking"
            ? "Speaking"
            : "Listening";

  const scale = 1 + Math.min(level * 0.55, 0.55);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  return (
    <div className="voice-overlay">
      <div className="voice-overlay-stage">
        <div
          className={`voice-orb voice-orb--${state}`}
          style={{ transform: `scale(${scale})` }}
          role="img"
          aria-label={status}
        >
          <span className="voice-orb-inner" />
          <span className="voice-orb-ring" />
          <span className="voice-orb-ring voice-orb-ring--lg" />
        </div>

        <div className="voice-overlay-status">
          <span className={`voice-overlay-dot voice-overlay-dot--${state}`} />
          {status}
        </div>

        <div className="voice-overlay-hint">
          Hands-free — just talk. Press <kbd>Esc</kbd> to leave.
        </div>
      </div>
    </div>
  );
}

function QuickActionRow({
  actions,
  suggestedAction,
  activeActionId,
  plan,
  onHover,
  onAction,
}: {
  actions: QuickActionMeta[];
  suggestedAction: LauncherActionId;
  activeActionId: LauncherActionId | null;
  plan: string;
  onHover: (actionId: LauncherActionId | null) => void;
  onAction: (actionId: LauncherActionId) => void;
}) {
  return (
    <div className="chat-quick-actions">
      {actions.map((action) => {
        const meta = ACTION_META[action.id];
        const locked = !planAllows(plan, meta.requiredPlan);
        return (
          <button
            key={action.id}
            type="button"
            className={`chat-quick-action${suggestedAction === action.id ? " is-suggested" : ""}${activeActionId === action.id ? " is-active" : ""}${locked ? " is-locked" : ""}`}
            onMouseEnter={() => onHover(action.id)}
            onFocus={() => onHover(action.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onAction(action.id)}
            title={locked ? `${action.hint} Unlocks on ${planBadge(meta.requiredPlan)}.` : action.hint}
          >
            <span className="chat-quick-action-label">{action.label}</span>
            <span className="chat-quick-action-hint">{action.hint}</span>
            {locked && (
              <span className="chat-quick-action-badge">{planBadge(meta.requiredPlan)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SmartActionLauncher({
  root,
  context,
  plan,
  recentFiles,
  agentMode,
  canvasOpen,
  tier,
  hoveredActionId,
  hoveredRecentFile,
  preview,
  onRootChange,
  onHoverAction,
  onHoverRecent,
  onBrowseFiles,
  onPrimaryRootAction,
  onRunAction,
  onPickRecent,
}: {
  root: LauncherRootId;
  context: ComposerContext;
  plan: string;
  recentFiles: RecentFile[];
  agentMode: boolean;
  canvasOpen: boolean;
  tier: ModelTier;
  hoveredActionId: LauncherActionId | null;
  hoveredRecentFile: RecentFile | null;
  preview: LauncherPreviewCard;
  onRootChange: (root: LauncherRootId) => void;
  onHoverAction: (actionId: LauncherActionId | null) => void;
  onHoverRecent: (file: RecentFile | null) => void;
  onBrowseFiles: () => void;
  onPrimaryRootAction: (root: "image" | "research" | "search") => void;
  onRunAction: (actionId: LauncherActionId) => void;
  onPickRecent: (file: RecentFile) => void;
}) {
  const renderActionCard = (actionId: LauncherActionId) => {
    const meta = ACTION_META[actionId];
    const locked = !planAllows(plan, meta.requiredPlan);
    const active =
      (actionId === "agent-mode" && agentMode) ||
      (actionId === "canvas" && canvasOpen) ||
      (actionId === "deep-think" && tier === "smart") ||
      (actionId === "auto-mode" && tier === "balanced");
    const suggested = context.suggestedAction === actionId;
    const badge = meta.comingSoon
      ? "Soon"
      : locked
        ? planBadge(meta.requiredPlan)
        : active
          ? "On"
          : suggested
            ? "Suggested"
            : null;
    return (
      <button
        key={actionId}
        type="button"
        className={`chat-launcher-action${locked ? " is-locked" : ""}${active ? " is-active" : ""}${suggested ? " is-suggested" : ""}${hoveredActionId === actionId ? " is-hovered" : ""}`}
        onMouseEnter={() => {
          onHoverRecent(null);
          onHoverAction(actionId);
        }}
        onFocus={() => {
          onHoverRecent(null);
          onHoverAction(actionId);
        }}
        onMouseLeave={() => onHoverAction(null)}
        onClick={() => onRunAction(actionId)}
      >
        <div className="chat-launcher-action-head">
          <span className="chat-launcher-action-name">{meta.label}</span>
          {badge && <span className="chat-launcher-action-badge">{badge}</span>}
        </div>
        <div className="chat-launcher-action-copy">{meta.description}</div>
      </button>
    );
  };

  return (
    <div className="chat-launcher-panel" role="dialog" aria-label="Smart actions">
      <div className="chat-launcher-roots">
        {ROOT_MENU_ORDER.map((rootId) => {
          const meta = ROOT_META[rootId];
          const selected = rootId === root;
          const locked = !planAllows(plan, meta.requiredPlan);
          return (
            <button
              key={rootId}
              type="button"
              className={`chat-launcher-root${selected ? " is-selected" : ""}${context.suggestedRoot === rootId ? " is-suggested" : ""}${locked ? " is-locked" : ""}`}
              onMouseEnter={() => {
                onHoverRecent(null);
                onHoverAction(rootId === "actions" ? context.suggestedAction : null);
                onRootChange(rootId);
              }}
              onFocus={() => {
                onHoverRecent(null);
                onHoverAction(rootId === "actions" ? context.suggestedAction : null);
                onRootChange(rootId);
              }}
              onClick={() => {
                onHoverRecent(null);
                onHoverAction(rootId === "actions" ? context.suggestedAction : null);
                onRootChange(rootId);
              }}
            >
              <span className="chat-launcher-root-label">{meta.label}</span>
              <span className="chat-launcher-root-copy">{meta.eyebrow}</span>
              {locked && <span className="chat-launcher-root-badge">{planBadge(meta.requiredPlan)}</span>}
            </button>
          );
        })}
      </div>

      <div className="chat-launcher-pane">
        {root === "files" && (
          <div className="chat-launcher-pane-stack">
            <button
              type="button"
              className="chat-launcher-primary"
              onClick={onBrowseFiles}
            >
              <span className="chat-launcher-primary-title">Browse files</span>
              <span className="chat-launcher-primary-copy">
                Pick screenshots, docs, code, or notes and drop them straight into the composer.
              </span>
            </button>
            {context.hasAttachments && renderActionCard("scan-files")}
            {context.hasAttachments && renderActionCard("analyze")}
          </div>
        )}

        {root === "recent" && (
          <div className="chat-launcher-pane-stack">
            {recentFiles.length === 0 ? (
              <div className="chat-launcher-empty">
                Files you attach here will show up as one-click recents.
              </div>
            ) : (
              recentFiles.map((file) => (
                <button
                  key={`${file.name}-${file.savedAt}`}
                  type="button"
                  className={`chat-launcher-recent${hoveredRecentFile?.savedAt === file.savedAt ? " is-hovered" : ""}`}
                  onMouseEnter={() => {
                    onHoverAction(null);
                    onHoverRecent(file);
                  }}
                  onFocus={() => {
                    onHoverAction(null);
                    onHoverRecent(file);
                  }}
                  onMouseLeave={() => onHoverRecent(null)}
                  onClick={() => onPickRecent(file)}
                >
                  <span className="chat-launcher-recent-name">{file.name}</span>
                  <span className="chat-launcher-recent-meta">
                    {formatBytes(file.size)} | {formatRelative(file.savedAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {root === "image" && (
          <div className="chat-launcher-pane-stack">
            <button
              type="button"
              className="chat-launcher-primary"
              onClick={() => onPrimaryRootAction("image")}
            >
              <span className="chat-launcher-primary-title">Create image</span>
              <span className="chat-launcher-primary-copy">
                Turn the current draft into an image prompt or seed the composer with a visual brief.
              </span>
            </button>
            {renderActionCard("generate-ui")}
            {renderActionCard("canvas")}
          </div>
        )}

        {root === "research" && (
          <div className="chat-launcher-pane-stack">
            <button
              type="button"
              className={`chat-launcher-primary${!planAllows(plan, ROOT_META.research.requiredPlan) ? " is-locked" : ""}`}
              onClick={() => onPrimaryRootAction("research")}
            >
              <span className="chat-launcher-primary-title">Run deep research</span>
              <span className="chat-launcher-primary-copy">
                Push the next turn into a stronger research frame instead of a quick answer.
              </span>
              {!planAllows(plan, ROOT_META.research.requiredPlan) && (
                <span className="chat-launcher-primary-badge">
                  {planBadge(ROOT_META.research.requiredPlan)}
                </span>
              )}
            </button>
            {renderActionCard("add-sources")}
            {renderActionCard("deep-think")}
          </div>
        )}

        {root === "search" && (
          <div className="chat-launcher-pane-stack">
            <button
              type="button"
              className="chat-launcher-primary"
              onClick={() => onPrimaryRootAction("search")}
            >
              <span className="chat-launcher-primary-title">Search the web</span>
              <span className="chat-launcher-primary-copy">
                Shape the next answer like a live, grounded lookup instead of a generic response.
              </span>
            </button>
            {renderActionCard("add-sources")}
            {renderActionCard("use-memory")}
          </div>
        )}

        {root === "actions" && (
          <div className="chat-launcher-pane-sections">
            {ACTION_SECTION_ORDER.map((section) => (
              <div key={section} className="chat-launcher-section">
                <div className="chat-launcher-section-title">{section}</div>
                <div className="chat-launcher-section-grid">
                  {Object.values(ACTION_META)
                    .filter((meta) => meta.section === section)
                    .map((meta) => renderActionCard(meta.id))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chat-launcher-preview">
        <div className="chat-launcher-preview-eyebrow">{preview.eyebrow}</div>
        <div className="chat-launcher-preview-title">{preview.title}</div>
        <div className="chat-launcher-preview-copy">{preview.description}</div>
        {preview.badge && <div className="chat-launcher-preview-badge">{preview.badge}</div>}
        {preview.status && <div className="chat-launcher-preview-status">{preview.status}</div>}
        <div className="chat-launcher-preview-list">
          {preview.cues.map((cue) => (
            <div key={cue} className="chat-launcher-preview-item">
              {cue}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelPicker({
  tier,
  onChange,
  allowedTiers,
}: {
  tier: ModelTier;
  onChange: (tier: ModelTier) => void;
  allowedTiers: Set<ModelTier>;
}) {
  const [open, setOpen] = useState(false);
  const current = ALL_MODEL_OPTIONS.find((option) => option.tier === tier) ?? ALL_MODEL_OPTIONS[0];

  return (
    <div className="model-picker">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="model-picker-trigger"
      >
        <span className="model-picker-name">{current.display_name}</span>
        <span className="model-picker-caret">v</span>
      </button>
      {open && (
        <div className="model-picker-menu">
          {ALL_MODEL_OPTIONS.map((option) => {
            const locked = !allowedTiers.has(option.tier);
            return (
              <button
                type="button"
                key={option.tier}
                onClick={() => {
                  if (locked) return;
                  onChange(option.tier);
                  setOpen(false);
                }}
                disabled={locked}
                className={`model-picker-item${option.tier === tier ? " active" : ""}${locked ? " locked" : ""}`}
              >
                <div className="model-picker-item-name">
                  {option.display_name}
                  {locked && <span className="model-picker-lock">Upgrade</span>}
                </div>
                <div className="model-picker-item-blurb">{option.blurb}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssistantBubble({
  content,
  streaming,
  onRunArtifact,
  activeArtifactId,
  toolExecutions,
}: {
  content: string;
  streaming: boolean;
  onRunArtifact?: (artifact: CodeArtifact) => void;
  activeArtifactId?: string | null;
  toolExecutions?: ToolExecution[];
}) {
  // v0.1.4 — strip [canvas:Title]…[/canvas] blocks from the bubble so
  // the chat shows the assistant's prose without the raw markup. The
  // canvas pane renders the actual block contents alongside.
  const cleaned = stripCanvasBlocks(content);
  const sections = parseSections(cleaned).filter((section) => section.type !== "thinking");
  // v0.1.4 — runnable code artifacts (HTML/JS/JSX/TSX, ≥30 lines).
  // Wait until streaming completes before exposing the "Run preview"
  // button so a half-streamed block doesn't render a broken preview.
  const artifacts = streaming ? [] : findCodeArtifacts(cleaned);
  return (
    <>
      {sections.map((section, index) => {
        const isLastSection = index === sections.length - 1;
        if (streaming && isLastSection) {
          return (
            <span key={index}>
              <StreamingFadeText text={section.text} />
              <span className="chat-cursor" />
            </span>
          );
        }
        return (
          <div key={index} className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.text}</ReactMarkdown>
          </div>
        );
      })}
      {artifacts.length > 0 && onRunArtifact && (
        <div className="chat-artifact-row">
          {artifacts.map((artifact) => {
            const isOpen = artifact.id === activeArtifactId;
            return (
              <button
                key={artifact.id}
                type="button"
                className={`chat-artifact-btn${isOpen ? " active" : ""}`}
                onClick={() => onRunArtifact(artifact)}
                title={`Open ${artifact.lang.toUpperCase()} preview in side panel`}
              >
                <span className="chat-artifact-dot" aria-hidden />
                {isOpen ? "Showing preview" : "Run preview"}
                <span className="chat-artifact-tag">{artifact.lang}</span>
              </button>
            );
          })}
        </div>
      )}
      {toolExecutions && toolExecutions.length > 0 && (
        <div className="chat-tool-row">
          {toolExecutions.map((exec) => (
            <span
              key={exec.id}
              className={`chat-tool-chip chat-tool-chip--${exec.status}`}
              title={`${exec.name}(${JSON.stringify(exec.input)})`}
            >
              <span className="chat-tool-chip-mark" aria-hidden>
                {exec.status === "running"
                  ? "…"
                  : exec.status === "ok"
                    ? "✓"
                    : "!"}
              </span>
              <span className="chat-tool-chip-label">{exec.summary}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// Sidebar search input — thin row above the thread list. Wrapped in
// forwardRef so the parent can focus it from a ⌘F shortcut.
const ThreadSearch = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (next: string) => void }
>(function ThreadSearch({ value, onChange }, ref) {
  return (
    <div className="chat-history-search">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="chat-history-search-icon"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search threads…"
        className="chat-history-search-input"
        spellCheck={false}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          className="chat-history-search-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
});

// ChatGPT-style word fade-in for streaming text. Splits the text into
// word + whitespace tokens and renders each word as its own span.
// Index keys mean React reuses existing spans as text grows, so the
// CSS animation only fires the first time a word appears — chars
// added inside an already-mounted word grow without re-animating.
function StreamingFadeText({ text }: { text: string }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  return (
    <span className="chat-stream-text">
      {tokens.map((token, i) =>
        /^\s+$/.test(token) ? (
          token
        ) : (
          <span key={i} className="chat-word-fade">
            {token}
          </span>
        ),
      )}
    </span>
  );
}

function BounceDots() {
  return (
    <span className="chat-dots" aria-label="Thinking">
      <span className="chat-dot" />
      <span className="chat-dot" />
      <span className="chat-dot" />
    </span>
  );
}

function formatThreadTime(iso: string) {
  const date = new Date(iso);
  const deltaMs = Date.now() - date.getTime();
  const deltaHours = Math.floor(deltaMs / (1000 * 60 * 60));
  if (deltaHours < 1) return "Just now";
  if (deltaHours < 24) return `${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) return `${deltaDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12L20 4L14 20L11 13L4 12Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15C10.343 15 9 13.657 9 12V7C9 5.343 10.343 4 12 4C13.657 4 15 5.343 15 7V12C15 13.657 13.657 15 12 15Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 11.5C6.5 14.538 8.962 17 12 17C15.038 17 17.5 14.538 17.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 17V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

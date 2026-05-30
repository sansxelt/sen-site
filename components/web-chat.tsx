"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "./code-block";
import { ChartRenderer } from "./chart-renderer";
import { CanvasRenderer } from "./canvas-renderer";
import { useLei } from "./lei-shell";
import { previewCreditCost } from "@/lib/lei";
import { planDisplayName } from "@/lib/pricing";
import { ProjectPicker, getActiveProjectId } from "./project-picker";
import { trackClientEvent } from "@/lib/client-metrics";

type ChatImageInline = { media_type: string; data: string };

// v0.2.0 phase G — duel turn metadata. When a ChatMessage carries a
// `duel` field, it renders as a side-by-side comparison instead of
// a single bubble. Both sides stream independently into the same
// message object; once the user picks a winner the duel field is
// cleared and the chosen content collapses into the regular
// content/id fields like any solo assistant turn.
type DuelSideKey = "left" | "right";
type DuelSidePayload = {
  side: DuelSideKey;
  model: string;
  content: string;
  done: boolean;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
  messageId?: string;
  phaseLabel?: string | null;
};
type DuelTurnState = {
  groupId: string | null;
  threadId: string | null;
  left: DuelSidePayload;
  right: DuelSidePayload;
  streaming: boolean;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: ChatImageInline[];
  // Server-side row id for messages loaded from /api/threads/[id].
  // Fresh in-memory turns don't carry one until the next reload.
  // Used by edit-and-resend to tell the server which row to
  // truncate from.
  id?: string;
  // v0.2.0 phase G — populated on duel turns; mutually exclusive with
  // a populated `content`. Solo turns leave this undefined.
  duel?: DuelTurnState;
};

// Cross-component "thread is generating" tracker. WebChat writes;
// chat-history rail + the floating back-to-chat pill read. Lives in
// localStorage so a page reload doesn't lose state, and a
// 'Vraelis:flight:changed' event fires on every write so listeners
// re-render without polling.
const FLIGHT_KEY = "Vraelis.inflight.threads";
type FlightMap = Record<string, { startedAt: number }>;
function readFlight(): FlightMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FLIGHT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FlightMap;
    // Auto-expire entries older than 5 minutes, stale flag from a
    // crashed tab shouldn't pulse forever.
    const now = Date.now();
    const cleaned: FlightMap = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (v && typeof v.startedAt === "number" && now - v.startedAt < 5 * 60_000) {
        cleaned[id] = v;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}
type ModelTier = "fast" | "balanced" | "smart";

type Tier = { tier: ModelTier; display_name: string; blurb: string };

// Server message shape returned from /api/threads/[id]. Duel fields
// are nullable on solo turns and on deploys before the v0.2.0-duel
// migration has run.
type ServerMessage = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  images?: ChatImageInline[] | null;
  duel_group_id?: string | null;
  duel_side?: "left" | "right" | null;
  duel_model?: string | null;
  duel_winner?: boolean | null;
};

// Collapses consecutive duel-tagged assistant rows (same group_id)
// into a single ChatMessage with .duel populated, so the UI renders
// historical duels as side-by-side comparisons. Solo turns and
// resolved duels (winner=true, loser deleted) pass through as
// regular assistant messages.
function mapServerMessages(rows: ServerMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.role !== "user" && row.role !== "assistant") {
      i += 1;
      continue;
    }
    if (
      row.role === "assistant" &&
      row.duel_group_id &&
      row.duel_winner !== true
    ) {
      // Look for the matching opposite side in the next slot.
      const partner =
        i + 1 < rows.length &&
        rows[i + 1].role === "assistant" &&
        rows[i + 1].duel_group_id === row.duel_group_id &&
        rows[i + 1].duel_winner !== true
          ? rows[i + 1]
          : null;
      const leftRow = row.duel_side === "left" ? row : partner;
      const rightRow = row.duel_side === "right" ? row : partner;
      const left: DuelSidePayload = {
        side: "left",
        model: leftRow?.duel_model ?? "GPT",
        content: leftRow?.content ?? "",
        done: true,
        messageId: leftRow?.id,
        phaseLabel: null,
      };
      const right: DuelSidePayload = {
        side: "right",
        model: rightRow?.duel_model ?? "Claude",
        content: rightRow?.content ?? "",
        done: true,
        messageId: rightRow?.id,
        phaseLabel: null,
      };
      out.push({
        role: "assistant",
        content: "",
        duel: {
          groupId: row.duel_group_id,
          threadId: null,
          left,
          right,
          streaming: false,
        },
      });
      i += partner ? 2 : 1;
      continue;
    }
    out.push({
      role: row.role,
      content: row.content,
      id: row.id,
      images: Array.isArray(row.images) ? row.images ?? undefined : undefined,
    });
    i += 1;
  }
  return out;
}

// Plan key (DB) → display name (what users actually see on billing).
// Was showing 'Plan: studio' in the chat header while billing said
// 'Plus', confusing. Single source of truth here for the chat
// header + cost chip until we refactor to pass display name from
// the server.
// Whisper's well-documented "ghost" outputs when the audio is
// effectively silence, music, hold-music, breathing, or wind. We
// drop these instead of sending them to the model as if they were
// real prompts. Pattern: short text matching a known phrase, ON
// audio that was also short. Real one-word answers ("yes", "no",
// "stop") don't trip the filter because the audio is normal length.
const WHISPER_GHOSTS = new Set([
  "you", "you.", "thank you", "thank you.", "thanks", "thanks.",
  "thanks for watching", "thanks for watching.", "thanks for watching!",
  "thank you for watching", "thank you for watching.",
  "bye", "bye.", "bye!", "hi", "hi.",
  ".", "...", "♪", "♪♪", "♪♪♪",
  "i", "i.", "uh", "um", "uh.", "um.",
  "[music]", "(music)", "[silence]", "(silence)", "[applause]",
]);
function isLikelyWhisperHallucination(text: string, _audioBytes: number): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  // Only drop EXACT known-ghost matches. The earlier audio-bytes
  // heuristic was rejecting real one-word answers ('yes', 'stop',
  // 'no'), which is the opposite of what we want.
  if (WHISPER_GHOSTS.has(normalized)) return true;
  return false;
}

// planDisplayName moved to lib/pricing.ts so server-side error
// messages (cap-blocked reasons) speak the same language as the UI.

const ALL_TIERS: ReadonlyArray<{
  tier: ModelTier;
  display_name: string;
  blurb: string;
}> = [
  {
    tier: "fast",
    display_name: "vraelis-1 fast",
    blurb: "Quick replies. Free for everyone.",
  },
  {
    tier: "balanced",
    display_name: "vraelis-1",
    blurb: "Default. Core and up.",
  },
  {
    tier: "smart",
    display_name: "vraelis-1 deep",
    blurb: "Heaviest. Pro and up.",
  },
];

export function WebChat({
  email,
  plan,
  tiers,
  planExpiresAt,
  planCanceling,
}: {
  email: string;
  plan: string;
  tiers: Tier[];
  planExpiresAt?: string | null;
  planCanceling?: boolean;
}) {
  const lei = useLei();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  // v0.1.16, Hoisted up so the document-level paste handler below
  // can focus the textarea after routing a text paste through it.
  // Same ref is reused by the textarea element itself further down.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow the composer as the user types. Reset height to auto
  // so we measure the natural scrollHeight, then set to that —
  // capped at MAX_COMPOSER_HEIGHT. Past the cap the textarea becomes
  // internally scrollable (the cursor stays visible because the
  // browser keeps the caret in view inside a scrollable textarea).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const MAX_COMPOSER_HEIGHT = 200;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [input]);

  // v0.1.16, Ctrl+V / Cmd+V paste support, three modes:
  //   1. Clipboard has FILES (image, video, doc): route to LEI
  //      attachments same as drag-drop, preventDefault.
  //   2. Clipboard has TEXT and the user is NOT focused in any
  //      input/textarea/contenteditable: append the text to the chat
  //      input + focus the textarea. Mirrors the "type anywhere to
  //      focus" behavior so paste has the same property.
  //   3. Clipboard has TEXT and the user IS in an input already:
  //      let the default browser paste happen (do nothing).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const collected: File[] = [];
      // Files-list path: covers copy-from-OS-file-manager.
      if (dt.files && dt.files.length > 0) {
        for (let i = 0; i < dt.files.length; i++) {
          const f = dt.files.item(i);
          if (f) collected.push(f);
        }
      }
      // Items path: screenshot tools and "copy image" from browser
      // pages put data here, not in .files.
      if (dt.items && dt.items.length > 0) {
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i];
          if (item.kind === "file") {
            const f = item.getAsFile();
            // De-dupe, Chrome sometimes lists the same blob in
            // both .files and .items.
            if (f && !collected.some((c) => c.size === f.size && c.name === f.name)) {
              collected.push(f);
            }
          }
        }
      }
      if (collected.length > 0) {
        e.preventDefault();
        void lei.addFiles(collected);
        return;
      }

      // Text-paste handling, three cases:
      //   1. Pasted into the chat textarea AND text is "long"
      //      (>=2000 chars or >=30 lines): intercept, convert to
      //      an attachment chip above the input. Same UX as
      //      ChatGPT — long pastes don't bury the textarea, the
      //      AI still scans them as if they were a file.
      //      Multiple long pastes = multiple chips.
      //   2. Pasted into the chat textarea AND text is short:
      //      let the default browser paste fire (just types in).
      //   3. Pasted somewhere ELSE on the page (no input focus):
      //      append to the chat textarea + focus it.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      const text = dt.getData("text/plain");
      if (!text) return;

      const PASTE_AS_ATTACHMENT_CHARS = 2000;
      const PASTE_AS_ATTACHMENT_LINES = 30;
      const lineCount = text.split("\n").length;
      const isLongPaste =
        text.length >= PASTE_AS_ATTACHMENT_CHARS ||
        lineCount >= PASTE_AS_ATTACHMENT_LINES;

      // Long paste into the chat textarea → convert to attachment.
      if (
        inField &&
        target === textareaRef.current &&
        isLongPaste
      ) {
        e.preventDefault();
        // Heuristic: if it looks like code, name it .txt anyway —
        // the AI sees the contents either way and the chip just
        // labels it "Pasted text". Code-extension naming would
        // route through the syntax-highlighted code panel which
        // is distracting for ad-hoc paste-and-ask flows.
        const filename = `Pasted (${text.length.toLocaleString()} chars).txt`;
        const file = new File([text], filename, { type: "text/plain" });
        void lei.addFiles([file]);
        return;
      }

      // Short paste in any input: default browser paste.
      if (inField) return;

      // Paste outside any input: bring it into the chat textarea.
      e.preventDefault();
      setInput((prev) => prev + text);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const ta = textareaRef.current;
        if (ta) ta.selectionStart = ta.selectionEnd = ta.value.length;
      });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [lei]);
  // v0.1.16, server-persisted thread id. Null until first send (or
  // until /api/threads/[id] loads an existing one). Same account →
  // same threads from any device.
  const [threadId, setThreadId] = useState<string | null>(null);
  const threadIdRef = useRef<string | null>(null);
  useEffect(() => { threadIdRef.current = threadId; }, [threadId]);

  // v0.1.16, Re-fetch the active thread whenever the URL changes
  // (soft nav from the chat history rail clicking a different chat).
  // Previous version only fired on mount, so switching threads
  // looked broken, same in-memory chat stayed mounted.
  //
  // URL contract:
  //   ?new=1            → blank chat, drop threadId
  //   ?thread=<uuid>    → load that thread's messages
  //   (no params)       → on first mount only, restore most recent;
  //                       after that, leave the active chat alone
  const searchParams = useSearchParams();
  const router = useRouter();
  const wantsNew = searchParams?.get("new") === "1";
  const requestedThreadParam = searchParams?.get("thread") ?? null;
  const promptParam = searchParams?.get("prompt") ?? null;
  // ?project=<id> on a fresh chat URL pre-attaches that project
  // to the next send, no localStorage race. Used by the rail's
  // "Start a chat here" CTA: it sets the URL + WebChat picks it
  // up here. Cleared after first send so it doesn't stick on
  // subsequent turns of the same thread.
  const requestedProjectParam = searchParams?.get("project") ?? null;
  const pendingProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (requestedProjectParam) {
      pendingProjectIdRef.current = requestedProjectParam;
    }
  }, [requestedProjectParam]);
  const hasHydratedRef = useRef(false);
  const promptHandledRef = useRef(false);

  // v0.2.0 phase H — project attachment proof. Projects were
  // invisible: pinned context auto-injected into the system
  // prompt, but the user had no UI proof anything happened. Now
  // we surface a small strip at the top of project-attached
  // threads showing the project name + pin count, so "is this
  // project doing anything?" has a visible answer.
  type AttachedProject = {
    id: string;
    name: string;
    pinCount: number;
  };
  const [attachedProject, setAttachedProject] =
    useState<AttachedProject | null>(null);
  const fetchAttachedProject = useCallback(
    async (projectId: string | null) => {
      if (!projectId) {
        setAttachedProject(null);
        return;
      }
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setAttachedProject(null);
          return;
        }
        const data = (await res.json()) as {
          project?: {
            id: string;
            name: string;
            pinned?: Array<{ id: string }>;
          };
        };
        if (!data.project) {
          setAttachedProject(null);
          return;
        }
        setAttachedProject({
          id: data.project.id,
          name: data.project.name,
          pinCount: data.project.pinned?.length ?? 0,
        });
      } catch {
        setAttachedProject(null);
      }
    },
    [],
  );
  // Re-evaluate when the active thread changes (loaded a different
  // chat) or when the picker fires Vraelis:project:changed for the
  // current thread.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // On mount, surface the active project even before a thread
    // exists, so a fresh chat with a project pre-selected shows
    // the strip immediately ("you'll send this with Project X").
    const initialActive = getActiveProjectId();
    if (initialActive) void fetchAttachedProject(initialActive);
    const onProjectChanged = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail ?? null;
      void fetchAttachedProject(detail);
    };
    window.addEventListener("Vraelis:project:changed", onProjectChanged);
    return () =>
      window.removeEventListener("Vraelis:project:changed", onProjectChanged);
  }, [fetchAttachedProject]);

  // v0.1.16, Pre-fill input from ?prompt= so the home page teaser
  // can ship a question into the workshop. We pre-fill (not auto-
  // send) so the user retains agency + can edit.
  useEffect(() => {
    if (!promptParam || promptHandledRef.current) return;
    promptHandledRef.current = true;
    setInput(promptParam);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("prompt");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [promptParam]);

  // v0.1.16 r8, Listen for '+ New chat' clicks from anywhere in the
  // workspace shell. Hard-abort any in-flight stream + reset client
  // state INSTANTLY so the textarea isn't stuck behind a stale Stop
  // button (the cross-thread guard previously skipped setStreaming
  // (false) on thread switch, leaving the UI in a half-state).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNewChat = () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setStreaming(false);
      setThreadId(null);
      setMessages([]);
      setInput("");
      setChatError(null);
    };
    window.addEventListener("Vraelis:new-chat", onNewChat);
    return () => window.removeEventListener("Vraelis:new-chat", onNewChat);
  }, []);

  // v0.2.0 phase H — when the user picks a project mid-thread,
  // PATCH the active thread so it inherits the new project_id.
  // Without this, projects only attached at thread CREATION
  // (first send), so picking a project after the conversation
  // started had no effect on subsequent replies — context never
  // reached the system prompt and projects felt broken.
  // Picking "No project" detaches (project_id=null).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onProjectChanged = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail ?? null;
      const tid = threadIdRef.current;
      if (!tid) return; // no thread yet — id sticks at first send
      void fetch(`/api/threads/${tid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: detail }),
      }).catch(() => {});
    };
    window.addEventListener("Vraelis:project:changed", onProjectChanged);
    return () =>
      window.removeEventListener("Vraelis:project:changed", onProjectChanged);
  }, []);

  // v0.2.0 phase G+ — pinned-prompt run-as-Duel. The project panel
  // dispatches Vraelis:duel-prompt with the prompt content; we
  // force duel mode on (so the toggle visibly reflects what's
  // running) and fire the duel immediately, no confirmation step.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDuelPrompt = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      const prompt = (detail?.prompt ?? "").trim();
      if (!prompt) return;
      trackClientEvent("duel_pinned_prompt_fired", {
        prompt_length: prompt.length,
      });
      void sendDuelRef.current?.(prompt);
    };
    window.addEventListener("Vraelis:duel-prompt", onDuelPrompt);
    return () =>
      window.removeEventListener("Vraelis:duel-prompt", onDuelPrompt);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // ChatGPT-style hydrate:
    //   ?new=1            → start blank, drop threadId
    //   ?thread=<uuid>    → load that thread
    //   (no params)       → on FIRST mount only, restore the most
    //                       recent thread; on subsequent renders
    //                       leave the active chat alone so we don't
    //                       clobber an in-progress reply.
    if (wantsNew) {
      setThreadId(null);
      setMessages([]);
      setInput("");
      hasHydratedRef.current = true;
      return;
    }

    (async () => {
      try {
        let targetId = requestedThreadParam;
        if (!targetId) {
          // No URL hint, no auto-restore. Always land on a fresh
          // chat and let the empty-state "Pick up where you left
          // off" card surface the recent threads as one-click
          // resume buttons. Auto-jumping into the last thread
          // looked stale and dragged the user back into work they
          // were ready to leave behind.
          hasHydratedRef.current = true;
          setThreadId(null);
          setMessages([]);
          setInput("");
          return;
        }
        hasHydratedRef.current = true;
        if (cancelled) return;
        if (!targetId) return; // brand new account, no threads yet
        // Don't re-load the same thread we're already showing.
        if (targetId === threadIdRef.current) return;

        const detailRes = await fetch(`/api/threads/${targetId}`, { cache: "no-store" });
        if (!detailRes.ok || cancelled) return;
        const detail = (await detailRes.json()) as {
          thread?: { updated_at?: string; project_id?: string | null };
          messages?: ServerMessage[];
        };
        if (cancelled) return;
        setThreadId(targetId);
        // Surface the project-attached strip if this thread is
        // filed under a project. Detaching is also handled here:
        // a thread with project_id=null clears the strip.
        void fetchAttachedProject(detail.thread?.project_id ?? null);
        // Reflect the active thread in the URL so the chat history
        // rail's active-state outline picks it up. ReplaceState (no
        // history entry) so the back button still feels normal.
        if (typeof window !== "undefined" && !requestedThreadParam) {
          const url = new URL(window.location.href);
          url.searchParams.set("thread", targetId);
          window.history.replaceState({}, "", url.pathname + url.search);
        }
        const restored = mapServerMessages(detail.messages ?? []);
        // Resume-streaming detection: if the user comes back to a
        // thread that's still generating server-side, flip the
        // streaming flag so the bouncing dots / cursor render,
        // then poll until the server stream actually ends. Two
        // cases hit this path with different freshness thresholds:
        //   - chat: assistant placeholder exists (last role is
        //     assistant). Server bumps updated_at every ~900ms
        //     during streaming, so 10s of staleness means done.
        //   - image gen: NO placeholder is created, last role is
        //     user, server doesn't bump updated_at during the
        //     OpenAI call. Could be stale for 30s+ mid-flight, so
        //     the threshold is 3 min (covers any reasonable image
        //     gen runtime; older = the request is genuinely dead).
        // For the image-gen case we append a synthetic empty
        // assistant bubble so the inflight UI shows; the next poll
        // replaces it once the server saves the real assistant turn.
        const updatedAt = detail.thread?.updated_at;
        const ageMs = updatedAt
          ? Date.now() - new Date(updatedAt).getTime()
          : Number.POSITIVE_INFINITY;
        const lastMsg = restored[restored.length - 1];
        const isResuming =
          (lastMsg?.role === "assistant" && ageMs < 10_000) ||
          (lastMsg?.role === "user" && ageMs < 180_000);
        const initial =
          isResuming && lastMsg?.role === "user"
            ? [...restored, { role: "assistant" as const, content: "" }]
            : restored;
        setMessages(initial);

        if (isResuming) {
          setStreaming(true);
          // Poll the thread every 2s for fresh content. Stop once
          // updated_at has been quiet for 5s (server's last save
          // happened, stream ended) or after a hard 90s ceiling.
          let lastSeen = updatedAt ?? new Date().toISOString();
          let lastChange = Date.now();
          const startedAt = Date.now();
          const pollId = window.setInterval(async () => {
            if (cancelled || threadIdRef.current !== targetId) {
              window.clearInterval(pollId);
              return;
            }
            try {
              const r = await fetch(`/api/threads/${targetId}`, {
                cache: "no-store",
              });
              if (!r.ok) return;
              const d = (await r.json()) as {
                thread?: { updated_at?: string };
                messages?: ServerMessage[];
              };
              if (cancelled || threadIdRef.current !== targetId) return;
              const next = mapServerMessages(d.messages ?? []);
              const nextLast = next[next.length - 1];
              const augmented =
                nextLast?.role === "user"
                  ? [...next, { role: "assistant" as const, content: "" }]
                  : next;
              setMessages(augmented);
              const nextUpdated = d.thread?.updated_at;
              if (nextUpdated && nextUpdated !== lastSeen) {
                lastSeen = nextUpdated;
                lastChange = Date.now();
              }
              const quietFor = Date.now() - lastChange;
              const totalFor = Date.now() - startedAt;
              // Bail when the server has been quiet for 5s AND the
              // assistant turn has actually been saved. Avoids
              // killing the spinner mid-image-gen just because the
              // throttled save loop hasn't bumped updated_at lately.
              const settled =
                quietFor > 5_000 &&
                nextLast?.role === "assistant" &&
                (nextLast?.content ?? "").length > 0;
              const timedOut = totalFor > 180_000;
              if (settled || timedOut) {
                window.clearInterval(pollId);
                if (!cancelled && threadIdRef.current === targetId) {
                  setStreaming(false);
                  // Hard timeout cleanup: if the server never saved
                  // an assistant turn (image gen hung, fetch died
                  // upstream), drop the synthetic empty placeholder
                  // we appended so the user isn't staring at a
                  // dead bubble forever.
                  if (
                    timedOut &&
                    nextLast?.role === "assistant" &&
                    !(nextLast?.content ?? "").length
                  ) {
                    setMessages((prev) => {
                      const tail = prev[prev.length - 1];
                      if (tail?.role === "assistant" && !tail.content) {
                        return prev.slice(0, -1);
                      }
                      return prev;
                    });
                  }
                }
              }
            } catch {
              // ignore, next tick will retry
            }
          }, 2000);
        }
      } catch {
        // ignore, blank chat is fine
      }
    })();
    return () => { cancelled = true; };
  }, [wantsNew, requestedThreadParam]);
  const [streaming, setStreaming] = useState(false);
  // v0.2.0 phase H — Duel is now an explicit per-message action
  // (a "Duel" button next to Send) instead of a sticky mode toggle.
  // Reasoning: making every casual "yo" / "wsg" round into a duel
  // was overkill for 95% of conversations. The compare flow is
  // valuable when the user actually wants to compare; otherwise
  // it's just two replies + a Pick UI on a one-line answer.
  // The old localStorage key (Vraelis.duelMode) is left orphaned;
  // browsers clean stale keys, no migration needed.

  // v0.2.0 phase G+ — weekly usage snapshot for monetization hooks
  // (low-chat banner, winner-moment upsell, "Liking Duel?" copy).
  // Refreshes at mount + on every Vraelis:threads:changed event,
  // which fires after each send/duel — so the numbers stay close
  // to live without us building a separate refresh path.
  type WeeklyBucket = { used: number; cap: number | null; lifted: boolean };
  type WeeklySnapshot = {
    chat: WeeklyBucket;
    duel: WeeklyBucket;
  };
  const [weeklySnapshot, setWeeklySnapshot] = useState<WeeklySnapshot | null>(
    null,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const r = await fetch("/api/account/billing/usage-summary", {
          cache: "no-store",
        });
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as {
          weekly?: { chat?: WeeklyBucket; duel?: WeeklyBucket };
        };
        if (cancelled) return;
        const chat = data.weekly?.chat;
        const duel = data.weekly?.duel;
        if (chat && duel) {
          setWeeklySnapshot({ chat, duel });
        }
      } catch {
        // ignore — banner just doesn't render
      }
    };
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener("Vraelis:threads:changed", onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("Vraelis:threads:changed", onChanged);
    };
  }, []);

  // Derived: how many chats / duels remain on the user's plan,
  // and whether the cap is unlimited (paid + unlimited-chat addon).
  // null = unlimited; numeric = remaining count (clamped to 0).
  const chatRemaining: number | null = weeklySnapshot
    ? weeklySnapshot.chat.lifted || weeklySnapshot.chat.cap === null
      ? null
      : Math.max(0, weeklySnapshot.chat.cap - weeklySnapshot.chat.used)
    : null;
  const duelRemaining: number | null = weeklySnapshot
    ? weeklySnapshot.duel.lifted || weeklySnapshot.duel.cap === null
      ? null
      : Math.max(0, weeklySnapshot.duel.cap - weeklySnapshot.duel.used)
    : null;
  const hasUnlimitedChat = weeklySnapshot
    ? weeklySnapshot.chat.lifted || weeklySnapshot.chat.cap === null
    : false;

  // ChatGPT/Claude-style live phase label during generation
  // "Searching the web…" / "Reading the page…" / "Writing answer…"
  // Cleared when the stream ends or the answer text starts flowing.
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [tier, setTier] = useState<ModelTier>(
    tiers.find((t) => t.tier === "balanced")?.tier ??
      tiers[0]?.tier ??
      "fast",
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  // v0.2.0 phase E, dedicated image-gen failure state. When the
  // /api/ai/image route 4xx/5xx, we stash both the prompt that
  // tried (so Retry doesn't need the user to re-type) and the
  // actual error so the pill copy is honest. Cleared on
  // successful retry / new send.
  const [imageRetry, setImageRetry] = useState<{
    prompt: string;
    message: string;
  } | null>(null);
  // v0.2.0 phase E, edit-and-resend state. When set, the next
  // send() truncates the local history at this index AND tells
  // the server to delete from this message id forward. The
  // server then saves the new (edited) user turn + a fresh
  // assistant response, so the conversation cleanly diverges
  // at the edit. Cleared after submit or cancel.
  const [editingTurn, setEditingTurn] = useState<{
    index: number;
    messageId: string | null;
  } | null>(null);
  // v0.2.0 phase E, real Regenerate. Captured at click time and
  // attached to the next send() so the API call carries
  // regenerate_from_assistant_id. Cleared once captured into the
  // network payload so the next normal turn doesn't carry it.
  const regenerateTargetRef = useRef<string | null>(null);
  const [voiceState, setVoiceState] = useState<
    "idle" | "recording" | "transcribing" | "speaking"
  >("idle");
  const [voiceMode, setVoiceMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  // True when this turn was started by voice, used to auto-speak the response
  const lastTurnWasVoice = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  // (Web Speech live-preview state removed; transcribe path is the
  // only source of text now. Simpler + fewer cross-browser bugs.)
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});

  const isFreePlan = plan === "free";

  // Refs so the rAF loop reads the latest values without re-binding
  const voiceStateRef = useRef(voiceState);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  const voiceModeRef = useRef(voiceMode);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const interruptHandlerRef = useRef<(() => void) | null>(null);
  // Adaptive noise floor + "did the user actually speak" flag
  // see workspace.tsx for the full rationale. Fixed thresholds
  // miss talking in noisy rooms / on quiet mics.
  const noiseFloorRef = useRef(0.04);
  const heardSpeechRef = useRef(false);

  const VAD_MIN_RECORD_MS = 400;
  // v0.1.16 r2, Tightened further. Users on quieter mics had VAD
  // never trip the speech threshold (floor + 0.06) so the loop
  // never knew speech happened, never auto-stopped, and the AI
  // never got a turn. Halved SPEECH_DELTA so quieter voices register.
  const VAD_SILENCE_HOLD_MS = 500;
  const SPEECH_DELTA = 0.03;
  const SILENCE_DELTA = 0.012;
  const INTERRUPT_DELTA = 0.04;
  const INTERRUPT_HOLD_MS = 90;
  // Fallback: if VAD somehow never trips and the user just keeps
  // talking, force-stop after 30s so we send SOMETHING through
  // instead of recording forever in silence.
  const VAD_MAX_RECORD_MS = 30_000;

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
    const a = analyserRef.current;
    if (!a) return;
    const data = new Uint8Array(a.frequencyBinCount);
    const tick = () => {
      a.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(1, (sum / data.length) / 110);
      setAudioLevel(level);

      const state = voiceStateRef.current;
      const now = Date.now();
      const floor = noiseFloorRef.current;
      const speechCutoff = floor + SPEECH_DELTA;
      const silenceCutoff = floor + SILENCE_DELTA;

      // Track room baseline when not actively in speech
      if (level < speechCutoff) {
        const alpha = level < floor ? 0.15 : 0.02;
        noiseFloorRef.current = Math.max(
          0.005,
          floor * (1 - alpha) + level * alpha,
        );
      }

      // Auto-stop on sustained silence, only after we've heard speech
      if (state === "recording" && voiceModeRef.current) {
        const elapsed = now - recordingStartedAtRef.current;
        // Hard cap: even if VAD never trips, force-stop so we never
        // record indefinitely in silence.
        if (elapsed > VAD_MAX_RECORD_MS) {
          const r = recorderRef.current;
          if (r && r.state !== "inactive") r.stop();
          silenceStartRef.current = null;
        } else if (level > speechCutoff) {
          heardSpeechRef.current = true;
          silenceStartRef.current = null;
        } else if (
          elapsed > VAD_MIN_RECORD_MS &&
          heardSpeechRef.current &&
          level < silenceCutoff
        ) {
          if (silenceStartRef.current == null) {
            silenceStartRef.current = now;
          } else if (now - silenceStartRef.current > VAD_SILENCE_HOLD_MS) {
            const r = recorderRef.current;
            if (r && r.state !== "inactive") r.stop();
            silenceStartRef.current = null;
          }
        } else {
          silenceStartRef.current = null;
        }
      } else {
        silenceStartRef.current = null;
      }

      // Interrupt: user speaks while AI is talking
      if (state === "speaking" && voiceModeRef.current) {
        if (level > floor + INTERRUPT_DELTA) {
          if (speechStartRef.current == null) {
            speechStartRef.current = now;
          } else if (now - speechStartRef.current > INTERRUPT_HOLD_MS) {
            speechStartRef.current = null;
            const handler = interruptHandlerRef.current;
            if (handler) handler();
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

  // v0.1.16, Don't yank the user back to the bottom while the AI
  // is generating if they've scrolled up to read something. Standard
  // chat UX: only auto-scroll if they were already near the bottom.
  // Track distance from bottom on every scroll; if a user scrolls
  // up while streaming, leave them alone until they scroll back
  // down on their own (which re-arms the auto-follow).
  const stickToBottomRef = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  // rAF-batched scroll handler. Without this, fast wheel input
  // fires onScroll dozens of times per frame and the duel layout
  // (two streams growing in parallel) reads as jittery.
  //
  // Latest pill behaviour: appears only on a real upward scroll
  // gesture (not just whenever distance-from-bottom > 60). Fades
  // 3s after the last scroll event so it does not sit static over
  // chart / image content. Scrolling again resets the timer.
  const scrollRafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const onScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distanceFromBottom < 60;
      const direction = el.scrollTop < lastScrollTopRef.current ? "up" : "down";
      lastScrollTopRef.current = el.scrollTop;
      stickToBottomRef.current = nearBottom;

      if (nearBottom) {
        setShowJumpToBottom(false);
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        return;
      }

      if (direction === "up") {
        setShowJumpToBottom(true);
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = window.setTimeout(() => {
          setShowJumpToBottom(false);
          hideTimerRef.current = null;
        }, 3000);
      }
    });
  }, []);
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Auto-stick to bottom while messages grow. rAF-batched + only
  // scrolls when the scrollHeight actually changed — without the
  // height check, a duel side that finishes before the other
  // would keep firing scroll-to-bottom on every render of the
  // still-streaming side, even though nothing visible moved.
  const lastScrollHeightRef = useRef(0);
  const autoScrollRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    if (autoScrollRafRef.current !== null) return;
    autoScrollRafRef.current = requestAnimationFrame(() => {
      autoScrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollHeight === lastScrollHeightRef.current) return;
      lastScrollHeightRef.current = el.scrollHeight;
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  const send = useCallback(async (
    overrideText?: string,
    fromVoice = false,
    overrideBaseMessages?: ChatMessage[],
  ) => {
    const baseText = (overrideText ?? input).trim();

    // File / code attachments inline into the prompt (text). Image
    // attachments are converted to base64 + sent via the chat API's
    // `images` field on the user message, the route already supports
    // this (lib/ai-models multimodal). Video attachments are mentioned
    // by name (no video model wired up yet).
    const attachmentBlocks: string[] = [];
    const imageBlocks: Array<{
      media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
      data: string;
    }> = [];
    for (const att of lei.attachments) {
      if (att.kind === "file" || att.kind === "code") {
        if (att.text) {
          attachmentBlocks.push(
            `\n\n--- Attached: ${att.name} (${att.mime}) ---\n${att.text}\n--- end ---`,
          );
        }
      } else if (att.kind === "image" && att.previewUrl) {
        try {
          const blob = await fetch(att.previewUrl).then((r) => r.blob());
          // Downsample BEFORE base64. Phone photos are 12MP+
          // (3-5MB raw). Server caps at 1MB and silently filters
          // anything bigger — model receives only the text and
          // bails. Resize to max 1568px on the longest edge
          // (Anthropic's vision sweet spot) and re-encode as JPEG
          // with quality stepping until we're under ~900KB.
          const downsampled = await downsampleForVision(blob).catch(() => null);
          const finalBlob = downsampled ?? blob;
          const finalMime = downsampled ? "image/jpeg" : (att.mime || "image/png");
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error("read failed"));
            r.readAsDataURL(finalBlob);
          });
          const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
          if (m) {
            const mt = finalMime.toLowerCase();
            const accepted = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
            if ((accepted as readonly string[]).includes(mt)) {
              imageBlocks.push({
                media_type: mt as (typeof accepted)[number],
                data: m[2],
              });
            } else {
              // Mislabeling unsupported formats (HEIC, HEIF, BMP) as
              // PNG before sending to vision used to silently fail.
              // Surface the rejection so users know to retake or
              // convert instead of waiting on a response that never
              // comes.
              attachmentBlocks.push(
                `\n\n[Skipped image: ${att.name}. Format ${mt} is not supported by vraelis-1 vision yet, please use PNG, JPEG, WEBP, or GIF.]`,
              );
            }
          }
        } catch {
          attachmentBlocks.push(`\n\n[Could not attach image: ${att.name}]`);
        }
      } else {
        attachmentBlocks.push(`\n\n[Attached ${att.kind}: ${att.name}]`);
      }
    }
    const text = baseText + attachmentBlocks.join("");
    if (!text && imageBlocks.length === 0) return;

    // Auto-route image-gen intent so users don't have to click a
    // separate button. Two patterns trigger now:
    //   1. Strong-visual verb + ANY subject: "gen a cat", "draw
    //      a sunset", "imagine a cyberpunk city". These verbs
    //      are almost only used in image-gen context, so we
    //      don't gate on a noun list.
    //   2. Generic verb + clearly-visual noun: "make a logo",
    //      "show me a portrait", "give me an illustration".
    //      The noun list is INTENTIONALLY narrow now: graph /
    //      chart / plot / diagram / figure / visualization /
    //      map / etc. were removed because those map to text
    //      VRAELIS-card output (stat-grid, comparison) NOT to
    //      image generation. Letting the chat model decide
    //      whether to render a card vs. fire image gen yields
    //      better answers than my regex pre-classifying.
    // Skipped when there's an attached image (probably means
    // "analyze this", not "make a new one").
    const STRONG_IMAGE_VERB =
      /^\s*(?:gen(?:erate)?|draw|paint|imagine|illustrate|render|sketch)\b\s+\S/i;
    const IMAGE_GEN_INTENT =
      /^\s*(?:make|create|design|show(?:\s+me)?|give(?:\s+me)?)\s+(?:me\s+)?(?:an?\s+|the\s+|some\s+)?(?:image|picture|pic|photo|illustration|art|drawing|painting|sketch|portrait|logo|graphic|render|icon|poster|banner|wallpaper)\b/i;
    const isImageRequest =
      (STRONG_IMAGE_VERB.test(baseText) ||
        IMAGE_GEN_INTENT.test(baseText)) &&
      imageBlocks.length === 0;
    if (isImageRequest) {
      lei.clearAttachments();
      void generateImageFromInput(baseText);
      setInput("");
      return;
    }

    lastTurnWasVoice.current = fromVoice;
    lei.noteIntentFromText(baseText);

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      images: imageBlocks.length > 0 ? imageBlocks : undefined,
    };
    // v0.2.0 phase E, edit-and-resend / regenerate. Slice
    // messages forward off the chain when the caller has a
    // specific truncation point (Edit) OR rebuilds the chain
    // explicitly (Regenerate passes overrideBaseMessages so
    // send doesn't have to wait for React state to catch up).
    const baseMessages =
      overrideBaseMessages ??
      (editingTurn !== null && editingTurn.index >= 0
        ? messages.slice(0, editingTurn.index)
        : messages);
    // Build the network payload separately so the in-UI message stays
    // text-only (we already render the image previews via the LEI
    // attachment chips above the input).
    const payloadMessages = [
      ...baseMessages.map((m) => ({ role: m.role, content: m.content })),
      imageBlocks.length > 0
        ? { role: "user" as const, content: text || "Here's an image, what do you see?", images: imageBlocks }
        : { role: "user" as const, content: text },
    ];
    const next = [...baseMessages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setChatError(null);
    setImageRetry(null);
    // Clear edit-mode state once the truncation values are
    // captured into the network payload above; a follow-up send
    // shouldn't re-truncate the same point.
    if (editingTurn !== null) setEditingTurn(null);
    // v0.2.0 phase E, ChatGPT-style staged status pill. Server
    // overrides this once a real "phase" event arrives (searching,
    // reading the page, writing); locally we lead with "Thinking…"
    // and bump to "Analyzing…" if no token has flowed by ~700ms so
    // the bubble never feels dead between submit and first byte.
    setPhaseLabel("Thinking…");
    const analyzingTimer =
      typeof window !== "undefined"
        ? window.setTimeout(() => {
            setPhaseLabel((cur) =>
              cur === "Thinking…" ? "Analyzing…" : cur,
            );
          }, 700)
        : null;
    // Touch the activity timestamp so the next-mount idle check
    // knows the user was active recently and shouldn't get auto-
    // bumped to a new chat.
    if (typeof window !== "undefined") {
      window.localStorage.setItem("Vraelis.lastActivity", String(Date.now()));
    }
    // v0.1.16 r3+, track the sending-thread context. Tricky case:
    // first send in a NEW chat captures threadId=null, then the
    // server returns a thread id which we setThreadId on. That
    // legitimately changes threadIdRef from null → newId, but it's
    // NOT a thread switch, it's just "we now know our id". So we
    // hold a mutable ref for the sending thread and update it once
    // the server tells us what id was assigned. Real thread switches
    // (user clicks a different chat in the rail) flip threadIdRef
    // to a different non-null id, and isStillThisThread returns
    // false.
    let sendingThreadId: string | null = threadIdRef.current;
    const isStillThisThread = () => {
      const cur = threadIdRef.current;
      // First-time-id assignment: was null, now set. Adopt it.
      if (sendingThreadId === null && cur) {
        sendingThreadId = cur;
        return true;
      }
      return cur === sendingThreadId;
    };
    // Clear attachments NOW (not in the finally), they're already
    // captured into payloadMessages, and conceptually they belong to
    // the turn we just sent. Leaving them visible while the AI streams
    // its reply made it look like they were going to ride along on
    // the next turn too.
    lei.clearAttachments();

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // v0.1.12 \u2014 send the user's local time + IANA timezone with
      // every web chat request so the model can answer time-of-day
      // questions accurately. Without this it claimed "I don't have
      // access to your system clock" and used UTC, which produced
      // "good afternoon" replies at 8 PM local time.
      let clientTimezone = "UTC";
      let clientTimeLabel = new Date().toISOString();
      try {
        clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        // Old browser \u2014 fall back to UTC.
      }
      try {
        clientTimeLabel = new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(new Date());
      } catch {
        // ignore \u2014 ISO fallback
      }

      // Capture + clear the regenerate target before the fetch
      // serialises the body. Any concurrent / follow-up send
      // shouldn't carry the same id.
      const regenerateConsumed = regenerateTargetRef.current;
      regenerateTargetRef.current = null;
      // Same one-shot pattern for the pending ?project=<id>:
      // capture, then clear so follow-up sends in the same thread
      // don't re-attempt to attach. Also strip it from the URL.
      const pendingProjectConsumed = pendingProjectIdRef.current;
      if (pendingProjectConsumed) {
        pendingProjectIdRef.current = null;
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.get("project")) {
            url.searchParams.delete("project");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }
      }

      // Pre-compute which project (if any) this new thread will be
      // filed under. Captured here so we can sync the strip AFTER the
      // server confirms the thread was created, using the exact value
      // that was actually sent — not a stale localStorage read.
      const isNewThread = !threadIdRef.current;
      const sentProjectId: string | null = isNewThread
        ? (pendingProjectConsumed ?? getActiveProjectId() ?? null)
        : null;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
          tier,
          input_mode: fromVoice ? "voice" : "text",
          client_time_iso: new Date().toISOString(),
          client_timezone: clientTimezone,
          client_time_label: clientTimeLabel,
          thread_id: threadIdRef.current ?? undefined,
          // v0.2.0, attach the new thread to the active project (if
          // any). Server ignores this when thread_id is already
          // resolved, so it can't sneak context into someone else's
          // existing thread; the assignment only happens on first
          // turn of a fresh thread.
          //
          // Source of truth (in priority order):
          //   1. ?project=<id> URL param (rail "Start a chat here")
          //   2. localStorage active project (composer picker)
          // (1) wins so the URL-param flow always lands the chat
          // in the right project even if the picker hasn't synced.
          // Pending param is consumed once and cleared so follow-up
          // turns don't re-attempt assignment.
          project_id: sentProjectId ?? undefined,
          // v0.2.0 phase E, edit-and-resend. When the user is
          // rewriting an old turn, the server deletes from this
          // message id forward before saving the new user turn.
          // Local state was already truncated when edit mode was
          // entered, so the server view matches the UI on reload.
          truncate_from_message_id:
            editingTurn?.messageId ?? undefined,
          // v0.2.0 phase E, real Regenerate. Server deletes the
          // old assistant turn (and orphans after) AND skips the
          // user-save block since the prior user message is
          // already in DB. Consumed once via the ref above.
          regenerate_from_assistant_id:
            regenerateConsumed ?? undefined,
        }),
        signal: ac.signal,
      });

      // v0.1.16, Capture the resolved server-side thread id so
      // follow-up turns continue the same conversation (and show in
      // the sidebar).
      const echoedThreadId = res.headers.get("x-VRAELIS-thread-id");
      if (echoedThreadId && echoedThreadId !== threadIdRef.current) {
        setThreadId(echoedThreadId);
        // Sync the project strip to what was ACTUALLY saved. On first
        // send (isNewThread), call fetchAttachedProject with the exact
        // project ID that was sent to the server — or null if none was
        // sent. This prevents "IN PROJECT" showing on threads that were
        // never filed under a project, and confirms it when they were.
        if (isNewThread) {
          void fetchAttachedProject(sentProjectId);
        }
        // Reflect the new active thread in the URL so the rail's
        // active outline picks up immediately.
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("thread", echoedThreadId);
          url.searchParams.delete("new");
          window.history.replaceState({}, "", url.pathname + url.search);
          window.dispatchEvent(new CustomEvent("Vraelis:threads:changed"));
        }
      }

      // v0.1.16 r7, Mark this thread as "generating" in localStorage.
      // The chat-history rail + a floating "Back to chat" pill watch
      // this so the user knows generation is happening even when
      // they're on a different page.
      const flightThreadId = echoedThreadId || threadIdRef.current;
      if (flightThreadId && typeof window !== "undefined") {
        const flight = readFlight();
        flight[flightThreadId] = { startedAt: Date.now() };
        window.localStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
        window.dispatchEvent(new CustomEvent("Vraelis:flight:changed"));
      }

      // Surface plan downgrade if the server picked a lower tier
      const requested = res.headers.get("x-VRAELIS-tier-requested");
      const resolved = res.headers.get("x-VRAELIS-tier");
      if (requested && resolved && requested !== resolved) {
        setPlanNotice(
          `Your plan doesn't include ${requested}, replied with ${resolved} instead.`,
        );
      } else {
        setPlanNotice(null);
      }

      if (!res.ok || !res.body) {
        let detail = `chat ${res.status}`;
        try {
          const err = (await res.json()) as { error?: string };
          if (err?.error) detail = err.error;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";

      // ── Smooth render: decouple visual reveal from network jitter
      // by walking a rendered-length cursor toward the assistant
      // buffer at ~300 chars/sec via requestAnimationFrame.
      let renderedLen = 0;
      let smoothRaf: number | null = null;
      let smoothActive = true;
      // v0.1.16, was 5 (≈300 chars/sec, ~50 wpm, felt slow even
       // when the network was fast). Bumped to 14 (≈840 chars/sec,
       // ~150 wpm). Still smooth enough to feel deliberate, fast
       // enough that long answers don't feel like they're crawling.
       const CHARS_PER_FRAME = 14;
      const tickRender = () => {
        if (renderedLen < assistant.length) {
          renderedLen = Math.min(assistant.length, renderedLen + CHARS_PER_FRAME);
          const visible = assistant.slice(0, renderedLen);
          // Cross-thread guard: if the user has switched threads since
          // this send started, DON'T touch the visible messages
          // they belong to a different thread now. The server keeps
          // saving to the original thread via progressive save, so
          // nothing is lost.
          if (isStillThisThread()) {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: visible };
              }
              return copy;
            });
          }
        }
        if (smoothActive || renderedLen < assistant.length) {
          smoothRaf = requestAnimationFrame(tickRender);
        } else {
          smoothRaf = null;
        }
      };
      smoothRaf = requestAnimationFrame(tickRender);

      // Auto-TTS removed: voice is Dictate-only now. User speaks,
      // we transcribe, the AI replies in text, end of turn. The
      // sentence-streaming TTS plumbing below is kept inert (the
      // willSpeak gate stays false) but the variables are still
      // referenced downstream — leaving them in scope avoids a
      // bigger refactor for this pass.
      const willSpeak = false;
      const ttsBuf = { text: "" };
      const ttsQueue: Array<{ blob: Blob | null; done: boolean }> = [];
      let ttsNextPlay = 0;
      let ttsPlaying = false;
      let ttsAborted = false;

      const playNextChunk = () => {
        if (ttsAborted || ttsPlaying) return;
        if (ttsNextPlay >= ttsQueue.length) return;
        const item = ttsQueue[ttsNextPlay];
        if (!item.blob) return; // not loaded yet
        ttsPlaying = true;
        const url = URL.createObjectURL(item.blob);
        const audio = new Audio(url);
        audioElRef.current = audio;
        if (voiceStateRef.current !== "speaking") {
          setVoiceState("speaking");
        }

        // Interrupt handler hops between chunks
        interruptHandlerRef.current = () => {
          ttsAborted = true;
          try { audio.pause(); } catch { /* ignore */ }
          URL.revokeObjectURL(url);
          ttsPlaying = false;
          if (audioElRef.current === audio) audioElRef.current = null;
          setVoiceState("idle");
          interruptHandlerRef.current = null;
          void startRecordingRef.current();
        };

        audio.onended = () => {
          URL.revokeObjectURL(url);
          ttsPlaying = false;
          ttsNextPlay += 1;
          if (ttsNextPlay < ttsQueue.length) {
            playNextChunk();
          } else {
            // Empty queue, wait for more chunks unless streaming is done
            audioElRef.current = null;
          }
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          ttsPlaying = false;
          ttsNextPlay += 1;
          playNextChunk();
        };
        void audio.play();
      };

      const queueSentenceForTTS = (text: string) => {
        if (!willSpeak || ttsAborted) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        const item: { blob: Blob | null; done: boolean } = { blob: null, done: false };
        ttsQueue.push(item);
        if (voiceStateRef.current !== "speaking") setVoiceState("speaking");
        fetch("/api/ai/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        })
          .then((r) => (r.ok ? r.blob() : null))
          .then((blob) => {
            if (ttsAborted) return;
            item.blob = blob;
            item.done = true;
            playNextChunk();
          })
          .catch(() => {
            item.done = true;
          });
      };

      // Aggressive first-chunk strategy: get audio playing FAST.
      // After the first chunk, fall back to clean sentence boundaries.
      const SENTENCE_RE = /([.!?]+["')\]]?)(\s+|$)/;
      // v0.1.4: also break on "and"/"but"/etc. as cheap natural-pause
      // proxies so the first audio fires sooner without sounding
      // chopped. Lowered char threshold from 24\u219214 + min head 18\u219210.
      const FAST_FIRST_BREAK_RE = /([,;:\u2014\u2013]|[.!?]|\s(?:and|but|so|then)\s)/;
      let firstChunkSent = false;
      const flushSentencesFromBuffer = (final = false) => {
        if (!willSpeak) return;
        // Fast first chunk: as soon as we have ~14 chars + any natural
        // break (comma, semicolon, conjunction), send it. Audio starts
        // playing dramatically sooner.
        if (!firstChunkSent && ttsBuf.text.length >= 14) {
          const m = FAST_FIRST_BREAK_RE.exec(ttsBuf.text);
          if (m) {
            const idx = (m.index ?? 0) + m[0].length;
            const head = ttsBuf.text.slice(0, idx).trim();
            if (head.length >= 10) {
              ttsBuf.text = ttsBuf.text.slice(idx);
              queueSentenceForTTS(head);
              firstChunkSent = true;
            }
          }
        }

        let m: RegExpExecArray | null;
        while ((m = SENTENCE_RE.exec(ttsBuf.text)) !== null) {
          const idx = (m.index ?? 0) + m[0].length;
          const sentence = ttsBuf.text.slice(0, idx);
          ttsBuf.text = ttsBuf.text.slice(idx);
          if (sentence.trim().length >= 12) {
            queueSentenceForTTS(sentence);
            firstChunkSent = true;
          } else if (sentence.trim()) {
            ttsBuf.text = sentence + ttsBuf.text;
            break;
          }
        }
        if (final && ttsBuf.text.trim()) {
          queueSentenceForTTS(ttsBuf.text);
          ttsBuf.text = "";
        }
      };

      // Phase-marker parser. Server emits \x1F{json}\x1F when tools
      // fire so we can show "Searching the web…" / "Reading the
      // page…" / "Writing answer…" above the bouncing dots. Markers
      // are stripped before the text gets into the assistant buffer.
      // pendingPhaseBuf holds a half-marker that spans two chunks.
      let pendingPhaseBuf = "";
      const handlePhaseEvent = (raw: string) => {
        try {
          const evt = JSON.parse(raw) as {
            type?: string;
            label?: string;
            kind?: string;
            id?: string;
          };
          if (evt.type === "phase" && typeof evt.label === "string") {
            // "writing" phase clears the label so the pill goes away
            // once real text starts flowing, bouncing dots visually
            // hand off to the answer.
            if (evt.kind === "writing") {
              setPhaseLabel(null);
            } else {
              setPhaseLabel(evt.label);
            }
          } else if (evt.type === "assistant_id" && typeof evt.id === "string") {
            // v0.2.0 phase E, server echo of the assistant
            // message row id. Attach it to the trailing
            // placeholder so Regenerate can target a real DB
            // row without a reload first.
            const aid = evt.id;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && !last.id) {
                const copy = [...prev];
                copy[copy.length - 1] = { ...last, id: aid };
                return copy;
              }
              return prev;
            });
          }
        } catch {
          // malformed marker, ignore
        }
      };
      const stripPhaseMarkers = (incoming: string): string => {
        const combined = pendingPhaseBuf + incoming;
        const parts = combined.split("\x1F");
        // Even indices = text. Odd indices = JSON event payload.
        // If the last piece is "open" (no trailing \x1F), buffer it
        // for the next chunk so we don't fire half a marker.
        let textOut = "";
        const lastIdx = parts.length - 1;
        for (let i = 0; i < parts.length; i++) {
          const piece = parts[i];
          const isText = i % 2 === 0;
          if (isText) {
            // Last text piece is always "complete", passes through.
            textOut += piece;
          } else if (i === lastIdx) {
            // Odd-indexed AND last → no closing \x1F yet → buffer.
            pendingPhaseBuf = "\x1F" + piece;
            return textOut;
          } else {
            handlePhaseEvent(piece);
          }
        }
        pendingPhaseBuf = "";
        return textOut;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const chunkRaw = decoder.decode(value, { stream: true });
          const chunk = stripPhaseMarkers(chunkRaw);
          if (chunk) {
            assistant += chunk;
            if (willSpeak) ttsBuf.text += chunk;
          }
          // Note: NOT calling setMessages here, the rAF tick handles
          // visual updates so the reveal stays evenly paced. The
          // assistant buffer is what tickRender walks toward.
          if (willSpeak) flushSentencesFromBuffer();
        }
      }
      const tail = decoder.decode();
      if (tail) {
        assistant += tail;
        if (willSpeak) ttsBuf.text += tail;
      }
      // Empty-stream guard. If the request completed cleanly but
      // the model returned ZERO tokens (vision content moderation,
      // upstream timeout that silently closed, etc.), the catch
      // block never fires and the empty placeholder bubble lingers
      // forever. Surface an error pill + drop the placeholder so
      // the user can hit Retry instead of staring at nothing.
      //
      // Also guard the "all-thinking, no-answer" case: the model
      // exhausted max_tokens inside a <think> block, parseSections
      // matched everything as reasoning, and the rendered bubble is
      // blank even though assistantBuffer is non-empty.
      const visibleContent = parseSections(assistant)
        .filter((s) => s.type !== "thinking")
        .map((s) => s.text)
        .join("")
        .trim();
      if (!assistant.trim() || (!visibleContent && assistant.includes("<think"))) {
        if (isStillThisThread()) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && !last.content) {
              return prev.slice(0, -1);
            }
            return prev;
          });
          setChatError(
            "No reply came back. Vision can stall on dense images — try sending again, or rephrase.",
          );
        }
      }
      // Stream is done, let the smooth render drain the rest.
      smoothActive = false;
      // Wait for the visual to catch up before any post-stream work
      await new Promise<void>((resolve) => {
        const wait = () => {
          if (renderedLen >= assistant.length) {
            if (smoothRaf !== null) {
              cancelAnimationFrame(smoothRaf);
              smoothRaf = null;
            }
            resolve();
          } else {
            requestAnimationFrame(wait);
          }
        };
        wait();
      });

      if (willSpeak) {
        // Final sentence flush
        flushSentencesFromBuffer(true);
        lastTurnWasVoice.current = false;

        // After all queued chunks finish playing, kick the mic back
        // on if we're still in voice mode. Need to wait for the
        // last-chunk audio.onended.
        const allFinishedPoll = setInterval(() => {
          const pendingTTS = ttsQueue.some((i) => !i.done);
          const allPlayed = ttsNextPlay >= ttsQueue.length && !ttsPlaying;
          if (ttsAborted || (allPlayed && !pendingTTS)) {
            clearInterval(allFinishedPoll);
            if (!ttsAborted) {
              interruptHandlerRef.current = null;
              setVoiceState("idle");
              if (voiceModeRef.current) {
                void startRecordingRef.current();
              }
            }
          }
        }, 200);
      } else if (lastTurnWasVoice.current) {
        // V→T turn ended, don't TTS, don't auto-restart mic.
        // Drop voice mode so the user gets back to a normal text view.
        lastTurnWasVoice.current = false;
        setVoiceState("idle");
        // Fully exit voice mode (closes overlay), V→T is one-shot.
        if (voiceModeRef.current) {
          if (recorderRef.current && recorderRef.current.state !== "inactive") {
            recorderRef.current.stop();
          }
          if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach((t) => t.stop());
            micStreamRef.current = null;
          }
          stopAnalyser();
          setVoiceMode(false);
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      // Network-level failures (browser couldn't even reach the
      // server) come back as TypeError "Failed to fetch", useless
      // to the user. Translate to something readable.
      const isNetworkErr =
        err instanceof TypeError && /failed to fetch|networkerror/i.test(err.message);
      const msg = isNetworkErr
        ? "Couldn't reach Vraelis. Check your connection and try again."
        : err instanceof Error
        ? err.message
        : "Chat failed.";
      setChatError(msg);
      // Same cross-thread guard, don't pop a message off the new
      // thread's list because the OLD thread's send errored.
      if (isStillThisThread()) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
      }
      if (analyzingTimer !== null && typeof window !== "undefined") {
        window.clearTimeout(analyzingTimer);
      }
      if (isStillThisThread()) {
        setStreaming(false);
        setPhaseLabel(null);
      }
      void lei.refreshBalance();
      // Clear in-flight flag for this thread.
      if (typeof window !== "undefined") {
        const flightId = sendingThreadId || threadIdRef.current;
        if (flightId) {
          const flight = readFlight();
          delete flight[flightId];
          window.localStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
          window.dispatchEvent(new CustomEvent("Vraelis:flight:changed"));
        }
        window.dispatchEvent(new CustomEvent("Vraelis:threads:changed"));
        // The server-side AI title regen runs AFTER the stream ends
        // (cheap Haiku call). Fire a second refetch a few seconds
        // later so the rail picks up the new title without the user
        // having to reload or refocus the tab.
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("Vraelis:threads:changed"));
        }, 3500);
      }
    }
  }, [input, messages, tier, lei, editingTurn]);

  // v0.2.0 phase E, real Regenerate. Drop the assistant turn the
  // user wants regenerated AND the prior user turn locally, then
  // re-fire send() with the user's prompt. Server-side, the chat
  // route deletes the old assistant + everything after it via
  // regenerate_from_assistant_id, AND skips the user-save block
  // (the original user row stays in DB). Net effect: same user
  // message, fresh assistant reply, no duplicates anywhere.
  const regenerate = useCallback(
    async (assistantIdx: number, assistantId: string | null) => {
      const userIdx = assistantIdx - 1;
      if (userIdx < 0) return;
      const userMsg = messages[userIdx];
      if (!userMsg || userMsg.role !== "user" || !userMsg.content) return;
      if (!assistantId) {
        // Fallback for in-memory turns without a server id (the
        // assistant_id event raced with this click). Prefill the
        // input so the user can resubmit manually; preserves the
        // older shipped behavior.
        setInput(userMsg.content);
        textareaRef.current?.focus();
        return;
      }
      regenerateTargetRef.current = assistantId;
      const truncated = messages.slice(0, userIdx);
      setMessages(truncated);
      // Pass truncated as overrideBaseMessages so send() doesn't
      // race React state and serialise the OLD chain into the
      // network payload.
      await send(userMsg.content, false, truncated);
    },
    [messages, send],
  );

  // v0.2.0 phase G — side-by-side model duel.
  //
  // Posts the user prompt to /api/ai/duel which fans out to GPT
  // (left) + Claude (right) in parallel and multiplexes both streams
  // back as newline-delimited JSON events with a `side` tag. We hold
  // a single ChatMessage for the duel turn whose `.duel` field
  // carries both sides' state; the renderer dispatches to the
  // <DuelTurn /> component below.
  //
  // Tools (web_search, web_fetch) are intentionally OFF in duel mode
  // to keep the comparison clean. Attachments are inlined as text
  // (same as solo); images are skipped for v1 — the duel surface
  // tells the user that explicitly above the columns.
  //
  // Defined-before-sendDuel: the abandon-tracking helpers. sendDuel
  // closes over them so they have to exist first; placing them
  // here keeps the temporal-dead-zone error from popping up.
  const duelAbandonRef = useRef<{
    startedAt: number;
    plan: string;
    projectAttached: boolean;
    timer: number | null;
  } | null>(null);
  const fireDuelAbandoned = useCallback(
    (reason: "timeout" | "navigation") => {
      const ctx = duelAbandonRef.current;
      if (!ctx) return;
      duelAbandonRef.current = null;
      if (ctx.timer !== null && typeof window !== "undefined") {
        window.clearTimeout(ctx.timer);
      }
      trackClientEvent("duel_abandoned", {
        reason,
        plan: ctx.plan,
        project_attached: ctx.projectAttached,
        time_since_start_ms: Date.now() - ctx.startedAt,
      });
    },
    [],
  );
  const clearDuelAbandon = useCallback(() => {
    const ctx = duelAbandonRef.current;
    if (!ctx) return;
    if (ctx.timer !== null && typeof window !== "undefined") {
      window.clearTimeout(ctx.timer);
    }
    duelAbandonRef.current = null;
  }, []);
  // Beacon-fire on tab close / nav-away if a duel is in flight.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnload = () => {
      if (duelAbandonRef.current) fireDuelAbandoned("navigation");
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [fireDuelAbandoned]);

  const sendDuel = useCallback(
    async (overrideText?: string, overrideBaseMessages?: ChatMessage[]) => {
      const baseText = (overrideText ?? input).trim();
      const attachmentBlocks: string[] = [];
      let droppedImages = 0;
      for (const att of lei.attachments) {
        if (att.kind === "file" || att.kind === "code") {
          if (att.text) {
            attachmentBlocks.push(
              `\n\n--- Attached: ${att.name} (${att.mime}) ---\n${att.text}\n--- end ---`,
            );
          }
        } else if (att.kind === "image") {
          droppedImages += 1;
        } else {
          attachmentBlocks.push(`\n\n[Attached ${att.kind}: ${att.name}]`);
        }
      }
      let text = baseText + attachmentBlocks.join("");
      if (droppedImages > 0) {
        text = `${text}\n\n[Note: ${droppedImages} image attachment(s) were not sent to the duel — image input is solo-mode only for now.]`;
      }
      if (!text) return;

      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const baseMessages = overrideBaseMessages ?? messages;
      const payloadMessages = [
        ...baseMessages
          .filter((m) => !m.duel)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];
      const userMsg: ChatMessage = { role: "user", content: text };
      const initialDuel: DuelTurnState = {
        groupId: null,
        threadId: threadIdRef.current,
        streaming: true,
        left: {
          side: "left",
          model: "GPT",
          content: "",
          done: false,
          phaseLabel: "Thinking…",
        },
        right: {
          side: "right",
          model: "Claude",
          content: "",
          done: false,
          phaseLabel: "Thinking…",
        },
      };
      const duelMsg: ChatMessage = {
        role: "assistant",
        content: "",
        duel: initialDuel,
      };
      setMessages([...baseMessages, userMsg, duelMsg]);
      setInput("");
      setStreaming(true);
      setChatError(null);
      setImageRetry(null);
      lei.clearAttachments();
      // Start the abandon-tracking window. If the meta event
      // arrives we clear it (= duel completed); else the 12s
      // timer fires duel_abandoned with reason: "timeout".
      // pagehide/beforeunload handles the nav-away case.
      if (typeof window !== "undefined") {
        const projectAttached = !!getActiveProjectId();
        duelAbandonRef.current = {
          startedAt: Date.now(),
          plan,
          projectAttached,
          timer: window.setTimeout(() => {
            fireDuelAbandoned("timeout");
          }, 12_000),
        };
      }

      let clientTimezone = "UTC";
      let clientTimeLabel = new Date().toISOString();
      try {
        clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {}
      try {
        clientTimeLabel = new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(new Date());
      } catch {}

      const ac = new AbortController();
      abortRef.current = ac;

      const updateDuel = (mutator: (cur: DuelTurnState) => DuelTurnState) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.duel) {
            copy[copy.length - 1] = { ...last, duel: mutator(last.duel) };
          }
          return copy;
        });
      };

      // Same one-shot pendingProjectIdRef consume pattern as send()
      // — capture, then clear + strip ?project= from the URL so a
      // refresh doesn't re-attach.
      const duelPendingProject = pendingProjectIdRef.current;
      if (duelPendingProject) {
        pendingProjectIdRef.current = null;
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.get("project")) {
            url.searchParams.delete("project");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }
      }
      try {
        const res = await fetch("/api/ai/duel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: payloadMessages,
            thread_id: threadIdRef.current ?? undefined,
            project_id: threadIdRef.current
              ? undefined
              : (duelPendingProject ?? getActiveProjectId() ?? undefined),
            client_time_iso: new Date().toISOString(),
            client_timezone: clientTimezone,
            client_time_label: clientTimeLabel,
          }),
          signal: ac.signal,
        });
        const echoedThreadId = res.headers.get("x-VRAELIS-thread-id");
        if (echoedThreadId && echoedThreadId !== threadIdRef.current) {
          setThreadId(echoedThreadId);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("thread", echoedThreadId);
            url.searchParams.delete("new");
            window.history.replaceState({}, "", url.pathname + url.search);
            window.dispatchEvent(new CustomEvent("Vraelis:threads:changed"));
          }
        }
        if (!res.ok || !res.body) {
          let detail = `duel ${res.status}`;
          try {
            const err = (await res.json()) as { error?: string };
            if (err?.error) detail = err.error;
          } catch {}
          throw new Error(detail);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // Newline-delimited JSON, peel off complete lines.
          let nl = buf.indexOf("\n");
          while (nl >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) {
              try {
                const evt = JSON.parse(line) as {
                  side?: DuelSideKey;
                  type?: string;
                  text?: string;
                  label?: string;
                  id?: string;
                  cost?: number;
                  input_tokens?: number;
                  output_tokens?: number;
                  message?: string;
                  model?: string;
                  group_id?: string;
                  thread_id?: string | null;
                };
                if (evt.type === "meta") {
                  updateDuel((cur) => ({
                    ...cur,
                    groupId: evt.group_id ?? cur.groupId,
                    threadId: evt.thread_id ?? cur.threadId,
                  }));
                  // Server confirmed duel finished — cancel
                  // the abandon timer so we don't false-positive
                  // when streaming legitimately ran past 12s.
                  clearDuelAbandon();
                } else if (evt.side === "left" || evt.side === "right") {
                  const which = evt.side;
                  if (evt.type === "assistant_id" && evt.id) {
                    updateDuel((cur) => ({
                      ...cur,
                      [which]: { ...cur[which], messageId: evt.id },
                    }));
                  } else if (evt.type === "phase") {
                    updateDuel((cur) => ({
                      ...cur,
                      [which]: { ...cur[which], phaseLabel: evt.label ?? null },
                    }));
                  } else if (evt.type === "text" && typeof evt.text === "string") {
                    updateDuel((cur) => ({
                      ...cur,
                      [which]: {
                        ...cur[which],
                        content: cur[which].content + evt.text,
                        phaseLabel: null,
                      },
                    }));
                  } else if (evt.type === "done") {
                    updateDuel((cur) => ({
                      ...cur,
                      [which]: {
                        ...cur[which],
                        done: true,
                        cost: evt.cost,
                        inputTokens: evt.input_tokens,
                        outputTokens: evt.output_tokens,
                        model:
                          evt.model ??
                          (which === "left" ? "GPT" : "Claude"),
                        phaseLabel: null,
                      },
                    }));
                  } else if (evt.type === "error") {
                    updateDuel((cur) => ({
                      ...cur,
                      [which]: {
                        ...cur[which],
                        done: true,
                        error: evt.message ?? "Stream failed.",
                        phaseLabel: null,
                      },
                    }));
                  }
                }
              } catch {
                // Malformed line, skip
              }
            }
            nl = buf.indexOf("\n");
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          const isNetworkErr =
            err instanceof TypeError &&
            /failed to fetch|networkerror/i.test(err.message);
          const msg = isNetworkErr
            ? "Couldn't reach Vraelis. Check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Duel failed.";
          setChatError(msg);
          // Drop the empty duel placeholder so the error pill stands alone.
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (
              last?.duel &&
              !last.duel.left.content &&
              !last.duel.right.content
            ) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        // Always force both sides done + clear streaming, regardless
        // of how we exited (clean finish, abort, network drop, server
        // forgot to emit 'done'). Without this, a side that never got
        // its 'done' event leaves payload.done=false, which keeps
        // CodeBlock's streaming prop true and the VRAELISCardSkeleton
        // ("Building card…") hangs around forever on any code-block
        // or card-shaped JSON the model emitted.
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.duel) {
            copy[copy.length - 1] = {
              ...last,
              duel: {
                ...last.duel,
                streaming: false,
                left: {
                  ...last.duel.left,
                  done: true,
                  phaseLabel: null,
                },
                right: {
                  ...last.duel.right,
                  done: true,
                  phaseLabel: null,
                },
              },
            };
          }
          return copy;
        });
        setStreaming(false);
        setPhaseLabel(null);
        void lei.refreshBalance();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("Vraelis:threads:changed"));
        }
      }
    },
    [input, messages, lei, plan, fireDuelAbandoned, clearDuelAbandon],
  );

  // Stash sendDuel in a ref so global event listeners (pinned-prompt
  // run-as-Duel) can call the latest closure without re-binding the
  // listener on every messages-state change.
  const sendDuelRef = useRef(sendDuel);
  useEffect(() => {
    sendDuelRef.current = sendDuel;
  }, [sendDuel]);

  // v0.2.0 phase G+ — winner-moment upsell. Counts how many duels
  // the user has resolved this session. Once they cross the
  // threshold (3 picks), the action row underneath the duel shows
  // a subtle "Liking Duel? Upgrade for more comparisons →" link
  // that goes to /account/plan. Suppressed when the user is on
  // an unlimited plan (Pro / Teams / Enterprise / Power Pack /
  // Copilot Pro Pack — anyone who can't meaningfully upgrade)
  // OR when they've dismissed it once already.
  const DUEL_UPSELL_AFTER = 3;
  const [duelPickCount, setDuelPickCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.sessionStorage.getItem("Vraelis.duelPickCount");
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  });
  const [duelUpsellDismissed, setDuelUpsellDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("Vraelis.duelUpsellDismissed") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "Vraelis.duelPickCount",
      String(duelPickCount),
    );
  }, [duelPickCount]);
  const showDuelUpsell =
    !hasUnlimitedChat &&
    !duelUpsellDismissed &&
    duelPickCount >= DUEL_UPSELL_AFTER;
  // Fire duel_upsell_shown exactly once per session, the first time
  // the upsell becomes eligible to render. Stops us from spamming
  // the metric on every render once the threshold is crossed.
  const upsellShownReportedRef = useRef(false);
  useEffect(() => {
    if (showDuelUpsell && !upsellShownReportedRef.current) {
      upsellShownReportedRef.current = true;
      trackClientEvent("duel_upsell_shown", { picks: duelPickCount });
    }
  }, [showDuelUpsell, duelPickCount]);
  const dismissDuelUpsell = () => {
    setDuelUpsellDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("Vraelis.duelUpsellDismissed", "1");
    }
    trackClientEvent("duel_upsell_dismissed");
  };

  // Pick a winner for an open duel turn. Tells the server to mark
  // the chosen row + delete the loser, then collapses the duel
  // message in local state into a regular solo assistant turn so
  // the rest of the thread reads as one canonical reply. Also
  // re-focuses the input + dispatches a global event so the
  // active project's scoreboard increments instantly.
  const pickDuelWinner = useCallback(
    async (msgIndex: number, side: DuelSideKey) => {
      const target = messages[msgIndex];
      if (!target?.duel) return;
      const { groupId, threadId, left, right } = target.duel;
      const winnerPayload = side === "left" ? left : right;
      // Local collapse first for instant UX. Server failure rolls back.
      const collapsed: ChatMessage = {
        role: "assistant",
        content: winnerPayload.content,
        id: winnerPayload.messageId,
      };
      setMessages((prev) => {
        const copy = [...prev];
        copy[msgIndex] = collapsed;
        return copy;
      });
      // Optimistic scoreboard bump for any project panel watching.
      // Detail carries the active project id at click time so panels
      // for OTHER projects don't increment by accident.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("Vraelis:duel-pick", {
            detail: { side, projectId: getActiveProjectId() },
          }),
        );
      }
      // Bump the per-session pick counter that drives the
      // winner-moment upsell.
      setDuelPickCount((n) => n + 1);
      trackClientEvent("duel_winner_picked", { side });
      // Send focus back to the composer so the user keeps typing.
      // requestAnimationFrame so React commits the collapse first.
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      }
      const tid = threadId ?? threadIdRef.current;
      if (!tid || !groupId) return;
      try {
        const res = await fetch("/api/ai/duel/winner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thread_id: tid,
            group_id: groupId,
            side,
          }),
        });
        if (!res.ok) {
          // Roll back to the duel state so the user can try again.
          setMessages((prev) => {
            const copy = [...prev];
            copy[msgIndex] = target;
            return copy;
          });
          setChatError("Couldn't save your pick. Try again.");
        }
      } catch {
        setMessages((prev) => {
          const copy = [...prev];
          copy[msgIndex] = target;
          return copy;
        });
        setChatError("Couldn't save your pick. Try again.");
      }
    },
    [messages],
  );

  // Retry both sides of a duel: discard the current pair server-side,
  // remove the duel message locally, then re-fire sendDuel against
  // the same user prompt that produced it.
  const retryDuelBoth = useCallback(
    async (msgIndex: number) => {
      const target = messages[msgIndex];
      if (!target?.duel) return;
      const userPrompt = messages[msgIndex - 1]?.content;
      if (!userPrompt) return;
      const { groupId, threadId } = target.duel;
      const tid = threadId ?? threadIdRef.current;
      if (tid && groupId) {
        try {
          await fetch(
            `/api/ai/duel?thread_id=${encodeURIComponent(tid)}&group_id=${encodeURIComponent(groupId)}`,
            { method: "DELETE" },
          );
        } catch {
          // best-effort, server-side cleanup may fail; we still re-run
        }
      }
      // Drop the failed/abandoned duel + its preceding user msg so
      // sendDuel rebuilds them clean.
      const truncated = messages.slice(0, msgIndex - 1);
      setMessages(truncated);
      trackClientEvent("duel_retry_both");
      await sendDuel(userPrompt, truncated);
    },
    [messages, sendDuel],
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
      setPhaseLabel(null);
      // Mark the visible last assistant message as cancelled and
      // tell the server to persist it as such, so the saved
      // conversation reflects the user's choice instead of just
      // ending mid-sentence.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          const tail = last.content && !last.content.endsWith("\n")
            ? "\n\n_(Cancelled by you.)_"
            : "_(Cancelled by you.)_";
          const newContent = (last.content || "") + tail;
          // Server-side persist via PATCH to the latest message in
          // this thread. Find it in the list returned by /api/threads/[id].
          const tid = threadIdRef.current;
          if (tid) {
            void (async () => {
              try {
                const detailRes = await fetch(`/api/threads/${tid}`, { cache: "no-store" });
                if (!detailRes.ok) return;
                const detail = (await detailRes.json()) as {
                  messages?: Array<{ id: string; role: string }>;
                };
                const lastAsst = [...(detail.messages ?? [])]
                  .reverse()
                  .find((m) => m.role === "assistant");
                if (!lastAsst?.id) return;
                await fetch(`/api/threads/${tid}/messages/${lastAsst.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: newContent }),
                });
              } catch {
                // best-effort
              }
            })();
          }
          const copy = [...prev];
          copy[copy.length - 1] = { ...last, content: newContent };
          return copy;
        }
        return prev;
      });
      // Clear the in-flight flag immediately so the rail dot stops
      // pulsing and the floating pill disappears.
      if (typeof window !== "undefined") {
        const tid = threadIdRef.current;
        if (tid) {
          const flight = readFlight();
          delete flight[tid];
          window.localStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
          window.dispatchEvent(new CustomEvent("Vraelis:flight:changed"));
        }
      }
    }
  }, []);

  // One-shot image generation. Reads the input as the prompt, appends
  // a user turn + an assistant turn with the image embedded as
  // markdown (`![](url)`), and clears the input. Streaming is for
  // text, image gen is one POST + one render.
  const generateImageFromInput = useCallback(async (overridePrompt?: string) => {
    const prompt = (overridePrompt ?? input).trim();
    if (!prompt || generatingImage) return;

    // Detect multi-image intent in the prompt. Patterns we catch:
    //   "generate 4 images of a cat"
    //   "make three variations"
    //   "draw 2 pictures"
    //   "give me 4 of a sunset"
    // Capped at 4 (matches API). Default 1 if nothing matches.
    const NUMBER_WORDS: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4,
    };
    let count = 1;
    const numericMatch = prompt.match(/\b(\d+)\s+(?:image|picture|pic|photo|illustration|art|drawing|painting|sketch|portrait|render|variation|version|of)/i);
    const wordMatch = prompt.match(/\b(one|two|three|four)\s+(?:image|picture|pic|photo|illustration|art|drawing|painting|sketch|portrait|render|variation|version)/i);
    if (numericMatch) {
      const n = parseInt(numericMatch[1], 10);
      if (Number.isFinite(n)) count = Math.min(4, Math.max(1, n));
    } else if (wordMatch) {
      count = NUMBER_WORDS[wordMatch[1].toLowerCase()] ?? 1;
    }

    const userMsg: ChatMessage = { role: "user", content: prompt };
    // v0.2.0 phase E, staged image-gen status. The OpenAI image
    // route is one POST + one render so we can't stream phases
    // back; client-side timers fake the stages so the bubble
    // never feels frozen during a 10-60s gen. The catch handler
    // drops any "Generating " placeholder regardless of which
    // stage it stopped on.
    const placeholderPlural = count > 1;
    const stage1 = "Preparing prompt…";
    const stage2 = placeholderPlural
      ? `Generating ${count} images…`
      : "Generating image…";
    const stage3 = "Finalizing…";
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: stage1 }]);
    const swapStage = (next: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last?.role === "assistant" &&
          /^(Preparing|Generating|Finalizing)/.test(last.content)
        ) {
          const copy = [...prev];
          copy[copy.length - 1] = { ...last, content: next };
          return copy;
        }
        return prev;
      });
    };
    const stageTimer1 =
      typeof window !== "undefined"
        ? window.setTimeout(() => swapStage(stage2), 1500)
        : null;
    const stageTimer2 =
      typeof window !== "undefined"
        ? window.setTimeout(() => swapStage(stage3), 12000)
        : null;
    setInput("");
    setGeneratingImage(true);
    setChatError(null);
    setImageRetry(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("Vraelis.lastActivity", String(Date.now()));
    }

    // Mark the thread (or the to-be-created one) as in-flight so the
    // rail's pulsing dot + the floating Back-to-chat pill work for
    // image gen the same way they do for text chat.
    const tidAtStart = threadIdRef.current;
    const writeFlight = (id: string) => {
      if (typeof window === "undefined") return;
      const flight = readFlight();
      flight[id] = { startedAt: Date.now() };
      window.localStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
      window.dispatchEvent(new CustomEvent("Vraelis:flight:changed"));
    };
    const clearFlight = (id: string | null) => {
      if (typeof window === "undefined" || !id) return;
      const flight = readFlight();
      delete flight[id];
      window.localStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
      window.dispatchEvent(new CustomEvent("Vraelis:flight:changed"));
    };
    if (tidAtStart) writeFlight(tidAtStart);

    // Wire image gen into the same Stop button path the chat stream
    // uses. Without an AbortController on the fetch, hitting Stop
    // (or navigating away) does nothing — the request keeps running
    // upstream and the placeholder bubble sits on "Generating image…"
    // until the response finally lands.
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          count,
          thread_id: tidAtStart ?? undefined,
          // v0.2.0, route image-gen turns into the active project
          // when no thread is in flight yet. Server resolves /
          // creates the thread and attaches it to the project on
          // creation. No server-side image-gen context injection
          // (text-only wedge for now); this is just thread routing.
          project_id: tidAtStart ? undefined : getActiveProjectId() ?? undefined,
        }),
        signal: ac.signal,
      });
      // Server resolves / creates the thread + persists user prompt
      // immediately. Capture the echoed id so follow-up chat turns
      // continue the same conversation, and so the rail picks it up.
      const echoedThreadId = res.headers.get("x-VRAELIS-thread-id");
      if (echoedThreadId && echoedThreadId !== threadIdRef.current) {
        setThreadId(echoedThreadId);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("thread", echoedThreadId);
          url.searchParams.delete("new");
          window.history.replaceState({}, "", url.pathname + url.search);
          window.dispatchEvent(new CustomEvent("Vraelis:threads:changed"));
          // Hop the in-flight flag onto the now-known id.
          writeFlight(echoedThreadId);
        }
      }
      if (!res.ok) {
        let detail = `image ${res.status}`;
        try {
          const err = (await res.json()) as { error?: string };
          if (err?.error) detail = err.error;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }
      const data = (await res.json()) as {
        url: string;
        urls?: string[];
        revised_prompt?: string;
      };
      // Multi-image: render each as its own ![] block, markdown
      // renderer + the new .webchat-image-grid CSS detects two or
      // more consecutive images and lays them out in a grid.
      const allUrls = data.urls && data.urls.length > 0 ? data.urls : [data.url];
      const imageMarkdown = allUrls
        .map((u, i) => `![generated image ${i + 1}](${u})`)
        .join("\n\n");
      const caption = data.revised_prompt
        ? `*${data.revised_prompt}*\n\n${imageMarkdown}`
        : imageMarkdown;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: caption };
        }
        return next;
      });
      // Server already persisted the assistant turn, fire the rail
      // refresh so the title gen / sidebar count picks it up.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("Vraelis:threads:changed"));
      }
    } catch (err) {
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      const message = aborted
        ? null
        : err instanceof Error
          ? err.message
          : "Image generation failed.";
      if (message) {
        // Surface a dedicated retry pill instead of a generic chat
        // error so the user can re-fire the same prompt with one
        // click. Generic chatError stays clear; ImageRetryPill
        // owns this failure mode end-to-end.
        setImageRetry({ prompt, message });
      }
      // Drop the placeholder so the chat doesn't show "Generating…"
      // forever. Match anything that STARTS with "Generating "
      // because the Stop button may have appended a cancellation
      // tail to the same bubble before this catch ran.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.role === "assistant" &&
          /^(Preparing|Generating|Finalizing)/.test(last.content)
        ) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      if (stageTimer1 !== null && typeof window !== "undefined") {
        window.clearTimeout(stageTimer1);
      }
      if (stageTimer2 !== null && typeof window !== "undefined") {
        window.clearTimeout(stageTimer2);
      }
      setGeneratingImage(false);
      clearFlight(threadIdRef.current);
    }
  }, [generatingImage, input]);

  // Voice flow, single button cycle:
  //   idle → click → ask mic perm → record (button = Stop)
  //   stop → transcribe → auto-send → AI replies → TTS plays back
  //   playback ends → idle
  const startRecording = useCallback(async () => {
    if (isFreePlan) return;
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
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        if (!voiceModeRef.current && micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
          stopAnalyser();
        }
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        // v0.1.16 r2, only skip if blob is REALLY empty. 5000
        // was rejecting real low-gain speech. 1500 = bare-empty.
        if (blob.size < 1500) {
          setVoiceState("idle");
          if (voiceModeRef.current) {
            // V→V: re-arm the mic for the next attempt.
            void startRecordingRef.current();
          }
          return;
        }
        setVoiceState("transcribing");
        try {
          const form = new FormData();
          form.append("audio", blob, "audio.webm");
          const res = await fetch("/api/ai/voice/transcribe", {
            method: "POST",
            body: form,
          });
          if (!res.ok) throw new Error(`transcribe ${res.status}`);
          const data = (await res.json()) as { text: string };
          const transcribed = data.text.trim();
          // v0.1.16, Hallucination filter. Whisper often returns
          // these short canned strings when the audio is silence,
          // music, or noise. If we get one of those AND the audio
          // was short, treat it as silence and re-arm without
          // sending a ghost message to the model.
          if (isLikelyWhisperHallucination(transcribed, blob.size)) {
            setVoiceState("idle");
            if (voiceModeRef.current) {
              void startRecordingRef.current();
            }
            return;
          }
          if (transcribed) {
            setVoiceState("idle");
            await send(transcribed, true);
          } else {
            setVoiceState("idle");
            if (voiceModeRef.current) {
              void startRecordingRef.current();
            }
          }
        } catch (err) {
          setChatError(err instanceof Error ? err.message : "Transcribe failed.");
          setVoiceState("idle");
        }
      };
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      silenceStartRef.current = null;
      heardSpeechRef.current = false;
      recorder.start();
      setVoiceState("recording");
      // (Web Speech live preview removed — flaky cross-browser,
      // and gpt-4o-mini-transcribe is fast enough server-side that
      // the wait is negligible. One source of truth = simpler code,
      // fewer bugs.)
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Mic access denied.");
      setVoiceState("idle");
    }
  }, [isFreePlan, send, stopAnalyser, beginVolumeLoop]);

  // Keep ref pointing at latest startRecording (for the conversational
  // loop in send())
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const enterVoiceMode = useCallback(async () => {
    // Voice is now Dictate-only: click mic → record → click again
    // to send. No full-screen overlay, no auto-TTS, no auto-loop.
    // The V2V "Talk" mode was the bulk of the "unnecessary stuff"
    // user complaint and added a lot of state machine complexity
    // for marginal value. Removed entirely; the v2v style toggle
    // now no-ops (kept the read so older settings don't error).
    await startRecording();
  }, [startRecording]);

  const exitVoiceMode = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    stopAnalyser();
    setVoiceState("idle");
    setVoiceMode(false);
  }, [stopAnalyser]);

  const stopVoice = useCallback(() => {
    // Three cases, all routed through the same button:
    if (voiceState === "recording") {
      const r = recorderRef.current;
      if (r && r.state !== "inactive") r.stop();
    } else if (voiceState === "speaking") {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      setVoiceState("idle");
    }
  }, [voiceState]);

  const showEmpty = messages.length === 0;
  const allowedTiers = new Set(tiers.map((t) => t.tier));

  // Recent threads pulled lazily for the empty-state "Pick up where
  // you left off" section. Different from the chat history rail's
  // copy of the same data — they don't share state, but the
  // duplicate fetch is cheap and the rail isn't always mounted
  // (mobile hides it). If the user signs out or has no history
  // we just hide the section.
  const [recentThreads, setRecentThreads] = useState<
    Array<{ id: string; title: string; updated_at?: string }> | null
  >(null);
  useEffect(() => {
    if (!showEmpty) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/threads", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setRecentThreads([]);
          return;
        }
        const data = (await res.json()) as {
          threads?: Array<{ id: string; title: string; updated_at?: string }>;
        };
        if (!cancelled) {
          setRecentThreads((data.threads ?? []).slice(0, 2));
        }
      } catch {
        if (!cancelled) setRecentThreads([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showEmpty]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // textareaRef is declared at the top of the component so the
  // document-level paste handler can use it. Reused here.

  // v0.1.16, Desktop-style "type anywhere to focus the input" +
  // '/' shortcut. If the user starts pressing keys without focusing
  // the textarea first, we redirect the keystroke into it. Skip
  // when an input/textarea/contenteditable is already focused, when
  // any modifier key is held (don't hijack browser shortcuts), and
  // when voice mode is active (mic owns the conversation).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (voiceMode) return;

      // '/' is a power-user shortcut: just focus, don't insert.
      if (e.key === "/") {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }

      // Single printable character → focus + append. Browsers don't
      // forward the in-flight keystroke after focus() in the same
      // tick, so we have to insert it ourselves.
      if (e.key.length === 1) {
        e.preventDefault();
        setInput((prev) => prev + e.key);
        // Defer the focus so React commits the input state first.
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          // Drop the cursor at the end so further typing appends.
          const ta = textareaRef.current;
          if (ta) ta.selectionStart = ta.selectionEnd = ta.value.length;
        });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [voiceMode]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  // Close the + menu on outside click / Escape
  useEffect(() => {
    if (!plusMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlusMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [plusMenuOpen]);
  const hasImageAttached = lei.attachments.some((a) => a.kind === "image");
  const hasVideoAttached = lei.attachments.some((a) => a.kind === "video");
  const costPreview = previewCreditCost({
    inputText: input,
    hasImage: hasImageAttached,
    hasVideo: hasVideoAttached,
    voiceMode,
    plan,
  });
  // Talk-mode overlay removed entirely. Voice is Dictate-only now;
  // the user clicks the mic button next to Send, records, clicks
  // again, and the transcript drops into the input. No overlay,
  // no auto-TTS, no auto-loop.

  return (
    <section className="webchat">

      <div className="webchat-bar">
        <div className="webchat-bar-left">
          <span className="webchat-eyebrow">vraelis-1</span>
          <span className="webchat-account">{email}</span>
        </div>
        <div className="webchat-bar-right">
          <div className="webchat-picker">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="webchat-picker-trigger"
            >
              {ALL_TIERS.find((t) => t.tier === tier)?.display_name ??
                "vraelis-1"}
              <span className="webchat-picker-caret">▾</span>
            </button>
            {pickerOpen && (
              <div className="webchat-picker-menu">
                {ALL_TIERS.map((opt) => {
                  const locked = !allowedTiers.has(opt.tier);
                  return (
                    <button
                      key={opt.tier}
                      type="button"
                      onClick={() => {
                        if (!locked) {
                          setTier(opt.tier);
                          setPickerOpen(false);
                        }
                      }}
                      disabled={locked}
                      className={`webchat-picker-item${opt.tier === tier ? " active" : ""}${locked ? " locked" : ""}`}
                    >
                      <div className="webchat-picker-item-name">
                        {opt.display_name}
                        {locked && (
                          <span className="webchat-picker-lock">Upgrade</span>
                        )}
                      </div>
                      <div className="webchat-picker-item-blurb">{opt.blurb}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <VoiceStyleToggle
            value={lei.voiceStyle}
            onChange={lei.setVoiceStyle}
          />
          <CreditChip balance={lei.creditBalance} plan={plan} />
          {/* "Plan: Free" standalone label removed; the credit chip
              + the cost preview already convey plan state, the bare
              text was redundant chrome. */}
        </div>
      </div>

      {planNotice && (
        <div className="webchat-notice">
          {planNotice}
          <button
            type="button"
            onClick={() => setPlanNotice(null)}
            className="webchat-notice-x"
          >
            ×
          </button>
        </div>
      )}

      {/* Desktop CTA card removed from the empty state, it dominated
          the page before the user even reached the chat. The desktop
          link still lives in the dashboard nav (Bench / Desktop). */}

      <div className="webchat-scroll" ref={scrollRef} onScroll={onScroll}>
        {/* Phase H — project-attached strip. Shows whether the
            current thread is already filed under a project (existing
            thread, green "In project" badge) or will be on first send
            (new thread, amber "Will save here" badge). The distinction
            makes project membership unambiguous at a glance. */}
        {attachedProject && (
          <div
            className={`webchat-project-strip${threadId === null ? " webchat-project-strip--pending" : ""}`}
            role="note"
          >
            <span className="webchat-project-strip-icon" aria-hidden>◇</span>
            <span className="webchat-project-strip-name">
              {attachedProject.name}
            </span>
            <span className="webchat-project-strip-sep" aria-hidden>·</span>
            <span className="webchat-project-strip-meta">
              {threadId === null
                ? "new chat"
                : `${attachedProject.pinCount} ${attachedProject.pinCount === 1 ? "pin" : "pins"}`}
            </span>
            {threadId === null ? (
              <span className="webchat-project-strip-pending">Will save here</span>
            ) : (
              <span className="webchat-project-strip-active">In project</span>
            )}
          </div>
        )}
        {showEmpty ? (
          <div className="webchat-empty">
            <div className="webchat-empty-mark">Vraelis</div>
            <h2>How can I help?</h2>
            <p>
              Type, talk, or drop something in. Chat, files, memory, voice — all in one place.
            </p>
            {attachedProject && (
              <div className="webchat-empty-project-note">
                <span className="webchat-empty-project-note-icon">◇</span>
                Chat will be saved in{" "}
                <strong>{attachedProject.name}</strong>
              </div>
            )}
            {recentThreads && recentThreads.length > 0 && (
              <div className="webchat-empty-continue">
                <div className="webchat-empty-continue-label">
                  Pick up where you left off
                </div>
                <div className="webchat-empty-continue-list">
                  {recentThreads.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="webchat-empty-continue-item"
                      onClick={() => router.push(`/app?thread=${t.id}`)}
                    >
                      <span className="webchat-empty-continue-arrow" aria-hidden>
                        ↻
                      </span>
                      <span className="webchat-empty-continue-title">
                        {t.title || "Untitled chat"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="webchat-list">
            {/* Phase H — pre-429 low-chat banner. Plan-agnostic now
                that Duel is opt-in per message; fires whenever the
                user is on a capped plan and within 5 chats of the
                cap. Suppressed while the winner-moment upsell is
                visible so we never stack two CTAs. */}
            {!hasUnlimitedChat &&
              !showDuelUpsell &&
              ((typeof chatRemaining === "number" && chatRemaining <= 5) ||
                (typeof duelRemaining === "number" && duelRemaining <= 1)) && (
                <div className="webchat-low-chat-banner" role="note">
                  <span className="webchat-low-chat-banner-text">
                    {typeof duelRemaining === "number" && duelRemaining <= 1
                      ? duelRemaining === 0
                        ? "You've used your weekly duels."
                        : "1 duel left this week."
                      : `${chatRemaining} chats left this week.`}
                    <span className="webchat-low-chat-banner-sub">
                      Upgrade to keep going.
                    </span>
                  </span>
                  <a
                    className="webchat-low-chat-banner-cta"
                    href="/account/plan"
                    onClick={() =>
                      trackClientEvent("upgrade_clicked", {
                        source: "low_chat_banner",
                      })
                    }
                  >
                    Upgrade →
                  </a>
                </div>
              )}
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              // Inflight = empty assistant placeholder at the end
              // of the list. Used to require `streaming === true`
              // too, but state-batching / URL-update races could
              // flip streaming off momentarily and the phase pill
              // + dots would vanish, leaving an empty bubble for
              // 10+ seconds while waiting on first byte. Empty
              // placeholders always get the inflight UI now;
              // they're either filling in (smooth render) or
              // getting removed (empty-stream guard).
              const isInflight =
                isLast && m.role === "assistant" && m.content === "";
              const isStillStreaming =
                isLast && m.role === "assistant" && streaming && m.content !== "";
              // v0.2.0 phase G — duel-turn render branch. A populated
              // .duel field means this message is a side-by-side
              // comparison; render the dedicated component which
              // breaks out of the 700px column for that turn only.
              if (m.duel) {
                return (
                  <div key={i} className="webchat-msg webchat-msg--duel">
                    <DuelTurn
                      state={m.duel}
                      onPickWinner={(side) => void pickDuelWinner(i, side)}
                      onRetryBoth={() => void retryDuelBoth(i)}
                      showUpsell={showDuelUpsell}
                      onDismissUpsell={dismissDuelUpsell}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`webchat-msg webchat-msg--${m.role}`}
                >
                  {isInflight ? (
                    <div className="webchat-inflight">
                      <div className="webchat-phase-pill" aria-live="polite">
                        {/* keyed span so React remounts the
                            text node on label change, re-running
                            the CSS fade. Looks like a soft
                            crossfade between Thinking ->
                            Analyzing -> Searching -> Writing
                            instead of an abrupt text swap.
                            Defaults to "Thinking…" when phaseLabel
                            is null so the user always sees an
                            indicator (vs. an empty bubble during
                            slow first-byte waits). */}
                        <span
                          key={phaseLabel ?? "thinking"}
                          className="webchat-phase-text"
                        >
                          {phaseLabel ?? "Thinking…"}
                        </span>
                      </div>
                      <WebBounceDots />
                    </div>
                  ) : m.role === "assistant" ? (
                    <WebAssistantBubble
                      content={m.content}
                      streaming={isStillStreaming}
                      userPrompt={
                        i > 0 && messages[i - 1]?.role === "user"
                          ? messages[i - 1].content
                          : undefined
                      }
                      onIterate={(prompt) => {
                        void generateImageFromInput(prompt);
                      }}
                      onPrefillInput={(text) => {
                        setInput(text);
                        textareaRef.current?.focus();
                      }}
                      onRegenerate={
                        // Real regenerate: drop the assistant
                        // turn locally + tell the server to
                        // delete it from chat_messages, then
                        // stream a fresh reply for the same
                        // user prompt. Hidden while another
                        // turn is in flight.
                        streaming || generatingImage
                          ? undefined
                          : () => {
                              void regenerate(i, m.id ?? null);
                            }
                      }
                    />
                  ) : (
                    <WebUserBubble
                      content={m.content}
                      images={m.images}
                      isEditing={editingTurn?.index === i}
                      // Hide Edit while a stream is running so a
                      // mid-flight click can't queue a truncate
                      // against an active assistant turn the
                      // server is still writing to.
                      onEdit={
                        streaming || generatingImage
                          ? undefined
                          : (text) => {
                              setEditingTurn({
                                index: i,
                                messageId: m.id ?? null,
                              });
                              setInput(text);
                              textareaRef.current?.focus();
                            }
                      }
                      onCancelEdit={() => {
                        setEditingTurn(null);
                        setInput("");
                      }}
                    />
                  )}
                </div>
              );
            })}
            {chatError && (
              <ChatErrorPill
                message={chatError}
                onRetry={() => {
                  // Re-run the most recent user prompt. Pulled from
                  // messages state so retry survives across mounts
                  // and works for both fresh sends and stale errors.
                  const lastUser = [...messages]
                    .reverse()
                    .find((m) => m.role === "user");
                  if (!lastUser?.content) return;
                  setChatError(null);
                  void send(lastUser.content);
                }}
              />
            )}
            {imageRetry && (
              <ImageRetryPill
                message={imageRetry.message}
                prompt={imageRetry.prompt}
                onRetry={() => {
                  const p = imageRetry.prompt;
                  setImageRetry(null);
                  void generateImageFromInput(p);
                }}
                onDismiss={() => setImageRetry(null)}
              />
            )}
          </div>
        )}
        {/* Latest pill moved out of .webchat-scroll into the form
            wrapper so it sits above the composer instead of at the
            bottom of the scroll area. Renders inside .webchat-input
            now, see below. */}
      </div>

      {lei.attachments.length > 0 && (
        <div className="webchat-attachments">
          {lei.attachments.map((a) => (
            <div key={a.id} className={`webchat-att-card webchat-att-card--${a.kind}`}>
              <div className="webchat-att-thumb">
                {a.kind === "image" && a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt={a.name} />
                ) : a.kind === "video" && a.previewUrl ? (
                  <video src={a.previewUrl} muted playsInline preload="metadata" />
                ) : a.kind === "code" ? (
                  <span className="webchat-att-icon">{"</>"}</span>
                ) : (
                  <span className="webchat-att-icon">📄</span>
                )}
              </div>
              <div className="webchat-att-info">
                <div className="webchat-att-info-name">{a.name}</div>
                <div className="webchat-att-info-sub">
                  {prettyAttSize(a.size)} · {a.kind}
                </div>
              </div>
              <button
                type="button"
                onClick={() => lei.removeAttachment(a.id)}
                className="webchat-att-x"
                aria-label={`Remove ${a.name}`}
                title="Remove"
              >×</button>
            </div>
          ))}
          {lei.attachments.length > 1 && (
            <button
              type="button"
              onClick={lei.clearAttachments}
              className="webchat-att-clear"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <form
        className="webchat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {/* Latest pill — anchored to the top edge of the composer
            so it sits just above the input regardless of how tall
            the textarea has grown. Slides into place; fades after
            3s of scroll idle (logic in onScroll above). */}
        {showJumpToBottom && (
          <div className="webchat-jump-bottom">
            <button
              type="button"
              onClick={jumpToBottom}
              aria-label="Jump to latest"
              style={{
                all: "unset",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span aria-hidden>↓</span>
              <span>Latest</span>
            </button>
            <button
              type="button"
              onClick={() => setShowJumpToBottom(false)}
              aria-label="Dismiss"
              className="webchat-jump-bottom-x"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {voiceState === "recording" && <WebVoiceWave mode="listening" />}
        {voiceState === "speaking" && <WebVoiceWave mode="speaking" />}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          // Image MIMEs are listed explicitly (no image/* and no
          // .heic/.heif) so iOS Safari converts a freshly taken
          // camera photo from HEIC to JPEG before upload. With
          // image/* iOS uploads the original HEIC bytes, the
          // vision API rejects them, and the user sees nothing.
          // capture is intentionally omitted so the picker still
          // offers "Take Photo" alongside "Photo Library" + "Choose
          // File" on mobile.
          accept="image/png,image/jpeg,image/gif,image/webp,video/*,audio/*,.pdf,.txt,.md,.csv,.json"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length) void lei.addFiles(files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            voiceState === "recording"
              ? "Listening… click mic again to send"
              : voiceState === "transcribing"
                ? "Transcribing…"
                : voiceState === "speaking"
                  ? "Speaking…"
                  : "Message vraelis-1…"
          }
          rows={1}
          disabled={voiceState === "recording" || voiceState === "transcribing"}
        />
        <div className="webchat-input-actions">
          <div className="webchat-input-actions-left">
            <ProjectPicker />
            <span
              className={`webchat-cost${costPreview.planCovers ? " webchat-cost--covered" : ""}`}
              title={
                costPreview.planCovers
                  ? `Included in your ${planDisplayName(plan)} plan, no credits used unless you exceed your weekly cap`
                  : `This action costs ${costPreview.credits} credits (${costPreview.usd})`
              }
            >
              {costPreview.planCovers
                ? `✓ ${planDisplayName(plan)}`
                : `≈ ${costPreview.credits} credits`}
            </span>
            <PlanExpiryNote expiresAt={planExpiresAt} canceling={planCanceling} />
          </div>
          <div className="webchat-input-actions-right">
          <div className="webchat-plus-wrap" ref={plusMenuRef}>
            <button
              type="button"
              onClick={() => setPlusMenuOpen((o) => !o)}
              className={`webchat-voice-btn webchat-plus-btn${plusMenuOpen ? " is-open" : ""}`}
              title="Add (attach files, generate image, more)"
              aria-haspopup="menu"
              aria-expanded={plusMenuOpen}
            >
              <span className="webchat-plus-glyph">＋</span>
              <span className="webchat-plus-label">Add</span>
            </button>
            {plusMenuOpen && (
              <div className="webchat-plus-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setPlusMenuOpen(false);
                  }}
                  className="webchat-plus-item"
                >
                  <span className="webchat-plus-item-glyph">📎</span>
                  <span className="webchat-plus-item-body">
                    <span className="webchat-plus-item-name">Upload from device</span>
                    <span className="webchat-plus-item-sub">Image · video · file · code, or just drag onto the page</span>
                  </span>
                </button>
                <div className="webchat-plus-hint">
                  <strong>Tip: </strong> Just type what you want, &ldquo;gen an image of a cat&rdquo;,
                  &ldquo;draw me a logo&rdquo;, etc., and Send. vraelis-1 routes it automatically.
                </div>
              </div>
            )}
          </div>

          <VoiceButton
            voiceState={voiceState}
            isFreePlan={isFreePlan}
            onStart={() => void enterVoiceMode()}
            onStop={stopVoice}
          />

          {streaming || generatingImage ? (
            <button
              type="button"
              onClick={stop}
              className="webchat-send webchat-send--stop"
            >
              Stop
            </button>
          ) : (
            <>
              {/* Phase H — Duel as a per-message action. Sits next
                  to Send so the user opts in only when they want a
                  GPT vs Claude comparison; default press is Send
                  (single solo response). type=button so Enter in
                  the textarea doesn't trigger it; only clicking
                  fires the duel. */}
              <button
                type="button"
                disabled={!input.trim() && lei.attachments.length === 0}
                onClick={() => void sendDuel()}
                className="webchat-duel-btn"
                title="Compare GPT vs Claude on this prompt — costs 3 credits + 2 chat slots"
              >
                Duel
              </button>
              <button
                type="submit"
                disabled={!input.trim() && lei.attachments.length === 0}
                className="webchat-send"
              >
                Send
              </button>
            </>
          )}
          </div>
        </div>
      </form>
    </section>
  );
}

function PlanExpiryNote({
  expiresAt,
  canceling,
}: {
  expiresAt?: string | null;
  canceling?: boolean;
}) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const now = Date.now();
  const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  // Show only when relevant: canceling soon OR within 14 days of period end.
  const shouldShow = canceling || days <= 14;
  if (!shouldShow || days < 0) return null;

  const dateLabel = new Date(expiresAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  let label: string;
  let urgency: "warn" | "soft" = "soft";
  if (canceling) {
    if (days <= 0) label = "Plan ends today";
    else if (days === 1) label = "Plan ends tomorrow";
    else label = `Plan ends in ${days} days · ${dateLabel}`;
    urgency = days <= 7 ? "warn" : "soft";
  } else {
    if (days <= 3) label = `Renews in ${days}d`;
    else label = `Renews ${dateLabel}`;
  }

  return (
    <a
      href="/account/billing"
      className={`webchat-plan-expiry webchat-plan-expiry--${urgency}`}
      title={canceling ? "Subscription is set to cancel, click to reactivate" : "Next renewal date"}
    >
      {canceling && <span aria-hidden>⚠</span>} {label}
    </a>
  );
}

function VoiceButton({
  voiceState,
  isFreePlan,
  onStart,
  onStop,
}: {
  voiceState: "idle" | "recording" | "transcribing" | "speaking";
  isFreePlan: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  if (isFreePlan) {
    return (
      <button
        type="button"
        disabled
        className="webchat-voice-btn webchat-voice-btn--locked"
        title="Voice is on paid plans, try the desktop app"
      >
        🔒 Voice
      </button>
    );
  }

  if (voiceState === "recording") {
    return (
      <button
        type="button"
        onClick={onStop}
        className="webchat-voice-btn webchat-voice-btn--recording"
        title="Stop recording and send"
      >
        ● Stop
      </button>
    );
  }

  if (voiceState === "transcribing") {
    return (
      <button type="button" disabled className="webchat-voice-btn">
        Transcribing…
      </button>
    );
  }

  if (voiceState === "speaking") {
    return (
      <button
        type="button"
        onClick={onStop}
        className="webchat-voice-btn webchat-voice-btn--speaking"
        title="Stop playback"
      >
        ◼ Stop voice
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onStart}
      className="webchat-voice-btn"
      title="Talk to vraelis-1"
    >
      🎙 Voice
    </button>
  );
}

function WebVoiceWave({ mode }: { mode: "listening" | "speaking" }) {
  return (
    <div className={`webchat-wave webchat-wave--${mode}`}>
      <span /><span /><span /><span /><span /><span /><span /><span />
      <span className="webchat-wave-label">
        {mode === "listening" ? "Listening" : "Speaking"}
      </span>
    </div>
  );
}

function WebVoiceOverlay({
  state,
  level,
  error,
  onMicTap,
  onExit,
}: {
  state: "idle" | "recording" | "transcribing" | "speaking";
  level: number;
  error: string | null;
  onMicTap: () => void;
  onExit: () => void;
}) {
  const SPEAKING_THRESHOLD = 0.08;
  let status: string;
  let subStatus: string;
  if (error) {
    status = "Mic blocked";
    subStatus = "Allow microphone access in your browser, then tap the orb to retry";
  } else if (state === "transcribing") {
    status = "Thinking";
    subStatus = "Working out what you said";
  } else if (state === "speaking") {
    status = "Speaking";
    subStatus = "Talk to interrupt";
  } else if (state === "recording") {
    if (level > SPEAKING_THRESHOLD) {
      status = "Listening";
      subStatus = "Heard you, keep going";
    } else {
      status = "Your turn";
      subStatus = "Speak when you're ready";
    }
  } else {
    status = "Tap the orb to start";
    subStatus = "Vraelis will listen, then talk back. Tap again to interrupt.";
  }

  // Reactive scale for the orb based on real audio level. Capped so
  // it can't push past the viewport on loud peaks.
  const scale = 1 + Math.min(level * 0.5, 0.5);
  // Voice level intensity 0..1 used for the outer pulse rings.
  const intensity = Math.min(level * 1.6, 1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  // 12 vertical bars driven by audio level + per-bar phase offset.
  // Live-reactive in recording state, gentle idle pulse otherwise.
  const isLive = state === "recording" || state === "speaking";
  const bars = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="voice-overlay">
      <button
        type="button"
        onClick={onExit}
        className="voice-overlay-close"
        aria-label="Exit voice mode"
        title="Exit (Esc)"
      >
        ✕
      </button>

      <div className="voice-overlay-stage">
        <button
          type="button"
          onClick={onMicTap}
          className={`voice-orb voice-orb--${state}`}
          style={{
            transform: `scale(${scale})`,
            // Pass intensity to CSS so the rings can react.
            ["--vo-intensity" as string]: intensity.toFixed(3),
          }}
          aria-label={status}
        >
          <span className="voice-orb-inner" />
          <span className="voice-orb-ring" />
          <span className="voice-orb-ring voice-orb-ring--lg" />
          <span className="voice-orb-ring voice-orb-ring--xl" />
        </button>

        <div className="voice-overlay-status">
          <span className={`voice-overlay-dot voice-overlay-dot--${state}`} />
          <span className="voice-overlay-status-text">{status}</span>
        </div>
        <div className="voice-overlay-substatus">{subStatus}</div>

        {/* Reactive waveform, bars scale with audio level, with a
            per-bar phase so they don't all move in lock-step. */}
        <div className={`voice-overlay-bars${isLive ? " is-live" : ""}`} aria-hidden>
          {bars.map((i) => {
            const phase = Math.sin((Date.now() / 240) + i * 0.55);
            const reactive = isLive ? 0.35 + intensity * 0.65 + phase * 0.18 : 0.25;
            const h = Math.max(0.18, Math.min(1, reactive));
            return (
              <span
                key={i}
                className="voice-overlay-bar"
                style={{ transform: `scaleY(${h.toFixed(3)})` }}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={onExit}
          className="voice-overlay-end"
        >
          End conversation
        </button>
      </div>
    </div>
  );
}

type Section =
  | { type: "thinking"; text: string }
  | { type: "answer"; text: string };

function parseSections(content: string): Section[] {
  const out: Section[] = [];
  // Match <think>…</think> AND <thinking>…</thinking>. The system
  // prompt asks for <think> but Claude/GPT often emit <thinking>
  // when "thinking out loud" — without this, the raw tag leaks
  // into the rendered bubble.
  const TAG_RE = /<think(?:ing)?>([\s\S]*?)(?:<\/think(?:ing)?>|$)/gi;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(content)) !== null) {
    if (m.index > cursor) {
      out.push({ type: "answer", text: content.slice(cursor, m.index) });
    }
    out.push({ type: "thinking", text: m[1] });
    cursor = m.index + m[0].length;
  }
  if (cursor < content.length) {
    const tail = content.slice(cursor);
    if (tail) out.push({ type: "answer", text: tail });
  }
  return out;
}

// Detects assistant turns that are nothing but image markdown
// (with an optional italic caption above). Returns the parsed
// urls + caption when the whole message is an image render, else
// null. Letting us swap the markdown bubble for a richer card
// without changing how generation/persistence work.
function parseImageMessage(content: string): {
  caption: string | null;
  urls: string[];
} | null {
  const trimmed = content.trim();
  if (!trimmed.includes("![")) return null;

  let body = trimmed;
  let caption: string | null = null;
  // Optional leading italic line, e.g. "*revised prompt text*"
  const captionMatch = body.match(/^\*([^*\n][^*\n]*)\*\s*\n+/);
  if (captionMatch) {
    caption = captionMatch[1].trim();
    body = body.slice(captionMatch[0].length).trim();
  }

  const urls: string[] = [];
  const imgRe = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(body)) !== null) {
    if (body.slice(lastEnd, m.index).trim().length > 0) return null;
    urls.push(m[1]);
    lastEnd = m.index + m[0].length;
  }
  if (body.slice(lastEnd).trim().length > 0) return null;
  if (urls.length === 0) return null;
  return { caption, urls };
}

function WebAssistantBubble({
  content,
  streaming,
  userPrompt,
  onIterate,
  onPrefillInput,
  onRegenerate,
}: {
  content: string;
  streaming: boolean;
  userPrompt?: string;
  onIterate?: (prompt: string) => void;
  onPrefillInput?: (text: string) => void;
  onRegenerate?: () => void;
}) {
  const allSections = parseSections(content);
  // Strip thinking blocks, internal reasoning isn't shown to the user.
  const sections = allSections.filter((s) => s.type !== "thinking");

  // Guard: if the model was cut off inside a <think> block (hit token
  // limit mid-reasoning), all sections filter out and the bubble
  // renders blank. Detect this and surface a friendly retry message
  // instead of leaving the user staring at nothing.
  if (!streaming && sections.length === 0 && allSections.some((s) => s.type === "thinking")) {
    return (
      <p className="text-sm text-neutral-400 italic">
        Ran out of space while reasoning — please try again, or break the request into smaller parts.
      </p>
    );
  }

  // Image-result fast path: when the whole message is image markdown
  // (with optional caption), render a custom card with iterate
  // controls instead of plain markdown. Streaming bypasses this so
  // the placeholder "Generating image…" still flows normally.
  if (!streaming && sections.length === 1) {
    const parsed = parseImageMessage(sections[0].text);
    if (parsed) {
      return (
        <WebImageResultCard
          urls={parsed.urls}
          caption={parsed.caption}
          userPrompt={userPrompt}
          onIterate={onIterate}
          onPrefillInput={onPrefillInput}
        />
      );
    }
  }

  return (
    <>
      {sections.map((s, i) => {
        const isLast = i === sections.length - 1;
        // v0.1.16, Always render markdown, even during streaming.
        // The previous "plain text during stream, markdown after"
        // pattern made users see raw `**bold**` and `- list items`
        // until the stream ended. ReactMarkdown handles partial
        // markdown gracefully (incomplete `**bold` renders as text,
        // then snaps to bold once the closing `**` arrives).
        return (
          <div key={i} className="md">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              urlTransform={(url) => url}
              components={{
                // v0.2.0 phase B, Shiki syntax highlight + copy
                // button on every fenced block. Inline `code` (no
                // language class) falls through to the default
                // tinted span the rest of the .md theme styles.
                code({ className, children, ...props }) {
                  const isFenced =
                    typeof className === "string" &&
                    className.includes("language-");
                  const text = String(children ?? "");
                  if (!isFenced) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                  // Special-case ```chart and ```canvas blocks: render
                  // via the dedicated component instead of a code box.
                  // This is the contract that lets the model produce
                  // real charts / designs via a structured spec
                  // instead of hand-rolling fake SVG.
                  if (className?.includes("language-chart")) {
                    return <ChartRenderer source={text} />;
                  }
                  if (className?.includes("language-canvas")) {
                    return <CanvasRenderer source={text} />;
                  }
                  return (
                    <CodeBlock
                      className={className}
                      streaming={streaming && isLast}
                    >
                      {text}
                    </CodeBlock>
                  );
                },
                // ReactMarkdown wraps fenced code in <pre><code>;
                // CodeBlock supplies its own <pre>, so swallow the
                // outer <pre> when its only child is our component.
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {s.text}
            </ReactMarkdown>
            {streaming && isLast && <span className="webchat-cursor" />}
          </div>
        );
      })}
      {!streaming && content && (
        <div className="webchat-assistant-actions">
          <CopyMessageButton content={content} />
          {onRegenerate && (
            <button
              type="button"
              className="webchat-bubble-action"
              title="Re-run this answer. Drops the current reply server-side and streams a fresh one for the same question."
              onClick={onRegenerate}
            >
              Regenerate
            </button>
          )}
        </div>
      )}
    </>
  );
}

// Whole-message Copy on assistant turns. Strips <think>/<thinking>
// blocks from the source so the user gets just the visible answer
// (parseSections already filters reasoning out of render, this
// mirrors that for the clipboard).
function CopyMessageButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const visible = parseSections(content)
      .filter((s) => s.type !== "thinking")
      .map((s) => s.text)
      .join("")
      .trim();
    try {
      await navigator.clipboard.writeText(visible || content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore; clipboard unavailable
    }
  }
  return (
    <button
      type="button"
      className="webchat-bubble-action"
      title="Copy the message"
      onClick={() => void copy()}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Renders a user turn. Plain text used to be inlined directly into
// the bubble, but image-attached turns need to surface the image(s)
// the user sent so the chat reads correctly on reload (and on
// scroll-up). Images come back from the server as base64 with a
// media_type, so we build a data URL on render. No markdown for
// user turns \u2014 that's an assistant-only convention.
function WebUserBubble({
  content,
  images,
  isEditing,
  onEdit,
  onCancelEdit,
}: {
  content: string;
  images?: Array<{ media_type: string; data: string }>;
  isEditing?: boolean;
  onEdit?: (text: string) => void;
  onCancelEdit?: () => void;
}) {
  const hasImages = Boolean(images && images.length > 0);
  return (
    <>
      {hasImages && (
        <div className="webchat-user-images">
          {images!.map((img, i) => {
            const url = `data:${img.media_type};base64,${img.data}`;
            return (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="webchat-user-image-tile"
                title="Open full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`attachment ${i + 1}`} />
              </a>
            );
          })}
        </div>
      )}
      {content && <span>{content}</span>}
      {isEditing && (
        <div className="webchat-user-edit-banner">
          Editing this turn. Submitting will rewrite the conversation from
          here forward.
        </div>
      )}
      {onEdit && content && (
        <div className="webchat-user-actions">
          {isEditing ? (
            <button
              type="button"
              className="webchat-bubble-action"
              title="Cancel and keep the original turn"
              onClick={() => onCancelEdit?.()}
            >
              Cancel edit
            </button>
          ) : (
            <button
              type="button"
              className="webchat-bubble-action"
              title="Edit and resend. Drops every reply after this turn and re-runs from the new content."
              onClick={() => onEdit(content)}
            >
              Edit
            </button>
          )}
        </div>
      )}
    </>
  );
}

// Custom render for image-gen output. Replaces the plain markdown
// `![](url)` block with a grid + iterate controls (variation,
// refine, download, copy). The data path is unchanged: the
// assistant turn still stores image markdown so persistence,
// re-loading old threads, and copy-paste keep working \u2014 the card
// just sits on top of the same bytes when the message is detected
// as an image-only render.
function WebImageResultCard({
  urls,
  caption,
  userPrompt,
  onIterate,
  onPrefillInput,
}: {
  urls: string[];
  caption: string | null;
  userPrompt?: string;
  onIterate?: (prompt: string) => void;
  onPrefillInput?: (text: string) => void;
}) {
  const promptForActions = (userPrompt ?? caption ?? "").trim();
  const canIterate = Boolean(promptForActions && onIterate);
  const canRefine = Boolean(promptForActions && onPrefillInput);

  return (
    <div className="webchat-img-card">
      <div
        className={`webchat-img-grid webchat-img-grid--${urls.length}`}
      >
        {urls.map((u, i) => (
          <a
            key={`${u}-${i}`}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="webchat-img-tile"
            title="Open full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`generated ${i + 1}`} />
          </a>
        ))}
      </div>

      {caption && (
        <div className="webchat-img-caption">{caption}</div>
      )}

      <div className="webchat-img-actions">
        {canIterate && (
          <button
            type="button"
            className="webchat-img-btn"
            onClick={() => onIterate?.(promptForActions)}
            title="Generate another version of the same prompt"
          >
            <span aria-hidden>{"\u21bb"}</span> Variation
          </button>
        )}
        {canRefine && (
          <button
            type="button"
            className="webchat-img-btn"
            onClick={() => onPrefillInput?.(promptForActions)}
            title="Edit the prompt and run again"
          >
            <span aria-hidden>{"\u270e"}</span> Refine
          </button>
        )}
        {urls.map((u, i) => (
          <a
            key={`dl-${u}-${i}`}
            href={u}
            download={`VRAELIS-image-${i + 1}.png`}
            target="_blank"
            rel="noreferrer"
            className="webchat-img-btn"
            title={urls.length > 1 ? `Download image ${i + 1}` : "Download"}
          >
            <span aria-hidden>{"\u2193"}</span>{" "}
            {urls.length > 1 ? `#${i + 1}` : "Download"}
          </a>
        ))}
      </div>
    </div>
  );
}

// ChatGPT-style word fade-in for streaming text on the web. Same
// approach as the desktop StreamingFadeText \u2014 stable index keys
// mean each word only animates once on first appearance.
function WebStreamingFadeText({ text }: { text: string }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  return (
    <span className="webchat-stream-text">
      {tokens.map((token, i) =>
        /^\s+$/.test(token) ? (
          token
        ) : (
          <span key={i} className="webchat-word-fade">
            {token}
          </span>
        ),
      )}
    </span>
  );
}

// Cap-block errors carry "Buy a Weekly Boost..." or "upgrade to Pro..."
// CTAs as plain text. We surface them as actual clickable buttons
// below the message so the user doesn't have to mentally parse where
// to go. Generic errors render as the plain pill they always did.
function ChatErrorPill({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const lower = message.toLowerCase();
  const isCapBlock =
    lower.includes("weekly") ||
    lower.includes("resets") ||
    lower.includes("boost") ||
    lower.includes("upgrade");
  if (isCapBlock) {
    return (
      <div className="webchat-error">
        <div>{message}</div>
        <div className="webchat-error-actions">
          <a
            href="/account/plan"
            className="webchat-error-cta"
            onClick={() =>
              trackClientEvent("upgrade_clicked", {
                source: "error_pill_billing",
              })
            }
          >
            Open billing
          </a>
          <a
            href="/pricing"
            className="webchat-error-cta webchat-error-cta--ghost"
            onClick={() =>
              trackClientEvent("upgrade_clicked", {
                source: "error_pill_pricing",
              })
            }
          >
            See plans
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="webchat-error">
      <div>{message}</div>
      {onRetry && (
        <div className="webchat-error-actions">
          <button
            type="button"
            onClick={onRetry}
            className="webchat-error-cta"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function ImageRetryPill({
  message,
  prompt,
  onRetry,
  onDismiss,
}: {
  message: string;
  prompt: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  // Echoes the failure reason + the original prompt verbatim so
  // the user can decide to retry as-is or copy the prompt and
  // tweak in the input box. Retry kicks the same gen pipeline
  // (Preparing -> Generating -> Finalizing).
  return (
    <div className="webchat-error">
      <div>
        <div className="webchat-error-title">Image generation failed</div>
        <div className="webchat-error-detail">{message}</div>
        <div
          className="webchat-error-prompt"
          title="The prompt that was sent"
        >
          {prompt}
        </div>
      </div>
      <div className="webchat-error-actions">
        <button
          type="button"
          onClick={onRetry}
          className="webchat-error-cta"
        >
          Retry image
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="webchat-error-cta webchat-error-cta--ghost"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function CreditChip({ balance, plan }: { balance: number | null; plan: string }) {
  const planCovers = ["pro", "teams", "enterprise"].includes(plan.toLowerCase());
  if (balance === null) {
    return <span className="webchat-credit-chip webchat-credit-chip--idle" title="Loading credits…">credits</span>;
  }
  // For unlimited plans, low balance isn't urgent, they only burn
  // credits if they blow past the weekly cap, which most users won't.
  const empty = balance === 0 && !planCovers;
  const low = balance > 0 && balance < 20 && !planCovers;
  return (
    <a
      href="/account/billing"
      className={`webchat-credit-chip${empty ? " webchat-credit-chip--empty" : low ? " webchat-credit-chip--low" : ""}`}
      title={
        planCovers
          ? `Your ${planDisplayName(plan)} plan covers normal use. Credits only burn if you exceed weekly caps.`
          : empty
            ? "Out of credits, click to top up"
            : low
              ? "Low balance, top up to keep going past your plan cap"
              : "Credit balance"
      }
    >
      {empty ? (
        <>
          <span aria-hidden>⚡</span>
          <span>Top up</span>
        </>
      ) : (
        <span>{balance.toLocaleString()} credits</span>
      )}
    </a>
  );
}

function VoiceStyleToggle({
  value,
  onChange,
}: {
  value: "v2v" | "v2t";
  onChange: (v: "v2v" | "v2t") => void;
}) {
  // v0.1.16, Replaced cryptic 'V→T' / 'V→V' labels with words real
  // users actually understand. 'Dictate' = you talk, AI types back.
  // 'Talk' = full hands-free voice conversation.
  return (
    <div className="webchat-vstyle" role="group" aria-label="Voice reply style">
      <button
        type="button"
        onClick={() => onChange("v2t")}
        className={value === "v2t" ? "is-active" : ""}
        title="Dictate, you speak, AI replies in text"
      >Dictate</button>
      <button
        type="button"
        onClick={() => onChange("v2v")}
        className={value === "v2v" ? "is-active" : ""}
        title="Talk, full hands-free voice, AI speaks back"
      >Talk</button>
    </div>
  );
}

// Downsample an image Blob for vision upload. Anthropic's vision
// works best around ~1.15 megapixels and our server caps payload
// at 1MB per image. Phone photos (12MP, 3-5MB) blew past both
// limits and got silently filtered out, leaving the model with
// only text — which on a "what's the answer to #3?" prompt looks
// like the AI bailed.
//
// Strategy: load into <img>, scale longest edge down to MAX_EDGE
// preserving aspect ratio, draw to canvas, export as JPEG with
// stepping quality (0.85 -> 0.7 -> 0.55) until under MAX_BYTES.
// Returns null on any failure so the caller falls back to the
// original blob (which the server will then drop, but at least
// the error pill fires instead of a silent empty stream).
async function downsampleForVision(blob: Blob): Promise<Blob | null> {
  const MAX_EDGE = 1568;
  const MAX_BYTES = 900_000;
  // Skip downsample for already-small images — keeps PNG quality
  // for tiny screenshots and avoids needless re-encoding.
  if (blob.size <= MAX_BYTES) {
    // Still re-check dimensions; a small-byte image at 4000px wide
    // is rare but possible. Cheap enough to always check.
  }
  try {
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = url;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    if (scale === 1 && blob.size <= MAX_BYTES) {
      URL.revokeObjectURL(url);
      return blob;
    }
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    for (const quality of [0.85, 0.7, 0.55]) {
      const out = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
      });
      if (out && out.size <= MAX_BYTES) return out;
    }
    // Even at 0.55 quality we couldn't fit. Return the smallest
    // attempt anyway; server will reject if still too big but at
    // least the user sees the error pill.
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.55);
    });
  } catch {
    return null;
  }
}

function prettyAttSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function WebBounceDots() {
  // Pre-first-token indicator. Three bouncing dots, no word
  // the previous "Thinking" + shimmer label visually collided
  // with the streaming cursor (purple bar) and looked broken.
  // Internal reasoning is never rendered; <think>...</think>
  // blocks are stripped server-of-render in parseSections().
  return (
    <span className="webchat-dots" aria-label="Thinking">
      <span className="webchat-dot" />
      <span className="webchat-dot" />
      <span className="webchat-dot" />
    </span>
  );
}

// v0.2.0 phase G — side-by-side duel render. Two columns that share
// vertical scroll on desktop and stack under 720px (mobile) so the
// comparison still reads cleanly on a phone. Cost chip per side
// once the stream completes; Pick / Retry actions appear once at
// least one side has rendered something.
function DuelTurn({
  state,
  onPickWinner,
  onRetryBoth,
  showUpsell,
  onDismissUpsell,
}: {
  state: DuelTurnState;
  onPickWinner: (side: DuelSideKey) => void;
  onRetryBoth: () => void;
  showUpsell?: boolean;
  onDismissUpsell?: () => void;
}) {
  const { left, right, streaming } = state;
  const bothDone = left.done && right.done;
  const eitherHasContent = left.content.length > 0 || right.content.length > 0;
  const showActions = bothDone || (!streaming && eitherHasContent);
  // Pick is only available when BOTH sides actually responded
  // cleanly. If one side errored or rendered empty, the only
  // valid recovery is Retry both — picking a "winner" with no
  // counterpart isn't a comparison.
  const bothValid =
    !!left.content && !!right.content && !left.error && !right.error;
  const pickDisabled = streaming || !bothValid;
  // Track which side the user is hovering so the matching Pick
  // button can light up — makes the comparison feel like the UI
  // is taking part in the decision instead of just sitting there.
  const [hoverSide, setHoverSide] = useState<DuelSideKey | null>(null);

  const formatCostChip = (side: DuelSidePayload): string | null => {
    if (typeof side.cost !== "number") return null;
    if (side.cost <= 0) return "$0.00";
    if (side.cost < 0.01) return `$${side.cost.toFixed(4)}`;
    return `$${side.cost.toFixed(2)}`;
  };

  return (
    <div className="webchat-duel">
      <div
        className={`webchat-duel-cols${
          hoverSide ? ` is-hover-${hoverSide}` : ""
        }`}
      >
        <DuelColumn
          label="GPT"
          side="left"
          payload={left}
          costChip={formatCostChip(left)}
          streaming={streaming}
          onHoverChange={setHoverSide}
          onRetry={onRetryBoth}
        />
        <div className="webchat-duel-divider" aria-hidden />
        <DuelColumn
          label="Claude"
          side="right"
          payload={right}
          costChip={formatCostChip(right)}
          streaming={streaming}
          onHoverChange={setHoverSide}
          onRetry={onRetryBoth}
        />
      </div>
      {showActions && (
        <div className="webchat-duel-actions">
          <button
            type="button"
            className={`webchat-duel-pick webchat-duel-pick--left${
              hoverSide === "left" && !pickDisabled ? " is-anticipated" : ""
            }`}
            onClick={() => onPickWinner("left")}
            onMouseEnter={() => setHoverSide("left")}
            onMouseLeave={() => setHoverSide(null)}
            disabled={pickDisabled}
            title={
              bothValid
                ? "Keep the GPT response and continue the chat"
                : "Both sides need to respond before you can pick a winner"
            }
          >
            <span className="webchat-duel-pick-marker" aria-hidden>◀</span>
            <span className="webchat-duel-pick-label">Pick GPT</span>
          </button>
          <button
            type="button"
            className="webchat-duel-retry"
            onClick={onRetryBoth}
            disabled={streaming}
            title="Re-run both models on the same prompt"
          >
            Retry both
          </button>
          <button
            type="button"
            className={`webchat-duel-pick webchat-duel-pick--right${
              hoverSide === "right" && !pickDisabled ? " is-anticipated" : ""
            }`}
            onClick={() => onPickWinner("right")}
            onMouseEnter={() => setHoverSide("right")}
            onMouseLeave={() => setHoverSide(null)}
            disabled={pickDisabled}
            title={
              bothValid
                ? "Keep the Claude response and continue the chat"
                : "Both sides need to respond before you can pick a winner"
            }
          >
            <span className="webchat-duel-pick-label">Pick Claude</span>
            <span className="webchat-duel-pick-marker" aria-hidden>▶</span>
          </button>
        </div>
      )}
      {showActions && showUpsell && (
        <div className="webchat-duel-upsell" role="note">
          <span className="webchat-duel-upsell-text">
            Liking Duel? Upgrade for more comparisons.
          </span>
          <a
            className="webchat-duel-upsell-cta"
            href="/account/plan"
            onClick={() =>
              trackClientEvent("upgrade_clicked", {
                source: "winner_upsell",
              })
            }
          >
            Upgrade →
          </a>
          <button
            type="button"
            className="webchat-duel-upsell-dismiss"
            onClick={onDismissUpsell}
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function DuelColumn({
  label,
  side,
  payload,
  costChip,
  streaming,
  onHoverChange,
  onRetry,
}: {
  label: string;
  side: DuelSideKey;
  payload: DuelSidePayload;
  costChip: string | null;
  streaming: boolean;
  onHoverChange?: (side: DuelSideKey | null) => void;
  // Inline retry — fires Retry both behind the scenes (no
  // single-side retry endpoint yet). Surfacing it on the
  // errored column gives the user a recovery action without
  // forcing them to scroll to the action row.
  onRetry?: () => void;
}) {
  const isThisSideStreaming = streaming && !payload.done;
  return (
    <div
      className={`webchat-duel-col webchat-duel-col--${side}`}
      onMouseEnter={() => onHoverChange?.(side)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      <div className="webchat-duel-head">
        <span className="webchat-duel-label">
          <span className={`webchat-duel-label-dot webchat-duel-label-dot--${side}`} aria-hidden />
          {label}
        </span>
        {costChip && <span className="webchat-duel-cost">{costChip}</span>}
      </div>
      {payload.error ? (
        <div className="webchat-duel-error">
          <span>{payload.error}</span>
          {onRetry && (
            <button
              type="button"
              className="webchat-duel-error-retry"
              onClick={onRetry}
              title="Re-run both sides"
            >
              Retry
            </button>
          )}
        </div>
      ) : !payload.content ? (
        <div className="webchat-duel-pending">
          {payload.phaseLabel ?? "Thinking…"}
          <WebBounceDots />
        </div>
      ) : (
        <div className="webchat-duel-body md">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            urlTransform={(url) => url}
            components={{
              code({ className, children, ...props }) {
                const isFenced =
                  typeof className === "string" &&
                  className.includes("language-");
                const text = String(children ?? "");
                if (!isFenced) {
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <CodeBlock
                    className={className}
                    streaming={isThisSideStreaming}
                  >
                    {text}
                  </CodeBlock>
                );
              },
              pre({ children }) {
                return <>{children}</>;
              },
            }}
          >
            {payload.content}
          </ReactMarkdown>
          {isThisSideStreaming && <span className="webchat-cursor" />}
        </div>
      )}
    </div>
  );
}

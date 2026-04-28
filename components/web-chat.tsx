"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLei } from "./lei-shell";
import { previewCreditCost } from "@/lib/lei";
import { planDisplayName } from "@/lib/pricing";

type ChatImageInline = { media_type: string; data: string };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: ChatImageInline[];
};

// Cross-component "thread is generating" tracker. WebChat writes;
// chat-history rail + the floating back-to-chat pill read. Lives in
// localStorage so a page reload doesn't lose state, and a
// 'sansxel:flight:changed' event fires on every write so listeners
// re-render without polling.
const FLIGHT_KEY = "sansxel.inflight.threads";
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
    display_name: "sansxel-1 fast",
    blurb: "Quick replies. Free for everyone.",
  },
  {
    tier: "balanced",
    display_name: "sansxel-1",
    blurb: "Default. Core and up.",
  },
  {
    tier: "smart",
    display_name: "sansxel-1 deep",
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

      // Text-paste fallback: only kicks in when the user pasted
      // somewhere OTHER than an input. Otherwise the default browser
      // paste handles it natively.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (inField) return;
      const text = dt.getData("text/plain");
      if (!text) return;
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
  const hasHydratedRef = useRef(false);
  const promptHandledRef = useRef(false);

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
    window.addEventListener("sansxel:new-chat", onNewChat);
    return () => window.removeEventListener("sansxel:new-chat", onNewChat);
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
          // No URL hint, only auto-restore on first mount.
          if (hasHydratedRef.current) return;
          // Cross-device fresh-vs-resume rule: default to a fresh
          // chat, but if the most recent thread (any device, same
          // account, server-side updated_at) was active within the
          // last 15 minutes, jump back to it. Lets a phone → laptop
          // handoff feel seamless without dragging stale sessions
          // back the next morning.
          const RESUME_WINDOW_MS = 15 * 60 * 1000;
          const res = await fetch("/api/threads", { cache: "no-store" });
          if (!res.ok) {
            hasHydratedRef.current = true;
            return;
          }
          const data = (await res.json()) as {
            threads?: Array<{ id: string; updated_at?: string }>;
          };
          const top = data.threads?.[0];
          if (top?.updated_at) {
            const age = Date.now() - new Date(top.updated_at).getTime();
            if (age < RESUME_WINDOW_MS) {
              targetId = top.id;
            }
          }
          if (!targetId) {
            hasHydratedRef.current = true;
            setThreadId(null);
            setMessages([]);
            setInput("");
            return;
          }
        }
        hasHydratedRef.current = true;
        if (cancelled) return;
        if (!targetId) return; // brand new account, no threads yet
        // Don't re-load the same thread we're already showing.
        if (targetId === threadIdRef.current) return;

        const detailRes = await fetch(`/api/threads/${targetId}`, { cache: "no-store" });
        if (!detailRes.ok || cancelled) return;
        const detail = (await detailRes.json()) as {
          thread?: { updated_at?: string };
          messages?: Array<{
            role: "user" | "assistant" | "system";
            content: string;
            images?: ChatImageInline[] | null;
          }>;
        };
        if (cancelled) return;
        setThreadId(targetId);
        // Reflect the active thread in the URL so the chat history
        // rail's active-state outline picks it up. ReplaceState (no
        // history entry) so the back button still feels normal.
        if (typeof window !== "undefined" && !requestedThreadParam) {
          const url = new URL(window.location.href);
          url.searchParams.set("thread", targetId);
          window.history.replaceState({}, "", url.pathname + url.search);
        }
        const restored = (detail.messages ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            images: Array.isArray(
              (m as { images?: ChatImageInline[] | null }).images,
            )
              ? ((m as { images?: ChatImageInline[] }).images ?? undefined)
              : undefined,
          }));
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
                messages?: Array<{
                  role: "user" | "assistant" | "system";
                  content: string;
                  images?: ChatImageInline[] | null;
                }>;
              };
              if (cancelled || threadIdRef.current !== targetId) return;
              const next = (d.messages ?? [])
                .filter((mm) => mm.role === "user" || mm.role === "assistant")
                .map((mm) => ({
                  role: mm.role as "user" | "assistant",
                  content: mm.content,
                  images: Array.isArray(
                    (mm as { images?: ChatImageInline[] | null }).images,
                  )
                    ? ((mm as { images?: ChatImageInline[] }).images ?? undefined)
                    : undefined,
                }));
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
  // v0.1.16, Live preview transcript via the browser's Web Speech
  // API (Chrome/Edge: window.webkitSpeechRecognition). Runs alongside
  // MediaRecorder so the user sees their words appearing in real time
  // while they speak. Whisper still produces the canonical transcript
  // that actually gets sent, Web Speech is display-only because its
  // accuracy is uneven across browsers and accents.
  const [liveTranscript, setLiveTranscript] = useState("");
  // Accumulator for the FINAL portion of the transcript across events.
  // Web Speech returns cumulative interim results each event (each
  // event's interim REPLACES the last); only when a result becomes
  // final does it move into the canonical text. Mixing the two
  // without this ref produced "eyeyebroweyebrow" duplication.
  const finalTranscriptRef = useRef("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecognitionRef = useRef<any>(null);
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

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 60;
    stickToBottomRef.current = nearBottom;
    setShowJumpToBottom(!nearBottom);
  }, []);

  useEffect(() => {
    if (scrollRef.current && stickToBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  const send = useCallback(async (overrideText?: string, fromVoice = false) => {
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
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error("read failed"));
            r.readAsDataURL(blob);
          });
          const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
          if (m) {
            const mt = (att.mime || m[1] || "image/png").toLowerCase();
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
                `\n\n[Skipped image: ${att.name}. Format ${mt} is not supported by sansxel-1 vision yet, please use PNG, JPEG, WEBP, or GIF.]`,
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
    // separate button. Three patterns trigger:
    //   1. Strong-visual verb + ANY subject: "gen a cat", "draw
    //      a sunset", "imagine a cyberpunk city". These verbs are
    //      almost only used in image-gen context, so we don't gate
    //      on a noun list.
    //   2. Generic verb + visual noun: "make a graph", "show me a
    //      chart", "give me an illustration". These verbs are
    //      ambiguous on their own (make a sandwich? show me the
    //      file?), so the noun gate stays.
    //   3. Visual verb alone: "plot y=x+5", "graph this", "chart
    //      sales", "visualize the data", "diagram the flow".
    // Skipped when there's an attached image (probably means
    // "analyze this", not "make a new one"). False positives are
    // recoverable — user retypes once they see the image.
    const STRONG_IMAGE_VERB =
      /^\s*(?:gen(?:erate)?|draw|paint|imagine|illustrate|render|sketch)\b\s+\S/i;
    const IMAGE_GEN_INTENT =
      /^\s*(?:make|create|design|show(?:\s+me)?|give(?:\s+me)?)\s+(?:me\s+)?(?:an?\s+|the\s+|some\s+)?(?:image|picture|pic|photo|illustration|art|drawing|painting|sketch|portrait|logo|graphic|render|graph|chart|plot|diagram|map|visualization|viz|infographic|figure|icon|poster|banner|wallpaper)\b/i;
    const VISUAL_VERB_INTENT =
      /^\s*(?:plot|graph|chart|visuali[sz]e|diagram)\b\s+\S/i;
    const isImageRequest =
      (STRONG_IMAGE_VERB.test(baseText) ||
        IMAGE_GEN_INTENT.test(baseText) ||
        VISUAL_VERB_INTENT.test(baseText)) &&
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
    // Build the network payload separately so the in-UI message stays
    // text-only (we already render the image previews via the LEI
    // attachment chips above the input).
    const payloadMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      imageBlocks.length > 0
        ? { role: "user" as const, content: text || "Here's an image, what do you see?", images: imageBlocks }
        : { role: "user" as const, content: text },
    ];
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setChatError(null);
    // Touch the activity timestamp so the next-mount idle check
    // knows the user was active recently and shouldn't get auto-
    // bumped to a new chat.
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sansxel.lastActivity", String(Date.now()));
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
        }),
        signal: ac.signal,
      });

      // v0.1.16, Capture the resolved server-side thread id so
      // follow-up turns continue the same conversation (and show in
      // the sidebar).
      const echoedThreadId = res.headers.get("x-sansxel-thread-id");
      if (echoedThreadId && echoedThreadId !== threadIdRef.current) {
        setThreadId(echoedThreadId);
        // Reflect the new active thread in the URL so the rail's
        // active outline picks up immediately.
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("thread", echoedThreadId);
          url.searchParams.delete("new");
          window.history.replaceState({}, "", url.pathname + url.search);
          window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
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
        window.dispatchEvent(new CustomEvent("sansxel:flight:changed"));
      }

      // Surface plan downgrade if the server picked a lower tier
      const requested = res.headers.get("x-sansxel-tier-requested");
      const resolved = res.headers.get("x-sansxel-tier");
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

      // Sentence-streaming TTS, only in V→V mode. V→T is dictation:
      // we transcribe, the AI replies in text, end of turn (no audio
      // reply, no auto-restart of the mic).
      const willSpeak = lastTurnWasVoice.current && lei.voiceStyle === "v2v";
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
          const evt = JSON.parse(raw) as { type?: string; label?: string; kind?: string };
          if (evt.type === "phase" && typeof evt.label === "string") {
            // "writing" phase clears the label so the pill goes away
            // once real text starts flowing, bouncing dots visually
            // hand off to the answer.
            if (evt.kind === "writing") {
              setPhaseLabel(null);
            } else {
              setPhaseLabel(evt.label);
            }
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
        ? "Couldn't reach sansxel. Check your connection and try again."
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
          window.dispatchEvent(new CustomEvent("sansxel:flight:changed"));
        }
        window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
        // The server-side AI title regen runs AFTER the stream ends
        // (cheap Haiku call). Fire a second refetch a few seconds
        // later so the rail picks up the new title without the user
        // having to reload or refocus the tab.
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
        }, 3500);
      }
    }
  }, [input, messages, tier, lei]);

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
          window.dispatchEvent(new CustomEvent("sansxel:flight:changed"));
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
    const placeholder = count > 1 ? `Generating ${count} images…` : "Generating image…";
    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "assistant", content: placeholder },
    ]);
    setInput("");
    setGeneratingImage(true);
    setChatError(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sansxel.lastActivity", String(Date.now()));
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
      window.dispatchEvent(new CustomEvent("sansxel:flight:changed"));
    };
    const clearFlight = (id: string | null) => {
      if (typeof window === "undefined" || !id) return;
      const flight = readFlight();
      delete flight[id];
      window.localStorage.setItem(FLIGHT_KEY, JSON.stringify(flight));
      window.dispatchEvent(new CustomEvent("sansxel:flight:changed"));
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
        body: JSON.stringify({ prompt, count, thread_id: tidAtStart ?? undefined }),
        signal: ac.signal,
      });
      // Server resolves / creates the thread + persists user prompt
      // immediately. Capture the echoed id so follow-up chat turns
      // continue the same conversation, and so the rail picks it up.
      const echoedThreadId = res.headers.get("x-sansxel-thread-id");
      if (echoedThreadId && echoedThreadId !== threadIdRef.current) {
        setThreadId(echoedThreadId);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("thread", echoedThreadId);
          url.searchParams.delete("new");
          window.history.replaceState({}, "", url.pathname + url.search);
          window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
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
        window.dispatchEvent(new CustomEvent("sansxel:threads:changed"));
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
      if (message) setChatError(message);
      // Drop the placeholder so the chat doesn't show "Generating…"
      // forever. Match anything that STARTS with "Generating "
      // because the Stop button may have appended a cancellation
      // tail to the same bubble before this catch ran.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.role === "assistant" &&
          /^Generating /.test(last.content)
        ) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
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
        // Tear down the live preview recognizer; Whisper takes over.
        if (speechRecognitionRef.current) {
          try { speechRecognitionRef.current.stop(); } catch { /* ignore */ }
          speechRecognitionRef.current = null;
        }
        finalTranscriptRef.current = "";
        setLiveTranscript("");
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

      // Kick off the parallel Web Speech recognizer for live preview
      // text. Silently no-ops on browsers that don't support it
      // (Safari, Firefox); Whisper still works either way.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SR =
          (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition;
        if (SR) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rec: any = new SR();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = navigator.language || "en-US";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onresult = (event: any) => {
            // Walk only the new results since last event. Final pieces
            // get committed to the ref accumulator (persistent across
            // events); interim is always the latest replacement, never
            // appended, that's the source of the duplication bug.
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const t = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscriptRef.current += t;
              } else {
                interim += t;
              }
            }
            setLiveTranscript((finalTranscriptRef.current + interim).trimStart());
          };
          rec.onerror = () => {
            // Permission denied / network, leave preview empty,
            // Whisper takes over on stop.
          };
          rec.start();
          speechRecognitionRef.current = rec;
          finalTranscriptRef.current = "";
          setLiveTranscript("");
        }
      } catch {
        // ignore, preview is best-effort
      }
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
    // V→V style: enter the full-screen orb overlay + continuous loop.
    // V→T style: one-shot dictation, no overlay, no TTS, no auto-loop.
    // The two modes need to look and feel obviously different.
    if (lei.voiceStyle === "v2v") {
      setVoiceMode(true);
    }
    await startRecording();
  }, [startRecording, lei.voiceStyle]);

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
  const hideTranscript = voiceMode && lei.voiceStyle === "v2v";

  return (
    <section className={`webchat${hideTranscript ? " webchat--v2v" : ""}`}>
      {voiceMode && (
        <WebVoiceOverlay
          state={voiceState}
          level={audioLevel}
          error={chatError}
          onMicTap={() => {
            // Tapping the orb when there's an error clears it +
            // retries (most common case: mic permission was denied
            // but user wants another try).
            if (chatError) setChatError(null);
            if (voiceState === "recording") {
              const r = recorderRef.current;
              if (r && r.state !== "inactive") r.stop();
            } else if (voiceState === "speaking") {
              if (audioElRef.current) {
                audioElRef.current.pause();
                audioElRef.current = null;
              }
              stopAnalyser();
              setVoiceState("idle");
              void startRecording();
            } else if (voiceState === "idle") {
              void startRecording();
            }
          }}
          onExit={exitVoiceMode}
        />
      )}

      <div className="webchat-bar">
        <div className="webchat-bar-left">
          <span className="webchat-eyebrow">sansxel-1</span>
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
                "sansxel-1"}
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
          <span className="webchat-plan">Plan: {planDisplayName(plan)}</span>
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

      {/* Web is the trial. Desktop is where the real workshop lives. */}
      <div className="webchat-desktop-cta">
        <div className="webchat-desktop-cta-copy">
          <span className="webchat-desktop-cta-kicker">
            The real workshop runs on desktop
          </span>
          <p>
            File edits, MCP tools, the full voice loop without browser permissions.
            Web is great for a taste, desktop is where you ship.
          </p>
        </div>
        <div className="webchat-desktop-cta-actions">
          <div className="webchat-desktop-cta-badges" aria-hidden="true">
            <span className="webchat-desktop-chip">Touches your files</span>
            <span className="webchat-desktop-chip">MCP servers</span>
            <span className="webchat-desktop-chip">No mic prompts</span>
          </div>
          <a href="/download" className="webchat-desktop-cta-link">
            Get sansxel desktop →
          </a>
        </div>
      </div>

      <div className="webchat-scroll" ref={scrollRef} onScroll={onScroll}>
        {showEmpty ? (
          <div className="webchat-empty">
            <div className="webchat-empty-mark">sansxel-1</div>
            <h2>What are you making?</h2>
            <p>
              Type, talk, or drop something in. The shop adapts to whatever you&rsquo;re
              working on, code, design, research, a half-baked idea at 2am.
            </p>
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
            <div className="webchat-empty-suggestions">
              {[
                "Help me debug this React state issue",
                "Summarize what's in this PDF",
                "Brainstorm 5 names for my side project",
                "Humanize this essay so it doesn't sound AI",
                "Plan my day from these 6 tasks",
                "Generate an image of a neon sansxel logo",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="webchat-empty-suggestion"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="webchat-list">
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const isInflight =
                isLast && m.role === "assistant" && streaming && m.content === "";
              const isStillStreaming =
                isLast && m.role === "assistant" && streaming && m.content !== "";
              return (
                <div
                  key={i}
                  className={`webchat-msg webchat-msg--${m.role}`}
                >
                  {isInflight ? (
                    <div className="webchat-inflight">
                      {phaseLabel && (
                        <div className="webchat-phase-pill" aria-live="polite">
                          {phaseLabel}
                        </div>
                      )}
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
                    />
                  ) : (
                    <WebUserBubble content={m.content} images={m.images} />
                  )}
                </div>
              );
            })}
            {chatError && <ChatErrorPill message={chatError} />}
          </div>
        )}
        {showJumpToBottom && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="webchat-jump-bottom"
            aria-label="Jump to latest"
          >
            <span aria-hidden>↓</span>
            <span>Jump to latest</span>
          </button>
        )}
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
          value={
            voiceState === "recording" && liveTranscript
              ? liveTranscript
              : input
          }
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            voiceState === "recording"
              ? "Listening… speak now"
              : voiceState === "transcribing"
                ? "Transcribing…"
                : voiceState === "speaking"
                  ? "Speaking…"
                  : "Message sansxel-1…"
          }
          rows={1}
          disabled={voiceState === "recording" || voiceState === "transcribing"}
          className={voiceState === "recording" && liveTranscript ? "is-live-transcript" : undefined}
        />
        <div className="webchat-input-actions">
          <div className="webchat-input-actions-left">
            <span
              className={`webchat-cost${costPreview.planCovers ? " webchat-cost--covered" : ""}`}
              title={
                costPreview.planCovers
                  ? `Included in your ${planDisplayName(plan)} plan, no credits used unless you exceed your weekly cap`
                  : `This action costs ${costPreview.credits} credits (${costPreview.usd})`
              }
            >
              {costPreview.planCovers ? `✓ ${planDisplayName(plan)}` : `≈ ${costPreview.credits} credits`}
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
                  &ldquo;draw me a logo&rdquo;, etc., and Send. sansxel-1 routes it automatically.
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
            <button
              type="submit"
              disabled={!input.trim() && lei.attachments.length === 0}
              className="webchat-send"
            >
              Send
            </button>
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
      title="Talk to sansxel-1"
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
    subStatus = "Sansxel will listen, then talk back. Tap again to interrupt.";
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
}: {
  content: string;
  streaming: boolean;
  userPrompt?: string;
  onIterate?: (prompt: string) => void;
  onPrefillInput?: (text: string) => void;
}) {
  // Strip thinking blocks, internal reasoning isn't shown to the user.
  const sections = parseSections(content).filter((s) => s.type !== "thinking");

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
              remarkPlugins={[remarkGfm]}
              urlTransform={(url) => url}
            >
              {s.text}
            </ReactMarkdown>
            {streaming && isLast && <span className="webchat-cursor" />}
          </div>
        );
      })}
    </>
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
}: {
  content: string;
  images?: Array<{ media_type: string; data: string }>;
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
            download={`sansxel-image-${i + 1}.png`}
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
function ChatErrorPill({ message }: { message: string }) {
  const lower = message.toLowerCase();
  const isCapBlock =
    lower.includes("weekly") ||
    lower.includes("resets") ||
    lower.includes("boost") ||
    lower.includes("upgrade");
  if (!isCapBlock) {
    return <div className="webchat-error">{message}</div>;
  }
  return (
    <div className="webchat-error">
      <div>{message}</div>
      <div className="webchat-error-actions">
        <a href="/account/billing" className="webchat-error-cta">
          Open billing
        </a>
        <a href="/pricing" className="webchat-error-cta webchat-error-cta--ghost">
          See plans
        </a>
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

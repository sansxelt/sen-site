import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ALL_MODEL_OPTIONS,
  type ChatMessage,
  fetchSpeech,
  getSubscription,
  type ModelTier,
  streamChat,
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

type DesktopChatViewProps = {
  session: DesktopSession;
  onOpenPlan: () => void;
};

type VoiceState = "idle" | "recording" | "transcribing" | "warming" | "speaking";

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
}: DesktopChatViewProps) {
  const { prefs, update } = usePreferences();
  const [threads, setThreads] = useState<DesktopThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [titleFlashId, setTitleFlashId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
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
  const messages = useMemo(() => activeThread?.messages ?? [], [activeThread]);
  const isCopilot = prefs.window_mode !== "normal";
  const activeModel = useMemo(
    () => ALL_MODEL_OPTIONS.find((option) => option.tier === tier) ?? ALL_MODEL_OPTIONS[0],
    [tier],
  );
  const emptyState = EMPTY_STATE_BY_TIER[tier];

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
            setVoiceState("idle");
          }
        } catch (err) {
          setChatError(err instanceof Error ? err.message : "Transcribe failed.");
          setVoiceState("idle");
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

  const send = useCallback(async (overrideText?: string, fromVoice = false) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    lastTurnVoiceRef.current = fromVoice;

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const threadId = activeThreadIdRef.current ?? createFreshThread();
    const thread =
      threadsRef.current.find((entry) => entry.id === threadId) ?? createThread({ id: threadId });
    const userMessage: ChatMessage = { role: "user", content: text };
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
    setStreaming(true);
    setChatError(null);
    streamingThreadIdRef.current = threadId;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      smoothStream.reset();
      for await (const chunk of streamChat(session.token, nextMessages, {
        tier,
        inputMode: fromVoice ? "voice" : "text",
        persona: prefs.persona,
        signal: controller.signal,
        onMeta: (meta) => {
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
        },
      })) {
        smoothStream.push(chunk);
      }
      smoothStream.end();
      const assistant = await smoothStream.drained();
      streamingThreadIdRef.current = null;

      updateThread(threadId, (current) => ({
        ...current,
        preview: buildThreadPreview(current.messages),
        updatedAt: new Date().toISOString(),
      }));

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
    createFreshThread,
    flashTitle,
    input,
    playVoiceCue,
    prefs.auto_speak_replies,
    prefs.conversational,
    prefs.persona,
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

  const toggleCopilot = useCallback(async () => {
    const nextMode = prefs.window_mode === "normal" ? "toolbar-right" : "normal";
    await update({ window_mode: nextMode });
    try {
      await invoke("set_window_mode", { mode: nextMode });
    } catch {
      // saved even if the native call fails in development
    }
  }, [prefs.window_mode, update]);

  const showEmpty = messages.length === 0;

  return (
    <div
      className={`chat-shell chat-shell--model-${tier}${isCopilot ? " chat-shell--copilot" : ""}`}
    >
      {voiceMode && (
        <VoiceOverlay
          state={voiceState}
          level={audioLevel}
          onExit={exitVoiceMode}
        />
      )}

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

        <div className="chat-history-list">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className={`chat-history-item${thread.id === activeThreadId ? " active" : ""}${titleFlashId === thread.id ? " is-updating" : ""}`}
              onClick={() => setActiveThreadId(thread.id)}
            >
              <div className="chat-history-item-title">{thread.title}</div>
              <div className="chat-history-item-preview">{thread.preview}</div>
              <div className="chat-history-item-time">
                {formatThreadTime(thread.updatedAt)}
              </div>
            </button>
          ))}
        </div>

        <div className="chat-history-foot">
          <div className="chat-history-foot-copy">
            Topics rename themselves when the conversation genuinely shifts.
          </div>
        </div>
      </aside>

      <div className="chat">
        <div className="chat-topbar">
          <div className="chat-title-wrap">
            <div className="chat-title-kicker">
              {isCopilot ? "PC copilot" : "Current thread"}
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
            <button
              type="button"
              className={`chat-copilot-btn${isCopilot ? " active" : ""}`}
              onClick={() => void toggleCopilot()}
            >
              {isCopilot ? "Exit copilot" : "PC copilot"}
            </button>
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
                        content={message.content}
                        streaming={isStillStreaming}
                      />
                    ) : (
                      message.content
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
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
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
                disabled={!input.trim()}
                className="chat-send"
                title="Send"
              >
                <SendIcon />
              </button>
            )}
          </div>
        </form>
      </div>
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
            : "Tap to talk";

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
}: {
  content: string;
  streaming: boolean;
}) {
  const sections = parseSections(content).filter((section) => section.type !== "thinking");
  return (
    <>
      {sections.map((section, index) => {
        const isLastSection = index === sections.length - 1;
        if (streaming && isLastSection) {
          return (
            <span key={index}>
              <span className="chat-stream-text">{section.text}</span>
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
    </>
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

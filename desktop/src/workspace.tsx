import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  type AccountProfile,
  ALL_MODEL_OPTIONS,
  type ChatMessage,
  type DesktopPreferences,
  fetchSpeech,
  getAccount,
  getSubscription,
  type ModelTier,
  patchAccount,
  streamChat,
  type Subscription,
  transcribeAudio,
  TTS_VOICES,
  PERSONA_OPTIONS,
  getWeeklyUsage,
  listDesktopApiKeys,
  createDesktopApiKey,
  revokeDesktopApiKey,
  type WeeklyUsageSummary,
  type ApiKeySummary,
} from "./api";
import packageJson from "../package.json";

// v0.1.13 \u2014 read version from package.json instead of hardcoding,
// so the nav-rail account-card label can never drift behind the
// actual installed build (was stuck at "0.1.10" for several releases).
const APP_VERSION = packageJson.version;
import { usePreferences } from "./preferences";
import type { DesktopSession } from "./auth";
import { parseSections } from "./sections";
import { useSmoothStream } from "./use-smooth-stream";
import { DesktopChatView } from "./chat-view";
import { DesktopPlanView } from "./plan-view";
import { DesktopUsageView } from "./usage-view";
import { DesktopMemoryView } from "./memory-view";
import { DesktopSourcesView } from "./sources-view";
import { DesktopIntegrationsView } from "./integrations-view";
import { DesktopUpdatesView } from "./updates-view";
import { DesktopSettingsView } from "./settings-view";
import { LANGUAGES } from "./i18n/strings";

type View =
  | "chat"
  | "account"
  | "plan"
  | "usage"
  | "keys"
  | "preferences"
  | "memory"
  | "sources"
  | "integrations"
  | "updates"
  | "settings";

type WorkspaceProps = {
  session: DesktopSession;
  onSignOut: () => void;
};

export function Workspace({ session, onSignOut }: WorkspaceProps) {
  const [view, setView] = useState<View>("chat");

  // Esc on any non-chat view returns to Chat. Acts as a universal
  // "back to default" shortcut. Skipped while focus is in an input
  // / textarea / contenteditable so it doesn't fight typing.
  useEffect(() => {
    if (view === "chat") return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      event.preventDefault();
      setView("chat");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  // Window mode shortcuts — Ctrl+Shift+N normal, Ctrl+Shift+T top,
  // Ctrl+Shift+L left, Ctrl+Shift+R right. Lets power users snap
  // sansxel into a toolbar position alongside other apps without
  // opening Preferences.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      const map: Record<string, string> = {
        N: "normal",
        T: "toolbar-top",
        L: "toolbar-left",
        R: "toolbar-right",
      };
      const mode = map[event.key.toUpperCase()];
      if (!mode) return;
      event.preventDefault();
      void invoke("set_window_mode", { mode }).catch(() => {});
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="ws">
      <NavRail
        active={view}
        onChange={setView}
        session={session}
      />
      <div className="ws-main">
        {view === "chat" && (
          <DesktopChatView
            session={session}
            onOpenPlan={() => setView("plan")}
            onOpenSources={() => setView("sources")}
            // v0.1.8 — generic view-switcher used by the navigate
            // tool. The chat view dispatches tool_use blocks to a
            // local registry; a navigate(view) call hits this.
            onNavigate={(next) => setView(next as View)}
          />
        )}
        {view === "account" && (
          <AccountView session={session} onSignOut={onSignOut} onView={setView} />
        )}
        {view === "plan" && <DesktopPlanView session={session} />}
        {view === "usage" && (
          <DesktopUsageView session={session} onOpenPlan={() => setView("plan")} />
        )}
        {view === "keys" && <KeysView session={session} />}
        {view === "preferences" && <PreferencesView />}
        {view === "memory" && <DesktopMemoryView session={session} />}
        {view === "sources" && <DesktopSourcesView session={session} />}
        {view === "integrations" && <DesktopIntegrationsView session={session} />}
        {view === "updates" && <DesktopUpdatesView session={session} />}
        {view === "settings" && <DesktopSettingsView />}
      </div>
    </div>
  );
}

// ── Nav rail ─────────────────────────────────────────────────────────

function NavRail({
  active,
  onChange,
  session,
}: {
  active: View;
  onChange: (v: View) => void;
  session: DesktopSession;
}) {
  const email = session.email;
  const displayName = session.displayName ?? email.split("@")[0];
  const initial = (displayName ?? email).slice(0, 1).toUpperCase();
  const [planLabel, setPlanLabel] = useState<string>("—");

  // Pull plan tier so the account card can show "Pro · v0.1.4"
  // instead of just an avatar circle.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sub = await getSubscription(session.token);
        if (!cancelled) {
          setPlanLabel(capitalize(sub.plan ?? "free"));
        }
      } catch {
        // Silent — keep — placeholder
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  return (
    <aside className="ws-nav">
      {/* v0.1.13 \u2014 renamed from "Capsule Rail" (internal codename)
          to the user-facing "Sansxel Copilot" with a clearer subtitle.
          Same prominent CTA \u2014 violet accent, pulsing dot \u2014 so it
          stays discoverable in the nav. */}
      <button
        type="button"
        className="ws-nav-copilot-cta"
        title="Open the floating sansxel copilot \u2014 sits above every other window"
        onClick={() => {
          void invoke("show_copilot").catch(() => {});
          void invoke("position_copilot_window", { edge: "right", open: false }).catch(() => {});
        }}
      >
        <span className="ws-nav-copilot-cta-icon" aria-hidden>
          <span className="ws-nav-copilot-cta-pulse" />
        </span>
        <span className="ws-nav-copilot-cta-text">
          <span className="ws-nav-copilot-cta-title">Sansxel Copilot</span>
          <span className="ws-nav-copilot-cta-sub">Always on, anywhere</span>
        </span>
      </button>

      <div className="ws-nav-items">
        <NavButton
          active={active === "chat"}
          onClick={() => onChange("chat")}
          label="Chat"
        >
          <ChatIcon />
        </NavButton>
        <NavButton
          active={active === "plan"}
          onClick={() => onChange("plan")}
          label="Plan"
        >
          <PlanIcon />
        </NavButton>
        <NavButton
          active={active === "usage"}
          onClick={() => onChange("usage")}
          label="Usage"
        >
          <UsageIcon />
        </NavButton>
        <NavButton
          active={active === "memory"}
          onClick={() => onChange("memory")}
          label="Memory"
        >
          <MemoryIcon />
        </NavButton>
        <NavButton
          active={active === "sources"}
          onClick={() => onChange("sources")}
          label="Sources"
        >
          <SourcesIcon />
        </NavButton>
        <NavButton
          active={active === "integrations"}
          onClick={() => onChange("integrations")}
          label="Integrations"
        >
          <IntegrationsIcon />
        </NavButton>
        <NavButton
          active={active === "keys"}
          onClick={() => onChange("keys")}
          label="API keys"
        >
          <KeysIcon />
        </NavButton>
        <NavButton
          active={active === "preferences"}
          onClick={() => onChange("preferences")}
          label="Preferences"
        >
          <PrefsIcon />
        </NavButton>
        <NavButton
          active={active === "settings"}
          onClick={() => onChange("settings")}
          label="Settings"
        >
          <SettingsIcon />
        </NavButton>
        <NavButton
          active={active === "updates"}
          onClick={() => onChange("updates")}
          label="Updates"
        >
          <UpdatesIcon />
        </NavButton>
      </div>

      <div className="ws-nav-foot">
        {/* Account card — collapsed shows just the avatar, expanded
            (on hover of nav rail) reveals name, email, plan, version. */}
        <button
          type="button"
          className={`ws-nav-account${active === "account" ? " active" : ""}`}
          onClick={() => onChange("account")}
          title={`Account (${email})`}
        >
          <span className="ws-nav-avatar-circle">{initial}</span>
          <span className="ws-nav-account-text">
            <span className="ws-nav-account-name">{displayName}</span>
            <span className="ws-nav-account-email">{email}</span>
            <span className="ws-nav-account-meta">
              <span className="ws-nav-account-plan">{planLabel}</span>
              <span className="ws-nav-account-version">v{APP_VERSION}</span>
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`ws-nav-btn${active ? " active" : ""}`}
      aria-label={label}
    >
      <span className="ws-nav-btn-icon">{children}</span>
      <span className="ws-nav-label">{label}</span>
    </button>
  );
}

// ── Chat view (the main interaction) ─────────────────────────────────

export function ChatView({ session }: { session: DesktopSession }) {
  const { prefs } = usePreferences();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [tier, setTier] = useState<ModelTier>(prefs.default_tier);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing" | "speaking">("idle");
  // True = full-screen voice mode (orb takeover). False = inline mic button only.
  const [voiceMode, setVoiceMode] = useState(false);
  // Live audio volume 0..1, drives the orb scale. Read from mic when
  // listening, from the playback audio when speaking.
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
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  // Audio analysis (for the orb)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Pull the user's plan once so the picker can lock paid tiers
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sub = await getSubscription(session.token);
        if (cancelled) return;
        setAllowedTiers(new Set(sub.tiers.map((t) => t.tier)));
        setPlanForGating(sub.plan);
      } catch {
        // Defaults already let everything through; downgrade happens
        // server-side anyway.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  // Re-sync the chat tier when the preference changes (e.g. user
  // changes default in PreferencesView).
  useEffect(() => {
    setTier(prefs.default_tier);
  }, [prefs.default_tier]);

  // Smooth streaming text — drains chunk buffer at a steady ~300
  // chars/sec so the reveal looks even, not jittery.
  const smoothStream = useSmoothStream({
    charsPerFrame: 5,
    onTick: (visible) => {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { ...last, content: visible };
        }
        return copy;
      });
    },
  });

  // ── Voice-mode central state (refs so the rAF loop stays current)
  const voiceStateRef = useRef(voiceState);
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  const voiceModeRef = useRef(voiceMode);
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Hoisted so `send` can reference them — they don't depend on send.
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

  // VAD timing — drives auto-stop and interruption.
  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const interruptHandlerRef = useRef<(() => void) | null>(null);
  // Adaptive noise floor (EMA of room-ambient level). Speech and
  // silence are defined RELATIVE to this floor — fixed thresholds
  // fail in noisy rooms / quiet mics. Starts pessimistic so we don't
  // immediately treat the first frame as silence.
  const noiseFloorRef = useRef(0.04);
  // Did the user actually speak this turn? Prevents auto-submitting
  // an empty recording when they're just sitting in voice mode.
  const heardSpeechRef = useRef(false);

  const VAD_MIN_RECORD_MS = 400;
  const VAD_SILENCE_HOLD_MS = 800;
  // Deltas above the floor — kept small because the floor adapts.
  const SPEECH_DELTA = 0.06;
  const SILENCE_DELTA = 0.025;
  // Interrupt while AI is speaking — slightly louder than just speech
  // so room echo of the playback doesn't trigger a self-interrupt.
  const INTERRUPT_DELTA = 0.09;
  const INTERRUPT_HOLD_MS = 140;

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

      // Update noise floor when we're NOT actively in speech. Slow
      // EMA toward current quiet samples; fast track-down when level
      // drops well below floor (mic just got quieter).
      if (level < speechCutoff) {
        const alpha = level < floor ? 0.15 : 0.02;
        noiseFloorRef.current = Math.max(
          0.005,
          floor * (1 - alpha) + level * alpha,
        );
      }

      // Auto-stop on sustained silence while recording — but only
      // AFTER we've heard the user actually speak this turn.
      if (state === "recording" && voiceModeRef.current) {
        const elapsed = now - recordingStartedAtRef.current;
        if (level > speechCutoff) {
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
            const r = mediaRecorderRef.current;
            if (r && r.state !== "inactive") r.stop();
            silenceStartRef.current = null;
          }
        } else {
          silenceStartRef.current = null;
        }
      } else {
        silenceStartRef.current = null;
      }

      // Interrupt: user speaks while AI is talking → cut AI off
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

  // startRecording is defined AFTER send (because it calls send), but
  // send needs to be able to (re)trigger recording when AI finishes
  // speaking in conversational mode. Bridge with a ref.
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async (overrideText?: string, fromVoice = false) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    lastTurnVoiceRef.current = fromVoice;

    // If a previous stream is still running, abort it. The new
    // message takes priority (same UX as ChatGPT).
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMsgs = [...messages, userMsg];
    setMessages([...nextMsgs, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setChatError(null);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      smoothStream.reset();
      for await (const chunk of streamChat(session.token, nextMsgs, {
        tier,
        inputMode: fromVoice ? "voice" : "text",
        persona: prefs.persona,
        signal: ac.signal,
        onMeta: (meta) => {
          if (
            meta.tier_requested &&
            meta.tier_resolved &&
            meta.tier_requested !== meta.tier_resolved
          ) {
            setPlanNotice(
              `Your plan doesn't include ${meta.tier_requested} — replied with ${meta.tier_resolved} instead.`,
            );
          } else {
            setPlanNotice(null);
          }
        },
      })) {
        smoothStream.push(chunk);
      }
      smoothStream.end();
      // Wait for the reveal to catch up before kicking off TTS so the
      // spoken audio matches what's visible on screen.
      const assistant = await smoothStream.drained();

      // Auto-speak if this turn was voice OR the user prefers
      // every reply spoken.
      const shouldSpeak =
        !!assistant.trim() &&
        (lastTurnVoiceRef.current || prefs.auto_speak_replies);
      if (shouldSpeak) {
        lastTurnVoiceRef.current = false;
        try {
          setVoiceState("speaking");
          const blob = await fetchSpeech(session.token, assistant, prefs.voice);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioElRef.current = audio;

          // Wire up interrupt: if the mic-volume loop sees the user
          // start talking while we're playing, this handler runs.
          interruptHandlerRef.current = () => {
            try {
              audio.pause();
            } catch {
              // ignore
            }
            URL.revokeObjectURL(url);
            if (audioElRef.current === audio) audioElRef.current = null;
            setVoiceState("idle");
            interruptHandlerRef.current = null;
            // Switch straight back into recording so the user's
            // interruption gets captured as the next turn.
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
      // Aborts are intentional, not errors
      if ((err as { name?: string })?.name === "AbortError") {
        return;
      }
      setChatError(err instanceof Error ? err.message : "Chat failed.");
      setMessages((prev) => {
        // If the in-flight assistant is empty, drop it. Otherwise keep
        // the partial response so the user sees what arrived.
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }, [
    input,
    messages,
    session.token,
    tier,
    prefs.auto_speak_replies,
    prefs.conversational,
    prefs.persona,
    prefs.voice,
    smoothStream,
  ]);

  const exitVoiceMode = useCallback(() => {
    // Stop everything voice-related
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
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

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  // ── Voice ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      // In voice mode, the mic stream is shared across turns. Reuse
      // the existing one so we don't ask for permission every turn
      // and the analyser keeps running.
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
        // Hold onto the stream if voice mode is still active; the
        // next turn's recorder will reuse it. Only release on
        // exitVoiceMode().
        if (!voiceModeRef.current && micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
          stopAnalyser();
        }
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setVoiceState("transcribing");
        try {
          const text = await transcribeAudio(session.token, blob);
          if (text.trim()) {
            setVoiceState("idle");
            await send(text, true);
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
  }, [session.token, send, stopAnalyser, beginVolumeLoop]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  // Keep the ref pointing at the latest startRecording so send() can
  // re-trigger recording in conversational mode without circular deps.
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  // Voice-mode entry — opens the orb overlay and starts recording.
  const enterVoiceMode = useCallback(async () => {
    setVoiceMode(true);
    await startRecording();
  }, [startRecording]);

  // (Manual speak / stopSpeaking helpers removed — voice mode handles
  // both directions via the orb takeover, so the inline speaker
  // button is gone.)

  const showEmpty = messages.length === 0;

  return (
    <div className="chat">
      {voiceMode && (
        <VoiceOverlay
          state={voiceState}
          level={audioLevel}
          onMicTap={() => {
            if (voiceState === "recording") stopRecording();
            else if (voiceState === "speaking") {
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

      <div className="chat-topbar">
        <ModelPicker tier={tier} onChange={setTier} allowedTiers={allowedTiers} />
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
            ×
          </button>
        </div>
      )}

      <div className="chat-scroll" ref={scrollRef}>
        {showEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-mark">sansxel-1</div>
            <h2>Ask anything.</h2>
            <p>Ideas, drafts, code, plans — the AI that remembers what you’re building.</p>
          </div>
        ) : (
          <div className="chat-list">
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const isInflight =
                isLast && m.role === "assistant" && streaming && m.content === "";
              const isStillStreaming =
                isLast && m.role === "assistant" && streaming && m.content !== "";
              return (
                <div
                  key={i}
                  className={`chat-msg chat-msg--${m.role}`}
                >
                  {isInflight ? (
                    <BounceDots />
                  ) : m.role === "assistant" ? (
                    <AssistantBubble
                      content={typeof m.content === "string" ? m.content : ""}
                      streaming={isStillStreaming}
                    />
                  ) : (
                    typeof m.content === "string" ? m.content : ""
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
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            const enterSends = prefs.send_on_enter;
            const isEnter = e.key === "Enter" && !e.shiftKey;
            const isCmdEnter =
              e.key === "Enter" && (e.ctrlKey || e.metaKey);
            if ((enterSends && isEnter) || (!enterSends && isCmdEnter)) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            voiceState === "recording"
              ? "Listening…"
              : voiceState === "transcribing"
                ? "Transcribing…"
                : voiceState === "speaking"
                  ? "Speaking…"
                  : prefs.send_on_enter
                    ? "Message sansxel-1…"
                    : "Message sansxel-1… (Ctrl+Enter to send)"
          }
          rows={1}
          disabled={voiceState === "recording" || voiceState === "transcribing"}
        />
        <div className="chat-input-actions">
          {/* Single voice button — handles both directions via the
              orb takeover. Free plan = locked with upgrade hint. */}
          {planForGating === "free" ? (
            <button
              type="button"
              onClick={() => void openUrl("https://sansxel.ai/pricing")}
              className="chat-icon-btn chat-icon-btn--locked"
              title="Voice is on paid plans — upgrade to unlock"
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
  );
}

// Full-screen voice mode — orb takeover that floats above the chat.
// The chat stays visible, dimmed underneath the overlay.
function VoiceOverlay({
  state,
  level,
  onMicTap,
  onExit,
}: {
  state: "idle" | "recording" | "transcribing" | "speaking";
  level: number;
  onMicTap: () => void;
  onExit: () => void;
}) {
  const status =
    state === "recording"
      ? "Listening"
      : state === "transcribing"
        ? "Thinking"
        : state === "speaking"
          ? "Speaking"
          : "Listening";

  // Gentle baseline + level-driven pulse. Capped so loud audio doesn't
  // blow the orb out of view.
  const scale = 1 + Math.min(level * 0.55, 0.55);

  // ESC closes voice mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

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
          style={{ transform: `scale(${scale})` }}
          aria-label={status}
        >
          <span className="voice-orb-inner" />
          <span className="voice-orb-ring" />
          <span className="voice-orb-ring voice-orb-ring--lg" />
        </button>

        <div className="voice-overlay-status">
          <span className={`voice-overlay-dot voice-overlay-dot--${state}`} />
          {status}
        </div>

        <div className="voice-overlay-hint">
          Hands-free — just talk. Esc to leave.
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
  onChange: (t: ModelTier) => void;
  allowedTiers: Set<ModelTier>;
}) {
  const [open, setOpen] = useState(false);
  const current = ALL_MODEL_OPTIONS.find((m) => m.tier === tier) ?? ALL_MODEL_OPTIONS[0];

  return (
    <div className="model-picker">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="model-picker-trigger"
      >
        <span className="model-picker-name">{current.display_name}</span>
        <span className="model-picker-caret">▾</span>
      </button>
      {open && (
        <div className="model-picker-menu">
          {ALL_MODEL_OPTIONS.map((opt) => {
            const locked = !allowedTiers.has(opt.tier);
            return (
              <button
                type="button"
                key={opt.tier}
                onClick={() => {
                  if (locked) return;
                  onChange(opt.tier);
                  setOpen(false);
                }}
                disabled={locked}
                className={`model-picker-item${opt.tier === tier ? " active" : ""}${locked ? " locked" : ""}`}
              >
                <div className="model-picker-item-name">
                  {opt.display_name}
                  {locked && <span className="model-picker-lock">Upgrade</span>}
                </div>
                <div className="model-picker-item-blurb">{opt.blurb}</div>
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
  // Drop any thinking blocks — internal reasoning isn't shown to the
  // user. The tag stays in the raw content (and in the scrollback for
  // future "show reasoning" toggles), it just doesn't render.
  const sections = parseSections(content).filter((s) => s.type !== "thinking");
  return (
    <>
      {sections.map((s, i) => {
        const isLastSection = i === sections.length - 1;
        // Mid-stream: render plain text to avoid markdown re-parse
        // flicker. Once the stream is done, full markdown formatting
        // kicks in.
        if (streaming && isLastSection) {
          return (
            <span key={i}>
              <span className="chat-stream-text">{s.text}</span>
              <span className="chat-cursor" />
            </span>
          );
        }
        return (
          <div key={i} className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.text}</ReactMarkdown>
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

// ── Other views (placeholders — real data lands next push) ──────────

function AccountView({
  session,
  onSignOut,
  onView,
}: {
  session: DesktopSession;
  onSignOut: () => void;
  onView: (v: View) => void;
}) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local edit state (committed on Save)
  const [displayName, setDisplayName] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getAccount(session.token);
        if (cancelled) return;
        setProfile(p);
        setDisplayName(p.display_name ?? "");
        setFocusArea(p.focus_area ?? "");
        setWorkStyle(p.work_style ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const dirty =
    profile != null &&
    (displayName !== (profile.display_name ?? "") ||
      focusArea !== (profile.focus_area ?? "") ||
      workStyle !== (profile.work_style ?? ""));

  async function save() {
    setSaveStatus("saving");
    try {
      const next = await patchAccount(session.token, {
        display_name: displayName || null,
        focus_area: focusArea || null,
        work_style: workStyle || null,
      });
      setProfile(next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaveStatus("idle");
    }
  }

  return (
    <div className="view view--account">
      <div className="view-head">
        <h1>Account</h1>
        <p>How sansxel knows you. Used to personalize replies and the workspace.</p>
      </div>
      <div className="view-body">
        {loading && <div className="view-loading">Loading…</div>}
        {!loading && (
          <>
            <FieldRow label="Email" value={session.email} />
            <EditableField
              label="Display name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="What should sansxel call you?"
            />
            <EditableField
              label="Focus area"
              value={focusArea}
              onChange={setFocusArea}
              placeholder="What are you mostly working on?"
            />
            <EditableField
              label="Work style"
              value={workStyle}
              onChange={setWorkStyle}
              placeholder="Solo deep work, lots of meetings, building products…"
              multiline
            />

            <div className="view-actions">
              {saveStatus === "saved" && (
                <span className="view-saved-tag">Saved</span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saveStatus === "saving"}
                className="view-save-btn"
              >
                {saveStatus === "saving" ? "Saving…" : "Save changes"}
              </button>
            </div>

            {error && <div className="view-error">{error}</div>}

            <div className="account-jump-grid">
              <button type="button" className="account-jump" onClick={() => onView("plan")}>
                <div className="account-jump-title">Plan</div>
                <div className="account-jump-sub">Subscription, tier limits, upgrade</div>
              </button>
              <button type="button" className="account-jump" onClick={() => onView("usage")}>
                <div className="account-jump-title">Usage</div>
                <div className="account-jump-sub">Weekly requests + tokens</div>
              </button>
              <button type="button" className="account-jump" onClick={() => onView("keys")}>
                <div className="account-jump-title">API keys</div>
                <div className="account-jump-sub">Create, name, and revoke sk_sen_… keys</div>
              </button>
              <button type="button" className="account-jump" onClick={() => onView("preferences")}>
                <div className="account-jump-title">Preferences</div>
                <div className="account-jump-sub">Persona, voice, density, accent, window mode</div>
              </button>
            </div>

            <div className="account-signout-row">
              <button
                type="button"
                onClick={onSignOut}
                className="account-signout"
                title="Sign out of this desktop"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PlanView({ session }: { session: DesktopSession }) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSubscription(session.token);
        if (!cancelled) setSub(s);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  return (
    <div className="view view--plan">
      <div className="view-head">
        <h1>Plan</h1>
        <p>Your subscription, the AI tiers it unlocks, and where to upgrade.</p>
      </div>
      <div className="view-body">
        {loading && <div className="view-loading">Loading…</div>}
        {!loading && sub && (
          <>
            <FieldRow
              label="Plan"
              value={`${capitalize(sub.plan)}${sub.billing_cycle ? ` · ${sub.billing_cycle}` : ""}`}
            />
            <FieldRow label="Status" value={capitalize(sub.status)} />
            {sub.current_period_end && (
              <FieldRow
                label="Renews"
                value={new Date(sub.current_period_end).toLocaleDateString()}
              />
            )}

            <div className="view-section-title">Models on this plan</div>
            <div className="plan-tiers">
              {sub.tiers.map((t) => (
                <div key={t.tier} className="plan-tier-card">
                  <div className="plan-tier-name">{t.display_name}</div>
                  <div className="plan-tier-blurb">{t.blurb}</div>
                </div>
              ))}
            </div>

            {sub.plan !== "enterprise" && sub.plan !== "teams" && (
              <div className="upgrade-cta">
                <div className="upgrade-cta-head">
                  {sub.plan === "free"
                    ? "Want sansxel-1 (balanced) or sansxel-1 deep?"
                    : "Move up a tier"}
                </div>
                <p>
                  {sub.plan === "free"
                    ? "Upgrade to unlock sharper replies, longer context, voice mode, and the deep-reasoning tier."
                    : "Upgrade for higher weekly limits, voice + tooling, and access to the deep-reasoning tier."}
                </p>
                <button
                  type="button"
                  onClick={() => void openUrl("https://sansxel.ai/pricing")}
                  className="upgrade-cta-btn"
                >
                  See plans →
                </button>
              </div>
            )}
          </>
        )}
        {error && <div className="view-error">{error}</div>}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  // snake_case → Title Case With Spaces
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="field-row field-row--edit">
      <div className="field-label">{label}</div>
      {multiline ? (
        <textarea
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type="text"
          className="field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

export function UsageView({ session }: { session: DesktopSession }) {
  const [data, setData] = useState<WeeklyUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await getWeeklyUsage(session.token);
        if (!cancelled) setData(u);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load usage.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  const reset = data ? new Date(data.week_reset) : null;
  const now = new Date();
  const resetIn = reset ? reset.getTime() - now.getTime() : 0;
  const resetDays = Math.floor(resetIn / (1000 * 60 * 60 * 24));
  const resetHours = Math.floor((resetIn / (1000 * 60 * 60)) % 24);

  const chatPct =
    data && data.weekly_chat_limit && data.weekly_chat_limit > 0
      ? Math.min((data.chat_requests / data.weekly_chat_limit) * 100, 100)
      : 0;

  const voiceUsedSec = Math.round(data?.voice_seconds ?? 0);
  const voiceLimitSec = data?.weekly_voice_seconds_limit ?? null;

  return (
    <div className="view">
      <div className="view-head">
        <h1>Usage</h1>
        <p>
          {reset
            ? `Resets ${reset.toUTCString().slice(0, 22)} (${resetDays}d ${resetHours}h)`
            : "Weekly usage and limits."}
        </p>
      </div>
      <div className="view-body">
        {loading && <div className="view-loading">Loading…</div>}
        {error && <div className="view-error">{error}</div>}
        {data && (
          <>
            <div className="usage-card">
              <div className="usage-card-head">
                <div>
                  <div className="usage-card-tag">This week — chat</div>
                  <div className="usage-card-num">
                    {data.chat_requests.toLocaleString()}
                    <span className="usage-card-of">
                      {" / "}
                      {data.weekly_chat_limit === null
                        ? "unlimited"
                        : data.weekly_chat_limit.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              {data.weekly_chat_limit !== null && (
                <div className="usage-bar">
                  <div className="usage-bar-fill" style={{ width: `${chatPct}%` }} />
                </div>
              )}
              {data.pro_throttle && data.pro_throttle.current_tier && (
                <div className="usage-throttle">
                  <span className="usage-throttle-tag">Pro throttle</span>
                  Currently serving on{" "}
                  <span className="usage-throttle-tier">
                    sansxel-1{" "}
                    {data.pro_throttle.current_tier === "smart"
                      ? "deep"
                      : data.pro_throttle.current_tier}
                  </span>
                  .{" "}
                  {data.pro_throttle.next_downshift_in &&
                  data.pro_throttle.next_downshift_in > 0
                    ? `${data.pro_throttle.next_downshift_in.toLocaleString()} more requests until the next downshift.`
                    : "On the lowest tier this week."}
                </div>
              )}
            </div>

            {voiceLimitSec !== null && voiceLimitSec > 0 && (
              <div className="usage-card">
                <div className="usage-card-head">
                  <div>
                    <div className="usage-card-tag">This week — voice</div>
                    <div className="usage-card-num">
                      {Math.floor(voiceUsedSec / 60)}m {voiceUsedSec % 60}s
                      <span className="usage-card-of">
                        {" / "}
                        {Math.floor(voiceLimitSec / 60)}m
                      </span>
                    </div>
                  </div>
                </div>
                <div className="usage-bar">
                  <div
                    className="usage-bar-fill"
                    style={{
                      width: `${Math.min(
                        (voiceUsedSec / voiceLimitSec) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {data.daily_requests && data.daily_requests.length > 0 && (
              <>
                <div className="view-section-title">Last 7 days</div>
                <div className="usage-chart">
                  {(() => {
                    const max = Math.max(1, ...data.daily_requests);
                    const today = new Date();
                    return data.daily_requests.map((count, i) => {
                      const date = new Date(today);
                      date.setUTCDate(today.getUTCDate() - (6 - i));
                      const label = date.toLocaleDateString("en-US", {
                        weekday: "short",
                      });
                      const pct = (count / max) * 100;
                      return (
                        <div key={i} className="usage-chart-bar-wrap">
                          <div className="usage-chart-count">{count}</div>
                          <div className="usage-chart-bar">
                            <div
                              className="usage-chart-bar-fill"
                              style={{ height: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                          <div className="usage-chart-label">{label}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}

            <div className="view-section-title">Recent activity</div>
            {data.recent.length === 0 ? (
              <div className="usage-empty">No requests recorded yet.</div>
            ) : (
              <div className="usage-list">
                {data.recent.map((r) => (
                  <div key={r.id} className="usage-row">
                    <span className="usage-row-kind">
                      {r.kind === "chat"
                        ? "Chat"
                        : r.kind === "copilot"
                          ? "Copilot"
                          : r.kind === "voice_transcribe"
                            ? "Voice in"
                            : r.kind === "voice_speak"
                              ? "Voice out"
                              : r.kind}
                    </span>
                    <span className="usage-row-meta">
                      {r.model ?? "—"}
                      {r.surface ? ` · ${r.surface}` : ""}
                    </span>
                    <span className="usage-row-tokens">
                      {r.total_tokens > 0
                        ? `${r.total_tokens.toLocaleString()}t`
                        : "—"}
                    </span>
                    <span className="usage-row-time">
                      {new Date(r.created_at).toLocaleString("en-US", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KeysView({ session }: { session: DesktopSession }) {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline create form state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Plaintext key reveal — server only ever returns the secret ONCE.
  // Held in memory until the user dismisses the panel so they can copy
  // it before it's gone forever.
  const [revealed, setRevealed] = useState<{
    name: string;
    rawKey: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Per-row revoke confirmation + spinner
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listDesktopApiKeys(session.token);
      setKeys(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys.");
    }
  }, [session.token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listDesktopApiKeys(session.token);
        if (!cancelled) setKeys(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load keys.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.token]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createDesktopApiKey(session.token, name);
      setRevealed({ name: created.key.name, rawKey: created.rawKey });
      setCopied(false);
      setNewName("");
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyRevealed() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can fail in some Tauri webview contexts. Leave the
      // textbox visible so the user can manually select + copy.
      setCopied(false);
    }
  }

  async function confirmRevoke(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      await revokeDesktopApiKey(session.token, id);
      setPendingRevoke(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke key.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="view view--keys">
      <div className="view-head">
        <h1>API keys</h1>
        <p>
          Your active <code>sk_sen_…</code> keys. Create one to call the
          sansxel API from scripts, agents, or other apps. The full secret
          is shown once at creation — we only store a hash after that.
        </p>
      </div>
      <div className="view-body">
        {loading && <div className="view-loading">Loading…</div>}
        {error && <div className="view-error">{error}</div>}
        {!loading && (
          <>
            {/* Reveal panel — plaintext key + copy. Only chance to grab it. */}
            {revealed && (
              <div className="keys-reveal">
                <div className="keys-reveal-head">New key created</div>
                <p className="keys-reveal-note">
                  This is the only time <strong>{revealed.name}</strong> will be
                  shown in full. Copy it now and store it somewhere safe — we
                  only keep a hash.
                </p>
                <div className="keys-reveal-row">
                  <code className="keys-reveal-key">{revealed.rawKey}</code>
                  <button
                    type="button"
                    onClick={() => void copyRevealed()}
                    className="view-save-btn"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="keys-reveal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setRevealed(null);
                      setCopied(false);
                    }}
                    className="account-signout"
                  >
                    I’ve saved it
                  </button>
                </div>
              </div>
            )}

            {/* Create row — collapsed button, expands into inline form */}
            {!creating ? (
              <div className="keys-create-row">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="view-save-btn"
                >
                  Create new key
                </button>
              </div>
            ) : (
              <form className="keys-create-form" onSubmit={(e) => void submitCreate(e)}>
                <input
                  type="text"
                  className="field-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Key name (e.g. laptop-cli, automation)"
                  maxLength={64}
                  autoFocus
                />
                <div className="keys-create-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="account-signout"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="view-save-btn"
                    disabled={!newName.trim() || submitting}
                  >
                    {submitting ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            )}

            {keys.length === 0 ? (
              <div className="usage-empty">
                <div className="upgrade-cta-head">No API keys yet</div>
                <div className="usage-empty-note">
                  Create one above to start calling the sansxel API. Keys
                  inherit your plan’s rate limits.
                </div>
              </div>
            ) : (
              <div className="usage-list">
                {keys.map((k) => {
                  const isPending = pendingRevoke === k.id;
                  const isRevoking = revokingId === k.id;
                  return (
                    <div key={k.id} className="keys-row">
                      <span className="usage-row-kind">{k.name}</span>
                      <span className="usage-row-meta usage-row-mono">
                        {k.key_prefix}
                      </span>
                      <span className="usage-row-time">
                        {k.last_used_at
                          ? `last used ${new Date(k.last_used_at).toLocaleDateString()}`
                          : `created ${new Date(k.created_at).toLocaleDateString()}`}
                      </span>
                      {isPending ? (
                        <span className="keys-revoke-confirm">
                          <button
                            type="button"
                            className="keys-revoke-confirm-btn"
                            onClick={() => void confirmRevoke(k.id)}
                            disabled={isRevoking}
                          >
                            {isRevoking ? "Revoking…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            className="keys-revoke-cancel-btn"
                            onClick={() => setPendingRevoke(null)}
                            disabled={isRevoking}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="keys-revoke-btn"
                          onClick={() => setPendingRevoke(k.id)}
                          title="Revoke this key"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PreferencesView() {
  const { prefs, update, loading } = usePreferences();

  if (loading) {
    return (
      <div className="view view--preferences">
        <div className="view-head">
          <h1>Preferences</h1>
          <p>How sansxel adapts to you.</p>
        </div>
        <div className="view-body">
          <div className="view-loading">Loading…</div>
        </div>
      </div>
    );
  }

  async function applyWindowMode(mode: DesktopPreferences["window_mode"]) {
    await update({ window_mode: mode });
    try {
      await invoke("set_window_mode", { mode });
    } catch {
      // No-op — the pref still saved; native call may fail in dev hot-reload
    }
  }

  return (
    <div className="view view--preferences">
      <div className="view-head">
        <h1>Preferences</h1>
        <p>How sansxel adapts to you. Everything autosaves.</p>
      </div>

      <div className="view-body">
        <PrefSectionGroup title="AI">
          <PrefSection
            label="Default model"
            help="Which sansxel-1 you start every chat with. The chat picker still lets you swap per message."
          >
            <SegmentedControl<DesktopPreferences["default_tier"]>
              value={prefs.default_tier}
              onChange={(v) => update({ default_tier: v })}
              options={ALL_MODEL_OPTIONS.map((m) => ({
                value: m.tier,
                label: m.display_name.replace("sansxel-1 ", "") || "default",
              }))}
            />
          </PrefSection>

          <PrefSection
            label="Persona"
            help="How sansxel-1 talks. Changes voice + sentence rhythm without changing the model."
          >
            <select
              value={prefs.persona}
              onChange={(e) =>
                update({ persona: e.target.value as DesktopPreferences["persona"] })
              }
              className="pref-select"
            >
              {PERSONA_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.blurb}
                </option>
              ))}
            </select>
          </PrefSection>

          <PrefSection
            label="Auto-speak replies"
            help="Read every assistant reply aloud, not just voice-driven turns."
          >
            <Toggle
              value={prefs.auto_speak_replies}
              onChange={(v) => update({ auto_speak_replies: v })}
            />
          </PrefSection>

          <PrefSection
            label="Conversational mode"
            help="When you finish a voice turn, the mic restarts automatically once sansxel-1 stops talking. Hands-free back-and-forth."
          >
            <Toggle
              value={prefs.conversational}
              onChange={(v) => update({ conversational: v })}
            />
          </PrefSection>

          <PrefSection
            label="Voice"
            help="Which TTS voice sansxel-1 speaks with. Audio-only — only matters when replies are read aloud."
          >
            <select
              value={prefs.voice}
              onChange={(e) =>
                update({ voice: e.target.value as DesktopPreferences["voice"] })
              }
              className="pref-select"
            >
              {TTS_VOICES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label} — {v.vibe}
                </option>
              ))}
            </select>
          </PrefSection>
        </PrefSectionGroup>

        <PrefSectionGroup title="Chat">
          <PrefSection
            label="Send on Enter"
            help="On = Enter sends, Shift+Enter is a newline. Off = the other way around (Ctrl/Cmd+Enter sends)."
          >
            <Toggle
              value={prefs.send_on_enter}
              onChange={(v) => update({ send_on_enter: v })}
            />
          </PrefSection>
        </PrefSectionGroup>

        <PrefSectionGroup title="Window">
          <PrefSection
            label="Window mode"
            help="Pin sansxel to a screen edge for interviews, recordings, study sessions. Toolbar modes float above other apps."
          >
            <SegmentedControl<DesktopPreferences["window_mode"]>
              value={prefs.window_mode}
              onChange={(v) => void applyWindowMode(v)}
              options={[
                { value: "normal", label: "Window" },
                { value: "toolbar-top", label: "Top" },
                { value: "toolbar-left", label: "Left" },
                { value: "toolbar-right", label: "Right" },
              ]}
            />
          </PrefSection>
        </PrefSectionGroup>

        <PrefSectionGroup title="Appearance">
          <PrefSection
            label="Density"
            help="How much breathing room around messages and panels."
          >
            <SegmentedControl<DesktopPreferences["density"]>
              value={prefs.density}
              onChange={(v) => update({ density: v })}
              options={[
                { value: "compact", label: "Compact" },
                { value: "comfortable", label: "Comfortable" },
                { value: "spacious", label: "Spacious" },
              ]}
            />
          </PrefSection>

          <PrefSection
            label="Accent color"
            help="Highlight color across buttons, glows, and active states."
          >
            <div className="accent-row">
              {(["purple", "blue", "green", "amber", "rose"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update({ accent: a })}
                  className={`accent-swatch accent-swatch--${a}${prefs.accent === a ? " active" : ""}`}
                  title={a}
                  aria-label={`Accent ${a}`}
                />
              ))}
            </div>
          </PrefSection>

          <PrefSection
            label="Background pattern"
            help="Subtle texture behind everything. Off by default."
          >
            <SegmentedControl<DesktopPreferences["bg_pattern"]>
              value={prefs.bg_pattern}
              onChange={(v) => update({ bg_pattern: v })}
              options={[
                { value: "none",     label: "None"     },
                { value: "dots",     label: "Dots"     },
                { value: "grid",     label: "Grid"     },
                { value: "gradient", label: "Gradient" },
              ]}
            />
          </PrefSection>

          <PrefSection
            label="Bubble shape"
            help="Corner style for chat bubbles."
          >
            <SegmentedControl<DesktopPreferences["bubble_shape"]>
              value={prefs.bubble_shape}
              onChange={(v) => update({ bubble_shape: v })}
              options={[
                { value: "rounded", label: "Rounded" },
                { value: "square",  label: "Square"  },
                { value: "pill",    label: "Pill"    },
              ]}
            />
          </PrefSection>
        </PrefSectionGroup>

        <PrefSectionGroup title="Language">
          <PrefSection
            label="System language"
            help="Manual UI language. Replies still match whatever language you write in (auto-detected per message). Only English is fully translated for v0.1.4 — other choices fall back to English."
          >
            <select
              value={prefs.system_language}
              onChange={(e) => update({ system_language: e.target.value })}
              className="pref-select"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} — {l.native}
                </option>
              ))}
            </select>
          </PrefSection>
        </PrefSectionGroup>

        <PrefSectionGroup title="Shortcuts">
          <div className="kbd-list">
            <KbdRow combo={["Enter"]}      label="Send message (when send-on-Enter is on)" />
            <KbdRow combo={["Shift", "Enter"]} label="Newline in message" />
            <KbdRow combo={["Ctrl", "Enter"]}  label="Send message (when send-on-Enter is off)" />
            <KbdRow combo={["Esc"]}        label="Exit voice mode / close overlays" />
          </div>
        </PrefSectionGroup>

        <PrefSectionGroup title="About">
          <div className="about-card">
            <div className="about-row">
              <span className="about-label">Brand</span>
              <span className="about-value">sansxel · pronounced “sans-zul”</span>
            </div>
            <div className="about-row">
              <span className="about-label">Engine</span>
              <span className="about-value">sansxel-1 (3 tiers)</span>
            </div>
            <div className="about-row">
              <span className="about-label">Voice</span>
              <span className="about-value">11 voices, default Fable (British)</span>
            </div>
            <div className="about-row">
              <span className="about-label">Surface</span>
              <span className="about-value">Desktop · Tauri · Windows</span>
            </div>
          </div>
        </PrefSectionGroup>
      </div>
    </div>
  );
}

function KbdRow({ combo, label }: { combo: string[]; label: string }) {
  return (
    <div className="kbd-row">
      <span className="kbd-keys">
        {combo.map((k, i) => (
          <span key={i} className="kbd-chip">{k}</span>
        ))}
      </span>
      <span className="kbd-label">{label}</span>
    </div>
  );
}

function PrefSectionGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pref-group">
      <div className="pref-group-title">{title}</div>
      <div className="pref-group-body">{children}</div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`toggle${value ? " on" : ""}`}
      role="switch"
      aria-checked={value}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

function PrefSection({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pref-section">
      <div className="pref-section-head">
        <div className="pref-section-label">{label}</div>
        <div className="pref-section-help">{help}</div>
      </div>
      <div className="pref-section-control">{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="seg-ctrl">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`seg-ctrl-btn${opt.value === value ? " active" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  );
}

// ── Inline icons ─────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6l9 14 9-14-3-4z" />
      <path d="M3 6h18" />
      <path d="m9 6 3 14 3-14" />
    </svg>
  );
}

function UsageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}

function KeysIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function PrefsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function MemoryIcon() {
  // Bookmark + dot — "saved facts"
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="10" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IntegrationsIcon() {
  // Plug
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v5" />
    </svg>
  );
}

function SourcesIcon() {
  // Stack of documents — uploaded reference materials
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function UpdatesIcon() {
  // Sparkle / star
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 4.6L18.5 9l-3.6 3.1L16 17l-4-2.4L8 17l1.1-4.9L5.5 9l4.6-1.4z" />
    </svg>
  );
}

function SettingsIcon() {
  // Sliders (distinct from PrefsIcon's gear)
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="#0a0a0a" />
      <circle cx="15" cy="12" r="2" fill="#0a0a0a" />
      <circle cx="7" cy="18" r="2" fill="#0a0a0a" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

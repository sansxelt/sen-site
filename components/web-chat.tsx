"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ModelTier = "fast" | "balanced" | "smart";

type Tier = { tier: ModelTier; display_name: string; blurb: string };

const ALL_TIERS: ReadonlyArray<{
  tier: ModelTier;
  display_name: string;
  blurb: string;
}> = [
  {
    tier: "fast",
    display_name: "sansxel-1 fast",
    blurb: "Quick replies. Free.",
  },
  {
    tier: "balanced",
    display_name: "sansxel-1",
    blurb: "Default. Apprentice and up.",
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
}: {
  email: string;
  plan: string;
  tiers: Tier[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
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
  // True when this turn was started by voice — used to auto-speak the response
  const lastTurnWasVoice = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});

  const isFreePlan = plan === "free";

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
      setAudioLevel(Math.min(1, (sum / data.length) / 110));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async (overrideText?: string, fromVoice = false) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    lastTurnWasVoice.current = fromVoice;

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setChatError(null);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, tier }),
        signal: ac.signal,
      });

      // Surface plan downgrade if the server picked a lower tier
      const requested = res.headers.get("x-sansxel-tier-requested");
      const resolved = res.headers.get("x-sansxel-tier");
      if (requested && resolved && requested !== resolved) {
        setPlanNotice(
          `Your plan doesn't include ${requested} — replied with ${resolved} instead.`,
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          assistant += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: assistant };
            return copy;
          });
        }
      }
      const tail = decoder.decode();
      if (tail) {
        assistant += tail;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }

      // If this turn started with the mic, speak the response back
      // automatically. Inline so we don't depend on the speak()
      // useCallback being declared above this function.
      if (lastTurnWasVoice.current && assistant.trim()) {
        lastTurnWasVoice.current = false;
        try {
          setVoiceState("speaking");
          const tts = await fetch("/api/ai/voice/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: assistant }),
          });
          if (tts.ok) {
            const blob = await tts.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.crossOrigin = "anonymous";
            audioElRef.current = audio;

            // Hook the AI's voice into the orb visualization
            stopAnalyser();
            try {
              const ctx = new AudioContext();
              const source = ctx.createMediaElementSource(audio);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              source.connect(analyser);
              analyser.connect(ctx.destination);
              audioCtxRef.current = ctx;
              analyserRef.current = analyser;
              beginVolumeLoop();
            } catch {
              // playback still works; just no orb pulse
            }

            const cleanup = () => {
              URL.revokeObjectURL(url);
              stopAnalyser();
              if (audioElRef.current === audio) {
                audioElRef.current = null;
                setVoiceState("idle");
                if (voiceMode) {
                  void startRecordingRef.current();
                }
              }
            };
            audio.onended = cleanup;
            audio.onerror = cleanup;
            await audio.play();
          } else {
            setVoiceState("idle");
            stopAnalyser();
          }
        } catch {
          setVoiceState("idle");
          stopAnalyser();
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setChatError(err instanceof Error ? err.message : "Chat failed.");
      setMessages((prev) => {
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
  }, [input, messages, tier, voiceMode, stopAnalyser, beginVolumeLoop]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  // Voice flow — single button cycle:
  //   idle → click → ask mic perm → record (button = Stop)
  //   stop → transcribe → auto-send → AI replies → TTS plays back
  //   playback ends → idle
  const startRecording = useCallback(async () => {
    if (isFreePlan) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Hook the mic into an analyser so the orb pulses with volume
      stopAnalyser();
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      beginVolumeLoop();

      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        stopAnalyser();
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
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
          if (transcribed) {
            setVoiceState("idle");
            await send(transcribed, true);
          } else {
            setVoiceState("idle");
          }
        } catch (err) {
          setChatError(err instanceof Error ? err.message : "Transcribe failed.");
          setVoiceState("idle");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setVoiceState("recording");
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
    setVoiceMode(true);
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
    // Three cases — all routed through the same button:
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

  return (
    <section className="webchat">
      {voiceMode && (
        <WebVoiceOverlay
          state={voiceState}
          level={audioLevel}
          onMicTap={() => {
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
          <span className="webchat-plan">Plan: {plan}</span>
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

      {/* Subtle reminder that the desktop is the bigger surface */}
      <div className="webchat-desktop-cta">
        The desktop unlocks MCP tools, file edits, toolbar modes, the full voice loop, and more.
        <a href="/download" className="webchat-desktop-cta-link">
          Get sansxel desktop →
        </a>
      </div>

      <div className="webchat-scroll" ref={scrollRef}>
        {showEmpty ? (
          <div className="webchat-empty">
            <div className="webchat-empty-mark">sansxel-1</div>
            <h2>Ask anything.</h2>
            <p>
              Same brain as the desktop, in your browser. Voice and image input
              roll in next.
            </p>
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
                    <WebBounceDots />
                  ) : m.role === "assistant" ? (
                    <>
                      <div className="md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                      {isStillStreaming && <span className="webchat-cursor" />}
                    </>
                  ) : (
                    m.content
                  )}
                </div>
              );
            })}
            {chatError && <div className="webchat-error">{chatError}</div>}
          </div>
        )}
      </div>

      <form
        className="webchat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {voiceState === "recording" && <WebVoiceWave mode="listening" />}
        {voiceState === "speaking" && <WebVoiceWave mode="speaking" />}

        <textarea
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
              ? "Listening…"
              : voiceState === "transcribing"
                ? "Transcribing…"
                : voiceState === "speaking"
                  ? "Speaking…"
                  : "Message sansxel-1…"
          }
          rows={1}
          disabled={voiceState === "recording" || voiceState === "transcribing"}
        />
        <div className="webchat-input-actions">
          <VoiceButton
            voiceState={voiceState}
            isFreePlan={isFreePlan}
            onStart={() => void enterVoiceMode()}
            onStop={stopVoice}
          />

          {streaming ? (
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
              disabled={!input.trim()}
              className="webchat-send"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </section>
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
        title="Voice is on paid plans — try the desktop app"
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
          : "Tap to talk";

  const scale = 1 + Math.min(level * 0.55, 0.55);

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
          Press the orb to switch turns. Esc to leave.
        </div>
      </div>
    </div>
  );
}

function WebBounceDots() {
  return (
    <span className="webchat-dots">
      <span className="webchat-dot" />
      <span className="webchat-dot" />
      <span className="webchat-dot" />
    </span>
  );
}

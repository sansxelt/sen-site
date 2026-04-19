"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

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
  }, [input, messages, tier]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setStreaming(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
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
          if (data.text.trim()) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
          }
        } catch (err) {
          setChatError(err instanceof Error ? err.message : "Transcribe failed.");
        } finally {
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
  }, []);

  const stopRecording = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      setVoiceState("speaking");
      const res = await fetch("/api/ai/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`speak ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioElRef.current === audio) {
          audioElRef.current = null;
          setVoiceState("idle");
        }
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setVoiceState("idle");
      };
      await audio.play();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "TTS failed.");
      setVoiceState("idle");
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    setVoiceState("idle");
  }, []);

  const showEmpty = messages.length === 0;
  const allowedTiers = new Set(tiers.map((t) => t.tier));

  return (
    <section className="webchat">
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
              return (
                <div
                  key={i}
                  className={`webchat-msg webchat-msg--${m.role}`}
                >
                  {isInflight ? <WebBounceDots /> : m.content}
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
          {(() => {
            const last = messages[messages.length - 1];
            const canSpeak =
              !!last && last.role === "assistant" && !!last.content && !streaming;
            if (voiceState === "speaking") {
              return (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="webchat-icon-btn webchat-icon-btn--active"
                  title="Stop"
                >
                  Stop voice
                </button>
              );
            }
            return (
              <button
                type="button"
                onClick={() => canSpeak && speak(last.content)}
                disabled={!canSpeak}
                className="webchat-icon-btn"
                title="Read aloud"
              >
                Speak
              </button>
            );
          })()}

          {voiceState === "recording" ? (
            <button
              type="button"
              onClick={stopRecording}
              className="webchat-icon-btn webchat-icon-btn--recording"
              title="Stop recording"
            >
              Stop mic
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={voiceState !== "idle"}
              className="webchat-icon-btn"
              title="Record voice message"
            >
              Mic
            </button>
          )}

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

function WebBounceDots() {
  return (
    <span className="webchat-dots">
      <span className="webchat-dot" />
      <span className="webchat-dot" />
      <span className="webchat-dot" />
    </span>
  );
}

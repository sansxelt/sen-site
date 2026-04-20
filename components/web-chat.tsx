"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // Refs so the rAF loop reads the latest values without re-binding
  const voiceStateRef = useRef(voiceState);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  const voiceModeRef = useRef(voiceMode);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const interruptHandlerRef = useRef<(() => void) | null>(null);
  // Adaptive noise floor + "did the user actually speak" flag —
  // see workspace.tsx for the full rationale. Fixed thresholds
  // miss talking in noisy rooms / on quiet mics.
  const noiseFloorRef = useRef(0.04);
  const heardSpeechRef = useRef(false);

  const VAD_MIN_RECORD_MS = 400;
  const VAD_SILENCE_HOLD_MS = 800;
  const SPEECH_DELTA = 0.06;
  const SILENCE_DELTA = 0.025;
  const INTERRUPT_DELTA = 0.09;
  const INTERRUPT_HOLD_MS = 140;

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

      // Auto-stop on sustained silence — only after we've heard speech
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
          messages: next,
          tier,
          input_mode: fromVoice ? "voice" : "text",
          client_time_iso: new Date().toISOString(),
          client_timezone: clientTimezone,
          client_time_label: clientTimeLabel,
        }),
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

      // ── Smooth render: decouple visual reveal from network jitter
      // by walking a rendered-length cursor toward the assistant
      // buffer at ~300 chars/sec via requestAnimationFrame.
      let renderedLen = 0;
      let smoothRaf: number | null = null;
      let smoothActive = true;
      const CHARS_PER_FRAME = 5;
      const tickRender = () => {
        if (renderedLen < assistant.length) {
          renderedLen = Math.min(assistant.length, renderedLen + CHARS_PER_FRAME);
          const visible = assistant.slice(0, renderedLen);
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: visible };
            }
            return copy;
          });
        }
        if (smoothActive || renderedLen < assistant.length) {
          smoothRaf = requestAnimationFrame(tickRender);
        } else {
          smoothRaf = null;
        }
      };
      smoothRaf = requestAnimationFrame(tickRender);

      // Sentence-streaming TTS: as text streams in, slice off
      // complete sentences and fire TTS for each one in parallel.
      // Audio plays back in order so the voice reply starts well
      // before the full response has finished generating. Off when
      // the turn isn't voice-driven (no point synthesizing audio
      // nobody asked for).
      const willSpeak = lastTurnWasVoice.current;
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
            // Empty queue — wait for more chunks unless streaming is done
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          assistant += chunk;
          if (willSpeak) ttsBuf.text += chunk;
          // Note: NOT calling setMessages here — the rAF tick handles
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
      // Stream is done — let the smooth render drain the rest.
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

  // One-shot image generation. Reads the input as the prompt, appends
  // a user turn + an assistant turn with the image embedded as
  // markdown (`![](url)`), and clears the input. Streaming is for
  // text — image gen is one POST + one render.
  const generateImageFromInput = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || generatingImage) return;

    const userMsg: ChatMessage = { role: "user", content: prompt };
    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "assistant", content: "Generating image…" },
    ]);
    setInput("");
    setGeneratingImage(true);
    setChatError(null);

    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
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
      const data = (await res.json()) as { url: string; revised_prompt?: string };
      const caption = data.revised_prompt
        ? `*${data.revised_prompt}*\n\n![generated image](${data.url})`
        : `![generated image](${data.url})`;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: caption };
        }
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Image generation failed.";
      setChatError(message);
      // Drop the placeholder so the chat doesn't show "Generating…" forever.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          last.role === "assistant" &&
          last.content === "Generating image…"
        ) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setGeneratingImage(false);
    }
  }, [generatingImage, input]);

  // Voice flow — single button cycle:
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
      recordingStartedAtRef.current = Date.now();
      silenceStartRef.current = null;
      heardSpeechRef.current = false;
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
        <div className="webchat-desktop-cta-copy">
          <span className="webchat-desktop-cta-kicker">
            Desktop feels more like your assistant
          </span>
          <p>
            Better memory, a custom UI around how you work, MCP tools, file
            edits, toolbar modes, and the full voice loop.
          </p>
        </div>
        <div className="webchat-desktop-cta-actions">
          <div className="webchat-desktop-cta-badges" aria-hidden="true">
            <span className="webchat-desktop-chip">Better memory</span>
            <span className="webchat-desktop-chip">Custom UI/UX</span>
            <span className="webchat-desktop-chip">MCP + file edits</span>
          </div>
          <a href="/download" className="webchat-desktop-cta-link">
            Get sansxel desktop →
          </a>
        </div>
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
                    <WebAssistantBubble
                      content={m.content}
                      streaming={isStillStreaming}
                    />
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
          <button
            type="button"
            onClick={() => void generateImageFromInput()}
            disabled={generatingImage || !input.trim() || streaming}
            className="webchat-voice-btn"
            title="Generate image from prompt"
          >
            {generatingImage ? "Drawing…" : "🖼 Image"}
          </button>

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
          : "Listening";

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
          Hands-free — just talk. Esc to leave.
        </div>
      </div>
    </div>
  );
}

type Section =
  | { type: "thinking"; text: string }
  | { type: "answer"; text: string };

function parseSections(content: string): Section[] {
  const out: Section[] = [];
  const OPEN = "<think>";
  const CLOSE = "</think>";
  let cursor = 0;
  while (cursor < content.length) {
    const openIdx = content.indexOf(OPEN, cursor);
    if (openIdx === -1) {
      const tail = content.slice(cursor);
      if (tail) out.push({ type: "answer", text: tail });
      break;
    }
    if (openIdx > cursor) {
      out.push({ type: "answer", text: content.slice(cursor, openIdx) });
    }
    const innerStart = openIdx + OPEN.length;
    const closeIdx = content.indexOf(CLOSE, innerStart);
    if (closeIdx === -1) {
      out.push({ type: "thinking", text: content.slice(innerStart) });
      break;
    }
    out.push({ type: "thinking", text: content.slice(innerStart, closeIdx) });
    cursor = closeIdx + CLOSE.length;
  }
  return out;
}

function WebAssistantBubble({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  // Strip thinking blocks — internal reasoning isn't shown to the user.
  const sections = parseSections(content).filter((s) => s.type !== "thinking");
  return (
    <>
      {sections.map((s, i) => {
        const isLast = i === sections.length - 1;
        if (streaming && isLast) {
          return (
            <span key={i}>
              <WebStreamingFadeText text={s.text} />
              <span className="webchat-cursor" />
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

function WebBounceDots() {
  return (
    <span className="webchat-dots">
      <span className="webchat-dot" />
      <span className="webchat-dot" />
      <span className="webchat-dot" />
    </span>
  );
}

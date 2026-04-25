"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLei } from "./lei-shell";
import { previewCreditCost } from "@/lib/lei";

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
  // v0.1.16 — Live preview transcript via the browser's Web Speech
  // API (Chrome/Edge: window.webkitSpeechRecognition). Runs alongside
  // MediaRecorder so the user sees their words appearing in real time
  // while they speak. Whisper still produces the canonical transcript
  // that actually gets sent — Web Speech is display-only because its
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
  // Adaptive noise floor + "did the user actually speak" flag —
  // see workspace.tsx for the full rationale. Fixed thresholds
  // miss talking in noisy rooms / on quiet mics.
  const noiseFloorRef = useRef(0.04);
  const heardSpeechRef = useRef(false);

  const VAD_MIN_RECORD_MS = 400;
  // v0.1.16 — faster turn-taking + easier interruption. The old
  // 800ms hold + 0.09 interrupt delta felt sluggish; user couldn't
  // talk over the AI without yelling. Pulled both numbers down.
  const VAD_SILENCE_HOLD_MS = 500;
  const SPEECH_DELTA = 0.06;
  const SILENCE_DELTA = 0.025;
  const INTERRUPT_DELTA = 0.045;
  const INTERRUPT_HOLD_MS = 90;

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
    const baseText = (overrideText ?? input).trim();

    // File / code attachments inline into the prompt (text). Image
    // attachments are converted to base64 + sent via the chat API's
    // `images` field on the user message — the route already supports
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
            const safe = (accepted as readonly string[]).includes(mt) ? mt : "image/png";
            imageBlocks.push({
              media_type: safe as (typeof accepted)[number],
              data: m[2],
            });
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
    // separate button. "gen an image of X", "draw me a Y", "make a
    // picture of Z" → route to /api/ai/image instead of a chat turn.
    // Skipped when there's an attached image (probably means
    // "analyze this", not "make a new one").
    const IMAGE_GEN_INTENT = /^\s*(?:gen(?:erate)?|make|create|draw|paint|imagine|illustrate|render|design|sketch)\s+(?:me\s+)?(?:an?\s+|the\s+|some\s+)?(?:image|picture|pic|photo|illustration|art|drawing|painting|sketch|portrait|logo|graphic|render)\b/i;
    if (IMAGE_GEN_INTENT.test(baseText) && imageBlocks.length === 0) {
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

    const userMsg: ChatMessage = { role: "user", content: text };
    // Build the network payload separately so the in-UI message stays
    // text-only (we already render the image previews via the LEI
    // attachment chips above the input).
    const payloadMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      imageBlocks.length > 0
        ? { role: "user" as const, content: text || "Here's an image — what do you see?", images: imageBlocks }
        : { role: "user" as const, content: text },
    ];
    const next = [...messages, userMsg];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setChatError(null);
    // Clear attachments NOW (not in the finally) — they're already
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

      // Sentence-streaming TTS — only in V→V mode. V→T is dictation:
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
      } else if (lastTurnWasVoice.current) {
        // V→T turn ended — don't TTS, don't auto-restart mic.
        // Drop voice mode so the user gets back to a normal text view.
        lastTurnWasVoice.current = false;
        setVoiceState("idle");
        // Fully exit voice mode (closes overlay) — V→T is one-shot.
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
      // Refresh balance so the chip reflects the credit burn.
      // (Attachments were already cleared up-top, before the await.)
      void lei.refreshBalance();
    }
  }, [input, messages, tier, lei]);

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
  const generateImageFromInput = useCallback(async (overridePrompt?: string) => {
    const prompt = (overridePrompt ?? input).trim();
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
            // appended — that's the source of the duplication bug.
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
            // Permission denied / network — leave preview empty,
            // Whisper takes over on stop.
          };
          rec.start();
          speechRecognitionRef.current = rec;
          finalTranscriptRef.current = "";
          setLiveTranscript("");
        }
      } catch {
        // ignore — preview is best-effort
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
    // V→T style: one-shot dictation — no overlay, no TTS, no auto-loop.
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
          <VoiceStyleToggle
            value={lei.voiceStyle}
            onChange={lei.setVoiceStyle}
          />
          <CreditChip balance={lei.creditBalance} plan={plan} />
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
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length) void lei.addFiles(files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        <textarea
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
                  ? `Included in your ${plan} plan — no credits used unless you exceed your weekly cap`
                  : `This action costs ${costPreview.credits} credits (${costPreview.usd})`
              }
            >
              {costPreview.planCovers ? `✓ ${plan}` : `≈ ${costPreview.credits} cr`}
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
                    <span className="webchat-plus-item-sub">Image · video · file · code — or just drag onto the page</span>
                  </span>
                </button>
                <div className="webchat-plus-hint">
                  <strong>Tip: </strong> Just type what you want — &ldquo;gen an image of a cat&rdquo;,
                  &ldquo;draw me a logo&rdquo;, etc. — and Send. sansxel-1 routes it automatically.
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
      title={canceling ? "Subscription is set to cancel — click to reactivate" : "Next renewal date"}
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
  // v0.1.16 — Differentiate "mic open, waiting for you" from "you're
  // actively talking". Same overlay used to say "Listening" for both,
  // which made the post-reply transition feel weird (same word appears
  // twice with no signal that the AI had handed the turn back).
  // SPEAKING_THRESHOLD picked to match the SPEECH_DELTA used by VAD;
  // when level is above it, we're actually capturing speech, so the
  // word matches the state.
  const SPEAKING_THRESHOLD = 0.10;
  let status: string;
  if (state === "transcribing") status = "Thinking";
  else if (state === "speaking") status = "Speaking";
  else if (state === "recording") {
    status = level > SPEAKING_THRESHOLD ? "Listening" : "Your turn";
  } else {
    status = "Tap to talk";
  }

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
        // v0.1.16 — Always render markdown, even during streaming.
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

function CreditChip({ balance, plan }: { balance: number | null; plan: string }) {
  const planCovers = ["pro", "teams", "enterprise"].includes(plan.toLowerCase());
  if (balance === null) {
    return <span className="webchat-credit-chip webchat-credit-chip--idle" title="Credit balance">— cr</span>;
  }
  // For unlimited plans, low balance isn't urgent — they only burn
  // credits if they blow past the weekly cap, which most users won't.
  const low = balance < 20 && !planCovers;
  return (
    <a
      href="/account/billing"
      className={`webchat-credit-chip${low ? " webchat-credit-chip--low" : ""}`}
      title={
        planCovers
          ? `Your ${plan} plan covers normal use. Credits only burn if you exceed weekly caps.`
          : low
            ? "Low balance — top up to keep going past your plan cap"
            : "Credit balance"
      }
    >
      {balance.toLocaleString()} cr
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
  return (
    <div className="webchat-vstyle" role="group" aria-label="Voice mode style">
      <button
        type="button"
        onClick={() => onChange("v2t")}
        className={value === "v2t" ? "is-active" : ""}
        title="Voice in, text shown"
      >V→T</button>
      <button
        type="button"
        onClick={() => onChange("v2v")}
        className={value === "v2v" ? "is-active" : ""}
        title="Hands-free voice — transcript hidden"
      >V→V</button>
    </div>
  );
}

function prettyAttSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

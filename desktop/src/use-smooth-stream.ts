import { useCallback, useEffect, useRef } from "react";

// Decouples render pace from network jitter.
//
// Streamed chunks arrive in bursts (Claude can spit 200 chars in
// one event then nothing for 400ms). Rendering each chunk as it
// arrives produces uneven, jittery text. This hook keeps a
// "target" buffer the network fills, and a "rendered" length the
// rAF loop walks toward at a steady CHARS_PER_FRAME pace.
//
// The result: text appears at a near-constant rate (e.g. ~300
// chars/sec), regardless of how the network actually delivers it.
// ChatGPT/Claude both do this; it's the single biggest reason
// their streaming "feels" smoother than naive implementations.

export type SmoothStream = {
  // Append new text to the target buffer. Starts the rAF loop if
  // it isn't already running.
  push: (chunk: string) => void;
  // Hard reset both buffers + cancel rAF. Call when starting a
  // brand-new turn.
  reset: () => void;
  // Tell the renderer the network stream has ended. The rAF loop
  // keeps draining the buffer until rendered catches up, then stops.
  end: () => void;
  // Resolves once rendered === target. Useful for kicking off
  // post-streaming work (TTS, scroll-to-bottom, etc.) only AFTER
  // the visual reveal has caught up.
  drained: () => Promise<string>;
};

export function useSmoothStream(opts: {
  // ~300 chars/sec at 60fps. Set higher for snappier reveal,
  // lower for more deliberate pacing.
  charsPerFrame?: number;
  // Called every animation frame the rendered buffer changes.
  // Use this to update React state with the visible substring.
  onTick: (visible: string) => void;
}): SmoothStream {
  const charsPerFrame = opts.charsPerFrame ?? 5;
  const onTickRef = useRef(opts.onTick);
  useEffect(() => {
    onTickRef.current = opts.onTick;
  }, [opts.onTick]);

  const targetRef = useRef("");
  const renderedLenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const streamingRef = useRef(false);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startRaf = useCallback(() => {
    if (rafRef.current !== null) return;
    const tick = () => {
      const targetLen = targetRef.current.length;
      const renderedLen = renderedLenRef.current;
      if (renderedLen < targetLen) {
        const nextLen = Math.min(targetLen, renderedLen + charsPerFrame);
        renderedLenRef.current = nextLen;
        const visible = targetRef.current.slice(0, nextLen);
        onTickRef.current(visible);
      }
      const stillBehind = renderedLenRef.current < targetRef.current.length;
      if (streamingRef.current || stillBehind) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [charsPerFrame]);

  const push = useCallback(
    (chunk: string) => {
      if (!chunk) return;
      streamingRef.current = true;
      targetRef.current += chunk;
      startRaf();
    },
    [startRaf],
  );

  const reset = useCallback(() => {
    stopRaf();
    streamingRef.current = false;
    targetRef.current = "";
    renderedLenRef.current = 0;
  }, [stopRaf]);

  const end = useCallback(() => {
    streamingRef.current = false;
    // rAF keeps going until it drains; do not stop it here.
  }, []);

  const drained = useCallback(() => {
    return new Promise<string>((resolve) => {
      const check = () => {
        if (renderedLenRef.current >= targetRef.current.length) {
          resolve(targetRef.current);
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRaf();
    };
  }, [stopRaf]);

  return { push, reset, end, drained };
}

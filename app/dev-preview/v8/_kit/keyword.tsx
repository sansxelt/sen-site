"use client";

import { useEffect, useRef, useState } from "react";

// THE HERO KEYWORD (founder, 2026-10-10: "do like the logo animation thing with the homepage, one keyword at a time").
//
// x.ai's hero swaps its last word ("for everything you imagine."). Ours swaps the area with the logo intro's effect:
// the current keyword breaks into short fragments right to left through the spectral light, and the next one
// assembles from fragments left to right, cooling to white, before the crisp text takes over again. The heading
// itself carries the whole tagline for screen readers and search; this line is decoration and aria-hidden.
// Under reduced motion the first keyword simply stays.

// Ember (founder 2026-10-10: colour, but not the vibe-coded green/purple/pink): amber, orange, ember red.
const SPEC: [number, number, number][] = [[255, 176, 103], [255, 106, 43], [201, 56, 26]];
function spec(t: number) {
  const c = Math.max(0, Math.min(1, t)), s = c * 2, i = Math.min(1, Math.floor(s)), f = s - i, a = SPEC[i], b = SPEC[i + 1];
  return `rgb(${(a[0] + (b[0] - a[0]) * f) | 0},${(a[1] + (b[1] - a[1]) * f) | 0},${(a[2] + (b[2] - a[2]) * f) | 0})`;
}
const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
type P = { x: number; y: number; a: number; r: number; j: number };

// Fifteen phrases: a shorter hold keeps the list moving, long enough to read each one.
const HOLD = 1600, OUT = 820, IN = 900;

export function KeywordMorph({ words, delay = 1300 }: { words: string[]; delay?: number }) {
  const [i, setI] = useState(0);
  const line = useRef<HTMLSpanElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Every phrase must fit the line on any screen: size the keyword line so the longest phrase fits its width.
  useEffect(() => {
    const l = line.current, w = word.current; if (!l || !w) return;
    const fit = () => {
      l.style.fontSize = "";
      const cs = getComputedStyle(w), base = parseFloat(cs.fontSize);
      const c = document.createElement("canvas").getContext("2d"); if (!c) return;
      c.font = `${cs.fontWeight} ${base}px ${cs.fontFamily}`;
      const widest = Math.max(...words.map((t) => c.measureText(t).width)) * 1.02;
      const room = l.clientWidth;
      if (widest > room) l.style.fontSize = `${Math.floor(base * room / widest)}px`;
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    const ro = new ResizeObserver(fit); ro.observe(l);
    return () => ro.disconnect();
  }, [words]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, timer: ReturnType<typeof setTimeout>, stopped = false, idx = 0;
    const dpr = Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)));
    const STEP = 2; // sample every 2 CSS px: enough fragments, light enough to draw at 60 fps

    const sample = (text: string) => {
      const l = line.current!, w = word.current!;
      const lr = l.getBoundingClientRect(), wr = w.getBoundingClientRect(), cs = getComputedStyle(w);
      const W = Math.ceil(wr.width) + 4, H = Math.ceil(wr.height) + 8;
      const off = document.createElement("canvas"); off.width = W * dpr; off.height = H * dpr;
      const o = off.getContext("2d")!;
      o.scale(dpr, dpr); o.fillStyle = "#fff"; o.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      o.textBaseline = "middle"; (o as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = cs.letterSpacing;
      o.fillText(text, 0, H / 2);
      const px = o.getImageData(0, 0, off.width, off.height).data, parts: P[] = [];
      for (let y = 0; y < off.height; y += STEP * dpr) for (let x = 0; x < off.width; x += STEP * dpr) {
        const a = px[(y * off.width + x) * 4 + 3];
        if (a > 70) parts.push({ x: x / dpr, y: y / dpr, a: a / 255, r: Math.random(), j: Math.random() - .5 });
      }
      return { parts, ox: wr.left - lr.left, oy: wr.top - lr.top + (wr.height - H) / 2, W };
    };

    const sizeCanvas = () => {
      const c = canvas.current!, l = line.current!, r = l.getBoundingClientRect();
      c.width = Math.ceil(r.width + 160) * dpr; c.height = Math.ceil(r.height + 80) * dpr;
      c.style.width = `${r.width + 160}px`; c.style.height = `${r.height + 80}px`;
      const ctx = c.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };

    // The real text is wiped and revealed by a soft-edged mask that follows the fragment front, so there is never a
    // hard swap between crisp letters and canvas pixels.
    const mask = (from: "left" | "right", visible: number) => {
      const w = word.current; if (!w) return;
      const v = Math.max(-0.1, Math.min(1.1, visible)) * 100, soft = 9;
      const g = from === "left"
        ? `linear-gradient(90deg, #000 ${v - soft}%, transparent ${v + soft}%)`
        : `linear-gradient(270deg, #000 ${v - soft}%, transparent ${v + soft}%)`;
      w.style.maskImage = g; w.style.webkitMaskImage = g;
    };
    const clearMask = () => { const w = word.current; if (w) { w.style.maskImage = ""; w.style.webkitMaskImage = ""; } };

    const run = (dur: number, draw: (t: number) => void) => new Promise<void>((done) => {
      const t0 = performance.now();
      const frame = (now: number) => {
        if (stopped) return done();
        const t = Math.min(1, (now - t0) / dur); draw(t);
        if (t < 1) raf = requestAnimationFrame(frame); else done();
      };
      raf = requestAnimationFrame(frame);
    });

    const cycle = async () => {
      if (stopped || !line.current || !word.current || !canvas.current) return;
      const ctx = sizeCanvas(), pad = 80;
      // Out: the current keyword breaks up right to left.
      const a = sample(words[idx]);
      await run(OUT, (t) => {
        ctx.clearRect(0, 0, 1e5, 1e5);
        mask("left", 1 - (t * 1.6) / .6);
        for (const p of a.parts) {
          const rel = t * 1.6 - (1 - p.x / a.W) * .6 - p.r * .15;
          if (rel <= 0) continue;
          const k = Math.min(1, rel / .55), e = ease(k);
          ctx.globalAlpha = p.a * (1 - k);
          ctx.fillStyle = spec(1 - p.x / a.W + k * .25);
          ctx.fillRect(p.x + a.ox + pad - 60 * e + p.j * 18 * Math.sin(k * Math.PI), p.y + a.oy + 40 + p.j * 10 * k, STEP + 6 * k * (.4 + p.r), STEP * .7);
        }
        ctx.globalAlpha = 1;
      });
      if (stopped) return;
      mask("left", -0.2);
      // Swap the text while it is invisible, then measure where the new one sits.
      idx = (idx + 1) % words.length; setI(idx);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (stopped || !word.current) return;
      const b = sample(words[idx]);
      await run(IN, (t) => {
        ctx.clearRect(0, 0, 1e5, 1e5);
        mask("left", (t * 1.6 - .5) / .6);
        for (const p of b.parts) {
          const rel = t * 1.6 - (p.x / b.W) * .6 - p.r * .15;
          if (rel <= 0) continue;
          const k = Math.min(1, rel / .55), e = ease(k);
          if (k >= 1) continue;
          ctx.globalAlpha = p.a * Math.min(1, k * 2.2) * (1 - Math.pow(k, 3));
          ctx.fillStyle = k > .92 ? "#FAFAFA" : spec(.2 + (1 - k) * .8);
          ctx.fillRect(p.x + b.ox + pad + 60 * (1 - e) + p.j * 18 * Math.sin(k * Math.PI), p.y + b.oy + 40 + p.j * 10 * (1 - k), STEP + 6 * (1 - k) * (.4 + p.r), STEP);
        }
        ctx.globalAlpha = 1;
      });
      if (stopped || !word.current) return;
      clearMask();
      ctx.clearRect(0, 0, 1e5, 1e5);
      timer = setTimeout(cycle, HOLD);
    };

    timer = setTimeout(async () => { try { await document.fonts.ready; } catch { /* no fonts API */ } cycle(); }, delay);
    return () => { stopped = true; clearTimeout(timer); cancelAnimationFrame(raf); clearMask(); };
  }, [words, delay]);

  return (
    <span ref={line} className="v8-kw" aria-hidden="true">
      <span ref={word} className="v8-kw__word">{words[i]}</span>
      <canvas ref={canvas} className="v8-kw__canvas" />
    </span>
  );
}

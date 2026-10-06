"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./home-sequence.css";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function HomeSequence({ children }: { children: [ReactNode, ReactNode, ReactNode] }) {
  const root = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const gate = matchMedia('(min-width:901px) and (min-height:720px) and (prefers-reduced-motion:no-preference)');
    let raf = 0;
    const paint = () => {
      raf = 0;
      if (!gate.matches) return;
      const stage = el.querySelector<HTMLElement>('.home-sequence__stage')!;
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const rect = el.getBoundingClientRect();
      const p = clamp((top - rect.top) / Math.max(1, rect.height - stage.clientHeight));
      const first = clamp((p - .24) / .12), second = clamp((p - .64) / .12);
      const weights = [1 - first, first * (1 - second), second];
      el.querySelectorAll<HTMLElement>('.home-sequence__scene').forEach((scene, i) => {
        scene.style.opacity = String(weights[i]);
        scene.style.translate = `0 ${(1 - weights[i]) * 24}px`;
      });
      setActive(second >= .5 ? 2 : first >= .5 ? 1 : 0);
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const sync = () => {
      setEnabled(gate.matches);
      if (!gate.matches) el.querySelectorAll<HTMLElement>('.home-sequence__scene').forEach(scene => { scene.style.opacity = ''; scene.style.translate = ''; });
      request();
    };
    sync(); gate.addEventListener('change', sync);
    window.addEventListener('scroll', request, { passive:true }); window.addEventListener('resize', request);
    return () => { cancelAnimationFrame(raf); gate.removeEventListener('change', sync); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
  }, []);
  return <div ref={root} className="home-sequence" data-sequenced={enabled || undefined}>
    <div className="home-sequence__stage">
      {children.map((child, index) => <div key={index} className="home-sequence__scene" inert={enabled && active !== index} data-active={!enabled || active === index}>{child}</div>)}
    </div>
  </div>;
}

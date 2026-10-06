"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Opening } from "./opening";
import "./home-sequence.css";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const arrivals = [0, .76, 1.5];
const handoff = .24;

/** One viewport for the whole narrative. Incoming chapters are masked until their handoff. */
export function HomeSequence({ children }: { children: [ReactNode, ReactNode, ReactNode] }) {
  const root = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const gate = matchMedia('(min-width:901px) and (min-height:720px) and (prefers-reduced-motion:no-preference)');
    const stage = el.querySelector<HTMLElement>('.home-sequence__stage')!;
    const opening = el.querySelector<HTMLElement>('.home-sequence__opening')!;
    const scenes = Array.from(el.querySelectorAll<HTMLElement>('.home-sequence__scene'));
    let raf = 0;
    let current = -1;
    let initialHash = location.hash;
    const scrollToChapter = (hash: string) => {
      if (!gate.matches || !el.dataset.sequenced || !hash) return false;
      let target: HTMLElement | null;
      try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return false; }
      const index = scenes.findIndex(scene => target && scene.contains(target));
      if (index < 0) return false;
      const height = stage.clientHeight;
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const y = el.getBoundingClientRect().top + scrollY + window.innerHeight * 2.1 - height + (arrivals[index] + handoff + .05) * height - top;
      window.scrollTo({ top:y, behavior:'instant' });
      return true;
    };
    const activate = (index: number) => {
      // Update inert synchronously: a promoted fullscreen subtree must never retain an inert ancestor.
      opening.inert = index !== -1;
      scenes.forEach((scene, i) => { scene.inert = i !== index; });
      if (current !== index) { current = index; setActive(index); }
    };
    const paint = () => {
      raf = 0;
      if (!gate.matches || getComputedStyle(stage).position !== 'sticky') return;
      if (initialHash && el.dataset.sequenced) { scrollToChapter(initialHash); initialHash = ''; }
      const fullscreen = document.fullscreenElement;
      if (fullscreen && el.contains(fullscreen)) {
        const index = scenes.findIndex(scene => scene.contains(fullscreen));
        if (index >= 0) {
          scenes.forEach((scene, i) => {
            scene.style.visibility = i === index ? 'visible' : 'hidden';
            scene.style.clipPath = 'none';
            scene.style.setProperty('--scene-y', '0px');
          });
          activate(index);
          return;
        }
      }
      const height = stage.clientHeight;
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const distance = top - el.getBoundingClientRect().top;
      // The first two scenes retain their existing opening pace and word-by-word reveal.
      const openingTravel = window.innerHeight * 2.1 - height;
      const chapter = (distance - openingTravel) / height;
      let index = -1;
      scenes.forEach((scene, i) => {
        const age = chapter - arrivals[i];
        const entering = clamp(age / handoff);
        const next = arrivals[i + 1];
        const covered = next !== undefined && chapter >= next + handoff;
        scene.style.visibility = age > 0 && !covered ? 'visible' : 'hidden';
        // An opaque upward wipe replaces the finished chapter; no ghosted overlap or early heading.
        scene.style.clipPath = covered ? 'inset(100% 0 0 0)' : entering === 1 ? 'none' : `inset(${(1 - entering) * 100}% 0 0 0)`;
        scene.style.setProperty('--scene-y', `${(1 - entering) * 36 - clamp((age - handoff) / .52) * 12}px`);
        if (entering >= .5) index = i;
      });
      opening.style.visibility = chapter >= handoff ? 'hidden' : 'visible';
      opening.style.clipPath = chapter >= handoff ? 'inset(100% 0 0 0)' : 'none';
      activate(index);
    };
    const request = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const hashChanged = () => { scrollToChapter(location.hash); request(); };
    const follow = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (url.origin === location.origin && url.pathname === location.pathname && scrollToChapter(url.hash)) {
        // The shared smooth scroller otherwise follows the hidden element's viewport position.
        event.preventDefault(); event.stopPropagation(); history.pushState(null, '', url.hash); request();
      }
    };
    const sync = () => {
      setEnabled(gate.matches);
      if (!gate.matches) {
        opening.style.visibility = '';
        opening.style.clipPath = '';
        opening.inert = false;
        scenes.forEach(scene => { scene.removeAttribute('style'); scene.inert = false; });
      }
      request();
    };
    sync(); gate.addEventListener('change', sync);
    // The enhanced layout lands after mount. Re-measure it before painting a stale stacked geometry.
    const geometry = new ResizeObserver(request);
    geometry.observe(el); geometry.observe(stage);
    document.addEventListener('fullscreenchange', request);
    document.addEventListener('click', follow, true); window.addEventListener('hashchange', hashChanged);
    window.addEventListener('scroll', request, { passive:true }); window.addEventListener('resize', request);
    return () => { cancelAnimationFrame(raf); geometry.disconnect(); document.removeEventListener('fullscreenchange', request); document.removeEventListener('click', follow, true); window.removeEventListener('hashchange', hashChanged); gate.removeEventListener('change', sync); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
  }, []);
  return <div ref={root} className="home-sequence" data-sequenced={enabled || undefined}>
    <div className="home-sequence__stage">
      <div className="home-sequence__opening" inert={enabled && active !== -1}>
        <Opening sequenceRoot={enabled ? root : undefined} />
      </div>
      {children.map((child, index) => <div key={index} className="home-sequence__scene" inert={enabled && active !== index} data-active={!enabled || active === index}>{child}</div>)}
    </div>
  </div>;
}

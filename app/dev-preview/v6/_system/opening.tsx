"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Hero } from "./hero";
import { Statement } from "./home-bands";
import { useScrollProgress } from "./progress";
import { SHORT } from "./mobile-motion";
import { openingProgress, sequenceOpeningTrack } from "./opening-timing";
import "./opening.css";

/** One native-scroll opening, finishing on the company statement. */
export function Opening({ sequenceRoot }: { sequenceRoot?: RefObject<HTMLElement | null> }) {
  const root = useRef<HTMLElement>(null);
  const [motion, setMotion] = useState(false);
  const [statementVisible, setStatementVisible] = useState(false);
  useEffect(() => {
    const queries = [matchMedia("(prefers-reduced-motion: reduce)"), matchMedia(SHORT)];
    const sync = () => setMotion(!queries.some(query => query.matches));
    queries.forEach(query => query.addEventListener("change", sync));
    sync();
    return () => queries.forEach(query => query.removeEventListener("change", sync));
  }, []);
  useEffect(() => {
    const el = root.current;
    const viewport = window.visualViewport;
    if (!el || !viewport) return;
    // Keep the scroll track fixed; only the statement follows Safari's visible area.
    const sync = () => el.style.setProperty("--opening-visible-h", `${viewport.height}px`);
    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, []);
  useScrollProgress(sequenceRoot ?? root, {
    smooth: false,
    property: sequenceRoot ? '--opening-p' : '--p',
    measure: (rect, vh) => {
      if (sequenceRoot?.current?.dataset.sequenced) {
        const stage = sequenceRoot.current.querySelector<HTMLElement>('.home-sequence__stage')!;
        const top = parseFloat(getComputedStyle(stage).top) || 0;
        const track = sequenceOpeningTrack(rect.height, stage.clientHeight);
        return openingProgress(top - rect.top, track.travel, track.readingTravel);
      }
      const height = root.current?.querySelector<HTMLElement>('.v6-opening__pin')?.offsetHeight ?? vh;
      const viewports = Number(getComputedStyle(root.current!).getPropertyValue("--opening-viewports"));
      return openingProgress(-rect.top, Math.max(1, rect.height - height), rect.height / viewports);
    },
    onFrame: value => setStatementVisible(value >= .50),
  });
  return (
    <section ref={root} className="v6-opening" style={sequenceRoot ? { '--p': 'var(--opening-p,0)' } as React.CSSProperties : undefined} data-motion={motion || undefined} data-nav-theme="dark" aria-label="Introducing Vraelis">
      <div className="v6-opening__pin">
        <div className="v6-opening__film" inert={motion && statementVisible}>
          <Hero />
        </div>
        <div className="v6-opening__statement">
          <Statement scrollRoot={sequenceRoot ?? root} />
        </div>
      </div>
    </section>
  );
}

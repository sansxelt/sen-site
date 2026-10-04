"use client";

import { useEffect, useRef, useState } from "react";
import { Hero } from "./hero";
import { Statement } from "./home-bands";
import { useScrollProgress } from "./progress";
import { SHORT } from "./mobile-motion";
import "./opening.css";

/** One native-scroll opening, finishing on the company statement. */
export function Opening() {
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
  useScrollProgress(root, { onFrame: value => setStatementVisible(value >= .48) });
  return (
    <section ref={root} className="v6-opening" data-motion={motion || undefined} data-nav-theme="dark" aria-label="Introducing Vraelis">
      <div className="v6-opening__pin">
        <div className="v6-opening__film" inert={motion && statementVisible}>
          <Hero />
        </div>
        <div className="v6-opening__statement">
          <Statement scrollRoot={root} />
        </div>
      </div>
    </section>
  );
}

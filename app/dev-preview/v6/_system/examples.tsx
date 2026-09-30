"use client";

/* FOR EXAMPLE: the homepage gets specific as the reader scrolls.

   One pinned scene. The left column holds the idea in one line and an index of kinds of product; the right
   column shows ONE example at a time: the kind, the sentence someone would write, what Vraelis does in the
   browser, and the bug that sentence catches. Scrolling advances the example; nothing is captured or
   re-timed, and the index buttons jump the page to an example's slice of the scroll, so it is navigable
   without scrolling at all.

   The active example is derived from the shared scroll engine's rendered value (useScrollProgress onFrame),
   and React only re-renders when the index actually changes, not on every frame.

   Where the site unpins its chapters (reduced motion, and short screens: the SHORT gate in mobile-motion.ts,
   repeated in examples.css) the scene becomes a plain list with every example visible. That branch is CSS
   only, so there is no state in which an example is hidden with nothing able to show it.

   Deliberately NOT part of the chapters.css mobile-motion lists: those two lists are pinned to each other by
   scripts/mobile-motion-verify.ts, and this section hides nothing at opacity 0 outside its own pinned state. */
import { useCallback, useRef, useState } from "react";
import { useScrollProgress } from "./progress";
import { EXAMPLES, EXAMPLES_NOTE, EXAMPLES_LIMIT } from "../_content/examples";
import "./examples.css";

const N = EXAMPLES.length;

export function Examples() {
  const wrap = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const last = useRef(0);

  const onFrame = useCallback((p: number) => {
    const i = Math.min(N - 1, Math.max(0, Math.floor(p * N * 0.999)));
    if (i !== last.current) { last.current = i; setActive(i); }
  }, []);
  useScrollProgress(wrap, { onFrame });

  // Jump to an example's own slice of the scroll, so the index works as navigation too.
  const go = (i: number) => {
    const el = wrap.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    if (total <= 0) { document.getElementById(`v6-ex-${EXAMPLES[i].key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + total * ((i + 0.5) / N), behavior: "smooth" });
  };

  return (
    <section ref={wrap} className="v6-ex" data-nav-theme="light" aria-labelledby="v6-ex-h" style={{ ["--n" as string]: N }}>
      <div className="v6-ex__pin">
        <div className="v6-ex__in">
          <div className="v6-ex__side">
            <p className="v6-eyebrow">For example</p>
            <h2 id="v6-ex-h" className="v6-ex__h">One sentence. Any app, or the panel that runs a device.</h2>
            <ol className="v6-ex__index">
              {EXAMPLES.map((e, i) => (
                <li key={e.key}>
                  <button type="button" className="v6-ex__ix" aria-current={i === active ? "step" : undefined} onClick={() => go(i)}>
                    <span className="v6-mono">{String(i + 1).padStart(2, "0")}</span>{e.kind}
                  </button>
                </li>
              ))}
            </ol>
            <p className="v6-ex__note">{EXAMPLES_NOTE}</p>
          </div>

          <div className="v6-ex__stage">
            {EXAMPLES.map((e, i) => (
              <article key={e.key} id={`v6-ex-${e.key}`} className="v6-ex__card" data-on={i === active}>
                <p className="v6-ex__kind v6-mono"><span>{String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}</span>{e.kind}</p>
                <p className="v6-ex__say">&ldquo;{e.sentence}&rdquo;</p>
                <div className="v6-ex__cols">
                  <div>
                    <p className="v6-ex__lab">What Vraelis does, in a real browser</p>
                    <ol className="v6-ex__does">
                      {e.does.map((d) => <li key={d}>{d}</li>)}
                    </ol>
                  </div>
                  <div>
                    <p className="v6-ex__lab">What it catches</p>
                    <p className="v6-ex__catch">{e.catches}</p>
                    {/* #run-<key> is read by the real-runs player (demos.tsx), which opens that run's tab. */}
                    {e.recorded ? <a className="v6-ex__rec" href={`#run-${e.recorded}`}>See the recorded run below</a> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <p className="v6-ex__limit">{EXAMPLES_LIMIT}</p>
      </div>
    </section>
  );
}

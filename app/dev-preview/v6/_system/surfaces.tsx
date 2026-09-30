"use client";

/* WHAT YOU CAN POINT IT AT, SHOWN RATHER THAN LISTED (2026-09-30).

   Replaced three text sections (the pinned examples, the devices chapter and the four how-it-works cards):
   the founder's read was too much text and not enough product. Each card is one line and a small piece of
   the product.

   EVERY VALUE IN THESE PIECES IS REAL OR IS THE PRODUCT'S OWN CONTRACT:
     web app      the first three steps and timings of the recorded checkout run (_content/demos.ts)
     devices      the Fieldline fleet console fixture (lib/fixtures/drone-console.ts): its aircraft, their
                  starting state, and what Return home does in fixed mode (Returning, Landing, Landed at
                  Pad A). Pressing the button here plays that; it is labelled as the demo fixture it is.
     agent        the three MCP tools, named as lib/mcp/tools.ts names them
     approval     the steps of the recorded checkout plan; nothing runs until a person approves
     terminal     the install line and command from the console's Command line page (cli-section.tsx)
     readiness    Next, not built, and labelled so. The rows are the behaviours _content/coverage.ts names.

   The tier on each card (Live, Next) comes from _content/coverage.ts's rule: Live only after a real failing
   case went end to end through the product on that surface. */
import { useEffect, useRef, useState } from "react";
import { DEMOS } from "../_content/demos";
import "./surfaces.css";

const CHECKOUT = DEMOS[0].runs[0].journeys[0].steps;

type Craft = { status: string; altitude: number; battery: number; location: string };
const START: Craft = { status: "Flying", altitude: 42, battery: 76, location: "Field 3" };

function DronePanel() {
  const [c, setC] = useState<Craft>(START);
  const [log, setLog] = useState<string[]>(["SKY-01 airborne over Field 3"]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const home = () => {
    if (c.status !== "Flying") return;
    const step = (at: number, next: Partial<Craft>, line: string) =>
      timers.current.push(window.setTimeout(() => { setC((p) => ({ ...p, ...next })); setLog((l) => [line, ...l].slice(0, 3)); }, at));
    step(0, { status: "Returning", location: "En route to Pad A" }, "SKY-01 returning to Pad A");
    step(700, { status: "Landing", altitude: 8, location: "Pad A" }, "SKY-01 landing at Pad A");
    step(1500, { status: "Landed", altitude: 0, battery: START.battery - 2 }, "SKY-01 landed at Pad A");
  };
  const reset = () => { timers.current.forEach((t) => window.clearTimeout(t)); setC(START); setLog(["SKY-01 airborne over Field 3"]); };
  const moving = c.status === "Returning" || c.status === "Landing";
  return (
    <div className="sf-drone">
      <div className="sf-drone__bar">
        <span className="sf-drone__name">Fieldline Fleet Console</span>
        <span className="sf-drone__fix">Vraelis demo fixture</span>
      </div>
      <div className="sf-drone__body">
        <div className="sf-drone__map" aria-hidden>
          <svg viewBox="0 0 240 150" preserveAspectRatio="none">
            <path d="M24 122 C 70 110, 90 60, 150 48 S 210 40, 222 22" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" strokeDasharray="3 4" />
          </svg>
          <span className="sf-drone__pad" style={{ left: "10%", top: "81%" }}>Pad A</span>
          <span className="sf-drone__pad" style={{ left: "78%", top: "72%" }}>Pad B</span>
          <span className="sf-drone__craft" data-s={c.status} />
          <span className="sf-drone__other" style={{ left: "84%", top: "18%" }}>SKY-10</span>
        </div>
        <div className="sf-drone__side">
          <p className="sf-drone__craftname">SKY-01, survey drone</p>
          <dl className="sf-drone__stats">
            <div><dt>Status</dt><dd data-s={c.status}>{c.status}</dd></div>
            <div><dt>Altitude</dt><dd>{c.altitude} m</dd></div>
            <div><dt>Battery</dt><dd>{c.battery}%</dd></div>
            <div><dt>Location</dt><dd>{c.location}</dd></div>
          </dl>
          <div className="sf-drone__btns">
            {c.status === "Landed"
              ? <button type="button" onClick={reset}>Reset simulation</button>
              : <button type="button" onClick={home} disabled={moving}>Return home</button>}
          </div>
          <ol className="sf-drone__log">{log.map((l, i) => <li key={`${l}-${i}`}>{l}</li>)}</ol>
        </div>
      </div>
    </div>
  );
}

export function Surfaces() {
  // Cards rise in as they reach the screen. The hidden state is only applied once this has run (sf-anim),
  // so without script, or with reduced motion (surfaces.css), every card is simply there.
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = grid.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const cards = [...el.querySelectorAll<HTMLElement>(".sf-card")];
    el.classList.add("sf-anim");
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  return (
    <section className="v6-sf" aria-labelledby="v6-sf-h" data-nav-theme="light">
      <div className="v6-sf__in">
        <div className="v6-sf__head">
          <h2 id="v6-sf-h" className="v6-sf__h">One check for what you ship.</h2>
          <p className="v6-sf__lead">Websites, web apps and the devices they run. Start it from the console, your terminal or your AI agent.</p>
        </div>

        <div ref={grid} className="v6-sf__grid">
          {/* Web apps */}
          <article className="sf-card">
            <div className="sf-card__txt">
              <p className="sf-tier" data-t="live">Live</p>
              <h3>Web apps and sites</h3>
              <p>A real browser uses your live app the way a person would: production, staging or a preview.</p>
            </div>
            <div className="sf-ui sf-web" aria-hidden>
              <div className="sf-web__bar"><i /><i /><i /><span>broken-checkout.vercel.app/pricing.html</span></div>
              <div className="sf-web__page">
                <div className="sf-web__plan"><b>Pro</b><span>Unlimited notebooks</span><em>Get Pro</em></div>
                <span className="sf-web__cursor" />
              </div>
              <ol className="sf-web__steps">
                {CHECKOUT.slice(0, 3).map((s) => (
                  <li key={s.say}><span className="sf-ok" />{s.say}<span className="sf-ms">{s.ms} ms</span></li>
                ))}
              </ol>
            </div>
          </article>

          {/* Devices */}
          <article className="sf-card sf-card--wide" id="devices">
            <div className="sf-card__txt">
              <p className="sf-tier" data-t="live">Live, through the control panel</p>
              <h3>Drones, robots and fleets</h3>
              <p>Press a button in the panel, then check what the system reports afterwards, and again after a reload. Press Return home to see what a plan checks.</p>
              <p className="sf-note">Reading the device itself, its telemetry and firmware, is next and not built yet.</p>
            </div>
            <div className="sf-ui"><DronePanel /></div>
          </article>

          {/* Agent */}
          <article className="sf-card">
            <div className="sf-card__txt">
              <p className="sf-tier" data-t="live">Live</p>
              <h3>Your AI agent</h3>
              <p>Your coding agent checks its own work over MCP, reads what broke, and re-checks after the fix.</p>
            </div>
            <div className="sf-ui sf-mcp" aria-hidden>
              <p className="sf-mcp__h">Vraelis tools</p>
              <ul>
                <li><code>vraelis_verify</code><span>Check a change on the deployed app, before telling you it is done</span></li>
                <li><code>vraelis_status</code><span>Waiting for approval, running, or finished</span></li>
                <li><code>vraelis_recheck</code><span>Run the same approved check again after a fix</span></li>
              </ul>
            </div>
          </article>

          {/* Approval */}
          <article className="sf-card">
            <div className="sf-card__txt">
              <p className="sf-tier" data-t="live">Live</p>
              <h3>A person approves</h3>
              <p>Vraelis writes the plan from your sentence. Nothing runs until a person approves it.</p>
            </div>
            <div className="sf-ui sf-plan" aria-hidden>
              <div className="sf-plan__head"><span>Plan</span><em>Waiting for approval</em></div>
              <ol>
                {CHECKOUT.slice(0, 5).map((s, i) => <li key={s.say}><span>{String(i + 1).padStart(2, "0")}</span>{s.say}</li>)}
                <li className="sf-plan__more">and {CHECKOUT.length - 5} more steps</li>
              </ol>
              <div className="sf-plan__btns"><span className="sf-btn sf-btn--ghost">Edit</span><span className="sf-btn">Approve plan</span></div>
            </div>
          </article>

          {/* Terminal */}
          <article className="sf-card">
            <div className="sf-card__txt">
              <p className="sf-tier" data-t="live">Live</p>
              <h3>Terminal and CI</h3>
              <p>One command in your pipeline, after every preview deploy. Only exit 0 should ship.</p>
            </div>
            <div className="sf-ui sf-term" aria-hidden>
              <div className="sf-term__bar"><i /><i /><i /><span>deploy.yml</span></div>
              <pre>
                <span className="c"># install</span>{"\n"}
                <span className="p">$</span> curl -fsS https://vraelis.com/install | sh{"\n\n"}
                <span className="c"># check the preview</span>{"\n"}
                <span className="p">$</span> vraelis verify --url &quot;$PREVIEW_URL&quot; \{"\n"}
                {"    "}--claim &quot;$CLAIM&quot; --wait --json
              </pre>
            </div>
          </article>

          {/* Readiness: Next */}
          <article className="sf-card sf-card--row">
            <div className="sf-card__txt">
              <p className="sf-tier" data-t="next">Next, not built yet</p>
              <h3>Readiness for US and EU rules</h3>
              <p>The behaviour those rules look at, checked on the live product and dated, as evidence for your auditor or counsel. Not a certification and not legal advice.</p>
            </div>
            <div className="sf-ui sf-rules" aria-hidden>
              {["Trackers fire before consent", "Reject is as easy as accept", "Everything works from the keyboard", "Cancelling is as easy as signing up", "No default password on the device panel"].map((r) => (
                <div key={r} className="sf-rules__row"><span>{r}</span><em>Not checked yet</em></div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* HOW A CHECK WORKS, IN THREE LINES (2026-10-01).

   Replaced the six-card grid of small product pieces: the founder read the homepage as too many visuals,
   with the drone as the one he wanted. Each step is a thing the product does today; the real recorded run
   is one click away on the Platform page, where it plays in the hero. */
import { EditorialLink } from "./ui";
import { V6_BASE } from "@/lib/v6-routes";
import "./steps.css";

const STEPS: [string, string][] = [
  ["Say what should work", "One sentence about your web app, or the device it controls. From the console, your terminal or your AI agent."],
  ["Approve the plan", "Vraelis writes the steps that would prove it. Nothing runs, and nothing is charged, until a person approves them."],
  ["See what happened", "A real browser runs the plan on the live product. You get every step and a screenshot, and a repair prompt when something broke."],
];

export function Steps() {
  return (
    <section className="v6-st3" aria-labelledby="v6-st3-h" data-nav-theme="light">
      <div className="v6-st3__in">
        <div className="v6-st3__head">
          <h2 id="v6-st3-h" className="v6-st3__h">How a check works.</h2>
          <EditorialLink href={`${V6_BASE}/platform`}>Watch a real run</EditorialLink>
        </div>
        <ol className="v6-st3__list">
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <span className="v6-st3__n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

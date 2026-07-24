"use client";

// Homepage opening: one immersive environment holding the headline, the responsibility, its live activity,
// the decision waiting on a person, and the completion arc. The first frame states the whole system before
// anything moves; motion only advances the trajectory to the state the work has actually reached.
import type { CSSProperties } from "react";
import { CTA, EditorialLink } from "./ui";
import "./hero.css";

const STATES = ["Assigned", "Active", "Review required", "Repair", "Trusted completion"] as const;
const NOW = 2; // the responsibility is currently waiting on a human decision

export function Hero() {
  // The trajectory's reach is a CSS animation, not React state: the rail renders at its true width for a
  // reduced-motion or no-JS visitor, and only grows into it when motion is allowed.
  return (
    <section className="v6-h" data-nav-dark>
      <div className="v6-h__field" aria-hidden />

      {/* Cropped product surfaces, bleeding off the viewport edges as background planes */}
      <div className="v6-h__crop v6-h__crop--act" aria-hidden>
        <div className="v6-h__crop-h">
          <span className="v6-kicker" style={{ color: "var(--go-dk)" }}>Live activity</span>
          <span className="v6-mono" style={{ fontSize: 11, color: "var(--g-fg-3)" }}>billing-web</span>
        </div>
        <div className="v6-h__crop-r"><span>plan created</span><b>6 steps</b></div>
        <div className="v6-h__crop-r"><span>files changed</span><b>7</b></div>
        <div className="v6-h__crop-r"><span>stripe.price.create</span><b className="green">ok</b></div>
        <div className="v6-h__crop-r"><span>assumption</span><b className="amber">unverified</b></div>
        <div className="v6-h__crop-r"><span>usage meter, free plan</span><b className="red">not enforced</b></div>
      </div>
      <div className="v6-h__crop v6-h__crop--ev" aria-hidden>
        <div className="v6-h__crop-h">
          <span className="v6-kicker" style={{ color: "var(--g-fg-3)" }}>Evidence</span>
        </div>
        <div className="v6-h__crop-r"><span>real browser run</span><b>captured</b></div>
        <div className="v6-h__crop-r"><span>api trace</span><b>captured</b></div>
        <div className="v6-h__crop-r"><span>screenshots</span><b>4</b></div>
      </div>

      {/* Content plane, sitting over the field */}
      <div className="v6-h__inner">
        <p className="v6-eyebrow v6-h__eyebrow">Oversight for AI software agents</p>
        <h1 className="v6-h__h1">
          <span className="v6-mask"><span className="v6-mask__in lead-clause">AI agents are taking responsibility for software.</span></span>
          <span className="v6-mask"><span className="v6-mask__in" style={{ ["--d" as string]: 1 } as CSSProperties}>Vraelis determines what their work deserves to become.</span></span>
        </h1>
        <p className="v6-h__say">Vraelis follows the work from the moment it is assigned to the moment it can be trusted, challenging what the evidence does not support and holding the decisions only a person should make.</p>
        <div className="v6-h__cta">
          <CTA brand lg>Open Vraelis</CTA>
          <EditorialLink href="#how">See how oversight works</EditorialLink>
        </div>
      </div>

      {/* The responsibility under governance, riding its trajectory */}
      <div className="v6-h__gov">
        <div className="v6-h__resp">
          <span className="v6-h__resp-k">Responsibility</span>
          <p className="v6-h__resp-t">Add usage-based billing without ever overcharging an existing customer.</p>
        </div>
        <div className="v6-h__traj">
          <div className="v6-h__rail">
            <div className="v6-h__fill" />
          </div>
          <div className="v6-h__states">
            {STATES.map((s, i) => (
              <div key={s} className={`v6-h__state ${i < NOW ? "done" : ""} ${i === NOW ? "now" : ""}`}>
                <span className="v6-h__state-l">{s}</span>
              </div>
            ))}
          </div>
          <div className="v6-h__now">
            <span className="v6-h__now-t">A person must approve the new pricing before it ships.</span>
            <span className="v6-h__now-d">Vraelis stopped it here.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

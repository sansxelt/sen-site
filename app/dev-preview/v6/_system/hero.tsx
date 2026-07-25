"use client";

// Homepage opening: one immersive environment holding the headline, the requirement, the result of checking
// it, the decision waiting on a person, and the arc to shipping. The first frame states the whole system
// before anything moves; motion only advances the trajectory to the state the work has actually reached.
// The requirement introduced here is the same object the lifecycle scene follows and the closing scene
// resolves. Positioning copy comes from _system/positioning.ts and is provisional.
import type { CSSProperties } from "react";
import { CTA, EditorialLink } from "./ui";
import { CATEGORY, HEADLINE, SUPPORT } from "./positioning";
import "./hero.css";

// State names describe what Vraelis actually does: a requirement is written, the agent claims the work is
// done, the claim is checked, a repair is rechecked, the change ships. Nothing here implies that Vraelis
// watches an agent while it works, because it does not.
const STATES = ["Required", "Claimed", "Review", "Repair", "Shipped"] as const;
const NOW = 2; // the requirement is currently waiting on a human decision

export function Hero() {
  // The trajectory's reach is a CSS animation, not React state: the rail renders at its true width for a
  // reduced-motion or no-JS visitor, and only grows into it when motion is allowed.
  return (
    <section className="v6-h" data-nav-dark>
      <div className="v6-h__field" aria-hidden />

      {/* Cropped product surface, bleeding off the viewport edge as a background plane. This is the result of
          a check against a requirement, not a live feed: Vraelis reads the running software when work is
          claimed complete. It is not watching the agent, and this panel must never be relabelled as if it is. */}
      <div className="v6-h__crop v6-h__crop--act" aria-hidden>
        <div className="v6-h__crop-h">
          <span className="v6-kicker" style={{ color: "var(--brand-dk)" }}>Checked against the requirement</span>
          <span className="v6-mono" style={{ fontSize: 11, color: "var(--g-fg-3)" }}>billing-web</span>
        </div>
        <div className="v6-h__crop-r"><span>plan approved</span><b>6 steps</b></div>
        <div className="v6-h__crop-r"><span>in scope</span><b>3 systems</b></div>
        <div className="v6-h__crop-r"><span>checkout flow</span><b className="green">holds</b></div>
        <div className="v6-h__crop-r"><span>usage limit, free plan</span><b className="red">not enforced</b></div>
        <div className="v6-h__crop-r"><span>new pricing</span><b className="amber">needs a person</b></div>
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
        {/* Category and headline are provisional and come from one file. Do not inline them here. */}
        <p className="v6-eyebrow v6-h__eyebrow">{CATEGORY}</p>
        <h1 className="v6-h__h1">
          <span className="v6-mask"><span className="v6-mask__in lead-clause">{HEADLINE[0]}</span></span>
          <span className="v6-mask"><span className="v6-mask__in" style={{ ["--d" as string]: 1 } as CSSProperties}>{HEADLINE[1]}</span></span>
        </h1>
        <p className="v6-h__say">{SUPPORT}</p>
        <div className="v6-h__cta">
          <CTA brand lg>Open Vraelis</CTA>
          <EditorialLink href="#how">See how it works</EditorialLink>
        </div>
      </div>

      {/* The requirement under review, riding its trajectory */}
      <div className="v6-h__gov">
        <div className="v6-h__resp">
          <span className="v6-h__resp-k">Requirement</span>
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

/* Full-page anchors intentionally cross the marketing and app host boundaries. */
/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";
import { ProductSurface } from "@/app/_components/product-surface";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

// Shared account entry frame. The form keeps the existing auth flows; the right
// panel uses locally hosted field imagery and links to the recorded homepage check.
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <ProductSurface>
      <div className="auth-split">
        <div className="auth-split__form">
          <div className="auth-split__head">
            <a href="/" className="auth-split__brand">Vraelis</a>
            <span className="auth-split__tools">
              <LanguageSwitcher placement="down" align="right" />
              <a href="/" className="auth-split__back"><span aria-hidden>←</span> Back to site</a>
            </span>
          </div>
          <main className="auth-split__main">{children}</main>
          {/* flex-wrap inline: five links and a button no longer fit one row on a phone. */}
          <p className="auth-split__foot" style={{ flexWrap: "wrap", rowGap: 8 }}>
            <a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a>
            <a href="/acceptable-use">Acceptable use</a><a href="/security">Security</a><PrivacyChoicesButton />
          </p>
        </div>
        <aside className="auth-split__side" aria-label="Vraelis">
          {/* Static, locally hosted film poster. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="auth-split__scene" src="/home/systems-poster-opening.jpg" alt="" />
          <div className="auth-split__sidein">
            <p className="auth-split__title">Know your<br />systems work.</p>
            <p className="auth-split__kicker">External software review for defense, infrastructure and robotics.</p>
            <a className="auth-split__demo-link" href="/#how-a-check-works">See a check in action <span aria-hidden>→</span></a>
          </div>
        </aside>
      </div>
    </ProductSurface>
  );
}

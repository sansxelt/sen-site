/* Full-page anchors intentionally cross the marketing and app host boundaries. */
/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";
import "@/components/button-motion.css";
import "./auth-entry.css";
import { AuthStage } from "@/components/auth-stage";
import { ProductSurface } from "@/app/_components/product-surface";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

// One focused account frame shared by entry, recovery and confirmation steps.
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <ProductSurface>
      <style>{"html:has(.auth-entry), body:has(.auth-entry) { background:#f8fafc!important; color-scheme:light!important; }"}</style>
      <div className="auth-split auth-entry">
        <div className="auth-split__form">
          <div className="auth-split__head">
            <a href="/" className="auth-split__brand">Vraelis</a>
            <span className="auth-split__tools">
              <LanguageSwitcher placement="down" align="right" />
              <a href="/" className="auth-split__back"><span aria-hidden>←</span> Back to site</a>
            </span>
          </div>
          <main className="auth-split__main"><AuthStage>{children}</AuthStage></main>
          {/* flex-wrap inline: five links and a button no longer fit one row on a phone. */}
          <p className="auth-split__foot" style={{ flexWrap: "wrap", rowGap: 8 }}>
            <a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a>
            <a href="/acceptable-use">Acceptable use</a><a href="/security">Security</a><PrivacyChoicesButton />
          </p>
        </div>

      </div>
    </ProductSurface>
  );
}

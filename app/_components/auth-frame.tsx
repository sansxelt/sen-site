/* Full-page anchors intentionally cross the marketing and app host boundaries. */
import type { ReactNode } from "react";
import "@/components/button-motion.css";
import "./auth-entry.css";
import { AuthStage } from "@/components/auth-stage";
import { ProductSurface } from "@/app/_components/product-surface";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

// One focused account frame shared by entry, recovery and confirmation steps.
export function AuthFrame({ children, workspace = false }: { children: ReactNode; workspace?: boolean }) {
  return (
    <ProductSurface>
      <style>{"html:has(.auth-entry), body:has(.auth-entry) { background:#0a0a0b!important; color-scheme:dark!important; }"}</style>
      <div className="auth-split auth-entry" data-workspace={workspace || undefined}>
        <div className="auth-split__form">
          <div className="auth-split__head">
            <a href="https://vraelis.com/" className="auth-split__brand">Vraelis</a>
            <span className="auth-split__tools">
              <LanguageSwitcher placement="down" align="right" />
              <a href="https://vraelis.com/" className="auth-split__back">Back to site</a>
            </span>
          </div>
          <main className="auth-split__main"><AuthStage>{children}</AuthStage></main>
          {/* flex-wrap inline: five links and a button no longer fit one row on a phone. */}
          <p className="auth-split__foot" style={{ flexWrap: "wrap", rowGap: 8 }}>
            <a href="https://vraelis.com/terms">Terms</a><a href="https://vraelis.com/privacy">Privacy</a><a href="https://vraelis.com/cookies">Cookies</a>
            <a href="https://vraelis.com/acceptable-use">Acceptable use</a><a href="https://vraelis.com/security">Security</a><PrivacyChoicesButton />
          </p>
        </div>

      </div>
    </ProductSurface>
  );
}

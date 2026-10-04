import type { ReactNode } from "react";
import strikeConsole from "@/app/dev-preview/v6/_content/demos/strike-console.png";
import { ProductSurface } from "@/app/_components/product-surface";
import { PicturePlate } from "@/app/dev-preview/v6/_system/picture-plate";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";
import { LanguageSwitcher } from "@/components/language-switcher";

// THE ACCOUNT SCREENS' FRAME: sign-in, create account, verify email, reset password, the auth errors and the
// two-step code (2026-09-30). One frame for all of them, so moving from signing up to confirming an address
// never changes the page around the form.
//
// Two halves. The form sits on the dark background with the wordmark above it. On a wide screen the right half is the ink
// brand panel, the same one that closes every page of the site: the headline, a capture from a recorded check of the
// Larkspur simulation, and the two partnership records. On a phone the right half is dropped.
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
        <aside className="auth-split__side" aria-label="What a Vraelis check looks like">
          <div className="auth-split__sidein">
            <p className="auth-split__title">Know your systems work.</p>
            <p className="auth-split__kicker">A recorded check of Larkspur, our attack drone simulation.</p>
            <PicturePlate src={strikeConsole}
              alt="Larkspur, Vraelis's simulated attack drone mission console, from a recorded browser check."
              evidence eager />
            <div className="auth-split__partners">
              <span>Partnership records</span>
              <a href="/partnerships/reddit">Vraelis × Reddit</a>
              <a href="/partnerships/bytedance">Vraelis × ByteDance</a>
            </div>
          </div>
        </aside>
      </div>
    </ProductSurface>
  );
}

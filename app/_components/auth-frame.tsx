import type { ReactNode } from "react";
import { ProductSurface } from "@/app/_components/product-surface";
import { RecordPreview } from "@/components/record-preview";
import { PrivacyChoicesButton } from "@/app/_components/privacy-choices-button";

// THE ACCOUNT SCREENS' FRAME: sign-in, create account, verify email, reset password, the auth errors and the
// two-step code (2026-09-30). One frame for all of them, so moving from signing up to confirming an address
// never changes the page around the form.
//
// Two plain halves. The form sits on white with the wordmark above it. On a wide screen the right half is the
// grey band the site uses, holding a real recorded verification as the console shows it, so the first thing
// a new account sees is the product rather than a pattern. On a phone the right half is dropped.
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <ProductSurface>
      <div className="auth-split">
        <div className="auth-split__form">
          <div className="auth-split__head">
            <a href="/" className="auth-split__brand">Vraelis</a>
            <a href="/" className="auth-split__back"><span aria-hidden>←</span> Back to site</a>
          </div>
          <main className="auth-split__main">{children}</main>
          {/* flex-wrap inline: five links and a button no longer fit one row on a phone. */}
          <p className="auth-split__foot" style={{ flexWrap: "wrap", rowGap: 8 }}>
            <a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a>
            <a href="/acceptable-use">Acceptable use</a><a href="/security">Security</a><PrivacyChoicesButton />
          </p>
        </div>
        <aside className="auth-split__side" aria-label="What a Vraelis verification looks like">
          <div className="auth-split__sidein">
            <p className="auth-split__kicker">A real run, as the console shows it</p>
            <p className="auth-split__title">Say what should work. See whether it did, with the evidence.</p>
            <RecordPreview compact />
          </div>
        </aside>
      </div>
    </ProductSurface>
  );
}

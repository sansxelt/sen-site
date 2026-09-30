import type { ReactNode } from "react";
import { ProductSurface } from "@/app/_components/product-surface";
import { RecordPreview } from "@/components/record-preview";

// THE ACCOUNT SCREENS' FRAME: sign-in, create account, verify email, reset password, the auth errors and the
// two-step code (2026-09-30). One frame for all of them, so moving from signing up to confirming an address
// never changes the page around the form.
//
// Two halves. The form sits on white with the wordmark above it. On a wide screen the right half is the ink
// brand panel, the same one that closes every page of the site: the headline, a real recorded check as the
// console shows it, and the two partnership records. On a phone the right half is dropped.
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
          <p className="auth-split__foot">
            <a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><a href="/security">Security</a>
          </p>
        </div>
        <aside className="auth-split__side" aria-label="What a Vraelis check looks like">
          <div className="auth-split__sidein">
            <p className="auth-split__title">Know what you built does what you meant.</p>
            <p className="auth-split__kicker">A real check on a Vraelis demo app, as the console shows it.</p>
            <RecordPreview compact />
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

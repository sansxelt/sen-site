import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AuthFrame } from "@/app/_components/auth-frame";
import { robotsMeta } from "@/lib/stealth";

// A SIGN-IN SURFACE IS NOT A SEARCH RESULT.
//
// These inherited the root layout's index/follow, so the account pages were advertised to crawlers the
// moment the curtain lifted. A password-reset page in a search index is noise at best.
export const metadata: Metadata = { robots: robotsMeta(false) };

// Auth round-trip screens (verify-email, confirm-signup, verified, reset-password, error, auto-signin) share
// the sign-in frame (app/_components/auth-frame.tsx), so signing up walks from sign-in to confirmation to the
// product without the page changing around the form. They used to sit in their own sticky-veil shell.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthFrame><div className="auth-form auth-form--wide">{children}</div></AuthFrame>;
}

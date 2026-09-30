import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AuthFrame } from "@/app/_components/auth-frame";
import { robotsMeta } from "@/lib/stealth";

// A SIGN-IN SURFACE IS NOT A SEARCH RESULT.
//
// These inherited the root layout's index/follow, so the account pages were advertised to crawlers the
// moment the curtain lifted. A password-reset page in a search index is noise at best.
export const metadata: Metadata = { robots: robotsMeta(false) };

// The frame (two halves, the wordmark, a real recorded run on the right) is shared with every /auth screen:
// see app/_components/auth-frame.tsx.
export default function SignInLayout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}

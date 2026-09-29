import type { ReactNode } from "react";
import type { Metadata } from "next";
import SignInLayout from "@/app/signin/layout";
import { robotsMeta } from "@/lib/stealth";

// The consent screen is part of signing in, so it wears the sign-in surface rather than a look of its own:
// a person sent here by ChatGPT or claude.ai should recognise the page they would sign in on.
export const metadata: Metadata = { robots: robotsMeta(false) };

export default function OAuthLayout({ children }: { children: ReactNode }) {
  return <SignInLayout>{children}</SignInLayout>;
}

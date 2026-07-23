import type { ReactNode } from "react";
import { ogMeta } from "@/lib/og-meta";

// The SSO page is a client component, so its metadata lives here. Without this it would
// inherit the root layout's canonical (the homepage). index: false because /sso is an
// entry point reached from error redirects and IdP links, not a page in the sitemap.
export const metadata = ogMeta({
  title: "Sign in with SSO",
  description: "Enter your work email to sign in through your organization's identity provider.",
  path: "/sso",
  index: false,
});

export default function SsoLayout({ children }: { children: ReactNode }) {
  return children;
}

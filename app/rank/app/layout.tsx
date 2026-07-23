import type { Metadata } from "next";
import type { ReactNode } from "react";

// Authenticated product pages are private — never indexed. Without this every page under
// /rank/app inherits the root layout's index:true.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// The authenticated theme boundary.
//
// Everything under /rank/app renders inside data-surface="app", and the authenticated token layer is scoped
// entirely to that attribute. A public page rendering the same component resolves the untouched public
// tokens, so the two systems cannot bleed into each other by accident.
//
// The boundary is an attribute on one wrapper rather than a class scattered through components, because the
// rule needs to be checkable: any page that hardcodes a colour instead of using a token is then visible as a
// deviation rather than hidden among fifteen other places doing the same thing.
//
// One brand, two contexts. The public site stays open and explanatory. The product is the same brand held
// tighter: warm-neutral, more compact, more operational. It is NOT a dark application. Exactly one surface
// is dark, the verification console, where the engine enters the interface.
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Loaded here rather than globally so the authenticated tokens never reach a public document. */}
      <link rel="stylesheet" href="/vraelis/authenticated.css?v=1" />
      <div data-surface="app">{children}</div>
    </>
  );
}

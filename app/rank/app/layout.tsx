import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProductSurface } from "@/app/_components/product-surface";

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
// One brand, two grounds. Design 06 assigns surfaces by what they carry: light carries company framing and
// knowledge, graphite carries runs, evidence, findings and consequential decisions. The signed-in product is
// nothing but those, so it is graphite by the system's own rule rather than by taste.
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <ProductSurface>{children}</ProductSurface>;
}

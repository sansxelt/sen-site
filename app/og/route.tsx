import { NextResponse } from "next/server";
import { SOCIAL_IMAGE } from "@/lib/social-card";

// Retired. Every page's link preview is the plain Vraelis mark (lib/social-card.ts); this rendered headline
// card was the last surface still wearing an old design, and nothing links to it. Old shares that still
// point here get the mark instead of a broken image.
export function GET() {
  return NextResponse.redirect(SOCIAL_IMAGE, 308);
}

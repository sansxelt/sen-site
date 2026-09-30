import { NextResponse } from "next/server";
import { SOCIAL_IMAGE } from "@/lib/social-card";

// Retired, like /og: shared /r/<token> links show the plain Vraelis mark (lib/social-card.ts), which also
// never reveals whether a private token exists.
export function GET() {
  return NextResponse.redirect(SOCIAL_IMAGE, 308);
}

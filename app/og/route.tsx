import { NextResponse } from "next/server";
import { SOCIAL_IMAGE } from "@/lib/social-card";

// Legacy preview URLs redirect to the current shared artwork.
export function GET() {
  return NextResponse.redirect(SOCIAL_IMAGE, 308);
}

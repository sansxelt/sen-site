import { NextResponse } from "next/server";
import { SOCIAL_IMAGE } from "@/lib/social-card";

// Legacy result previews use shared artwork without revealing whether a private token exists.
export function GET() {
  return NextResponse.redirect(SOCIAL_IMAGE, 308);
}

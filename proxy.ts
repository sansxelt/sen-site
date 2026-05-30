import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Single-domain proxy. Only job: redirect www to apex.
// All routing now lives in Next.js file-system routes on vraelis.com.
// Chat UI lives at /chat, platform at /platform, marketing at /home etc.

export default function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const url  = req.nextUrl;

  // www.vraelis.com → vraelis.com (permanent)
  if (host === "www.vraelis.com") {
    return NextResponse.redirect(
      new URL(url.pathname + url.search, "https://vraelis.com"),
      308,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};

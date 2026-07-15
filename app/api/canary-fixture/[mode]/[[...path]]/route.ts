// Live first-party canary fixture routes — thin Next adapter over the pure handler in
// lib/preflight/runtime/canary-fixture-http.ts (see its header for the safety posture: stateless, data-free,
// disabled with a uniform 404 unless VRAELIS_CANARY_PASSWORD is configured).
//
// This is the ONLY public surface the multi-platform program adds, and it exposes nothing: a fake API with
// signed throwaway ids that the internal founder-gated canary verifies against over real HTTPS.

import { NextRequest, NextResponse } from "next/server";
import { handleFixture, type FixtureMode } from "@/lib/preflight/runtime/canary-fixture-http";

export const dynamic = "force-dynamic";

async function serve(req: NextRequest, ctx: { params: Promise<{ mode: string; path?: string[] }> }) {
  const { mode, path = [] } = await ctx.params;
  const search = req.nextUrl.search ?? "";
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const body = req.method === "POST" ? (await req.text()).slice(0, 4096) : undefined;

  const res = handleFixture({
    mode: mode as FixtureMode,
    method: req.method,
    path: `/${path.join("/")}${search}`,
    headers,
    body,
    password: process.env.VRAELIS_CANARY_PASSWORD,
    clock: () => Date.now(),
  });
  return new NextResponse(res.body, { status: res.status, headers: res.headers });
}

export { serve as GET, serve as POST };

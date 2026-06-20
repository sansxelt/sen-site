// POST /api/flip/crypto/charge — create a direct-USDC invoice for a one-time
// (lifetime) plan. Returns the merchant wallet + a unique exact amount; the
// customer sends USDC on Base and /status confirms it on-chain. Crypto is
// lifetime-only in v1 (one-time by nature, no expiry tracking needed).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCryptoInvoice } from "@/lib/flip-db";
import { receivingAddress, isCryptoConfigured, currentBlock, toUnits, fromUnits, chainInfo } from "@/lib/usdc";

export const runtime = "nodejs";

const LIFETIME_USD: Record<string, number> = { seller: 290, growth: 790 };

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isCryptoConfigured()) return NextResponse.json({ error: "crypto_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const plan = String(body?.plan || "");
  const cycle = String(body?.cycle || "");
  if (cycle !== "lifetime" || !(plan in LIFETIME_USD)) {
    return NextResponse.json({ error: "crypto_lifetime_only" }, { status: 400 });
  }

  const addr = receivingAddress()!;
  const usd = LIFETIME_USD[plan];
  // base price + sub-cent random offset (1..9999 micro-USDC) => unique on-chain amount
  const amountUnits = toUnits(usd) + 1 + Math.floor(Math.random() * 9999);

  let startBlock = 0;
  try { startBlock = await currentBlock("base"); } catch { /* leave 0; status scans from genesis-ish but matches by exact amount */ }

  const inv = await createCryptoInvoice({ userId: email, plan, cycle, amountUnits, chain: "base", toAddress: addr, startBlock });
  if (!inv) return NextResponse.json({ error: "invoice_failed" }, { status: 500 });

  const c = chainInfo("base");
  return NextResponse.json({
    id: inv.id, plan, usd,
    chain: c.name, token: "USDC", toAddress: addr,
    amount: fromUnits(amountUnits), amountUnits,
    explorer: c.explorer,
  });
}

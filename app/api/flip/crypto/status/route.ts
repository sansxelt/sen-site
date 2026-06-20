// GET /api/flip/crypto/status?id=... — poll a USDC invoice. Reads Base on-chain
// for an exact-amount USDC Transfer to the merchant wallet since the invoice's
// start block. On first confirmation: mark paid + flip the account to Pro.
// Safe to call publicly — Pro is only granted if a real matching transfer exists.

import { NextResponse } from "next/server";
import { getCryptoInvoice, markCryptoInvoicePaid, setFlipPlan } from "@/lib/flip-db";
import { findPayment } from "@/lib/usdc";

export const runtime = "nodejs";

const EXPIRY_MIN = 60;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const inv = await getCryptoInvoice(id);
  if (!inv) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (inv.status === "paid") return NextResponse.json({ status: "paid", txHash: inv.tx_hash });

  const ageMin = (Date.now() - new Date(inv.created_at).getTime()) / 60000;
  if (ageMin > EXPIRY_MIN) return NextResponse.json({ status: "expired" });

  let txHash: string | null = null;
  try {
    txHash = await findPayment({ chain: inv.chain, toAddress: inv.to_address, amountUnits: inv.amount_units, startBlock: inv.start_block });
  } catch {
    return NextResponse.json({ status: "pending" }); // transient RPC error — keep polling
  }

  if (txHash) {
    await markCryptoInvoicePaid(inv.id, txHash);
    await setFlipPlan({ userId: inv.user_id, plan: "pro", planStatus: "active" });
    return NextResponse.json({ status: "paid", txHash });
  }
  return NextResponse.json({ status: "pending" });
}

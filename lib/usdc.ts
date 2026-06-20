// Direct USDC payment verification — no processor. A customer sends USDC to the
// merchant wallet (USDC_RECEIVING_ADDRESS) on Base; we read the chain over plain
// JSON-RPC to confirm an exact-amount Transfer landed. Non-custodial: funds go
// straight to the merchant's wallet, we only READ the chain.

const CHAINS: Record<string, { rpc: string; usdc: string; name: string; explorer: string }> = {
  base: {
    rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // native USDC on Base (6 decimals)
    name: "Base",
    explorer: "https://basescan.org",
  },
};

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const USDC_DECIMALS = 6;
export function toUnits(usd: number): number { return Math.round(usd * 10 ** USDC_DECIMALS); }
export function fromUnits(units: number | bigint): string {
  return (Number(units) / 10 ** USDC_DECIMALS).toFixed(USDC_DECIMALS);
}

export function chainInfo(chain = "base") {
  const c = CHAINS[chain];
  if (!c) throw new Error(`unsupported chain: ${chain}`);
  return c;
}
export function receivingAddress(): string | null {
  const a = process.env.USDC_RECEIVING_ADDRESS;
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? a : null;
}
export function isCryptoConfigured(): boolean {
  return Boolean(receivingAddress());
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message || "rpc error");
  return j.result;
}

export async function currentBlock(chain = "base"): Promise<number> {
  const c = chainInfo(chain);
  const hex = (await rpc(c.rpc, "eth_blockNumber", [])) as string;
  return parseInt(hex, 16);
}

function topicAddress(addr: string): string {
  return "0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

// Look for a USDC Transfer of EXACTLY amountUnits to `toAddress` since startBlock.
// Returns the tx hash if found, else null. Exact-amount match is what ties an
// anonymous transfer back to a specific invoice (each invoice gets a unique
// amount with a sub-cent random offset).
export async function findPayment(args: {
  chain?: string;
  toAddress: string;
  amountUnits: number;
  startBlock: number;
}): Promise<string | null> {
  const c = chainInfo(args.chain || "base");
  const logs = (await rpc(c.rpc, "eth_getLogs", [
    {
      address: c.usdc,
      topics: [TRANSFER_TOPIC, null, topicAddress(args.toAddress)],
      fromBlock: "0x" + Math.max(0, args.startBlock).toString(16),
      toBlock: "latest",
    },
  ])) as { data: string; transactionHash: string }[];

  const want = BigInt(args.amountUnits);
  for (const log of logs) {
    try {
      if (BigInt(log.data) === want) return log.transactionHash;
    } catch { /* skip malformed */ }
  }
  return null;
}

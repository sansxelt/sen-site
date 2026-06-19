// Flip Engine — the Claude vision call. Mirrors the client setup in
// lib/vraelis-ai.ts (the @anthropic-ai/sdk, ANTHROPIC_API_KEY from env). Uses the
// TS SDK's messages.parse() + zodOutputFormat to FORCE a valid listing schema —
// no manual JSON parsing, the response is typed + validated.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const Listing = z.object({
  item_type: z.string(),
  brand: z.string(), // "unknown" if not clearly visible
  model: z.string(),
  colorway: z.string(),
  size: z.string(), // "unknown" if not visible
  condition_grade: z.enum(["NWT", "excellent", "good", "fair"]),
  condition_notes: z.string(),
  key_features: z.array(z.string()),
  visible_flaws: z.array(z.string()),
  measurements_to_take: z.array(z.string()),
  category: z.string(),
  keywords: z.array(z.string()),
  titles: z.object({ ebay: z.string(), poshmark: z.string(), depop: z.string(), mercari: z.string() }),
  description: z.string(),
  hashtags: z.object({ poshmark: z.array(z.string()), depop: z.array(z.string()) }),
  price: z.object({
    fast: z.number(),
    market: z.number(),
    high: z.number(),
    confidence: z.enum(["low", "medium", "high"]),
  }),
});

export type FlipListing = z.infer<typeof Listing>;

const PROMPT = `You are an expert reseller listing writer. From the item photos, identify the item and produce an optimized resale listing.
Rules:
- NEVER invent a brand, size, or detail you can't clearly see — set it to "unknown" and add it to measurements_to_take.
- eBay title: ~80 chars, keyword-dense, front-load brand + item + key attributes.
- Poshmark: friendly, brand/size forward. Depop: casual + trendy. Mercari: concise.
- price: estimate fast/market/high in USD from typical resale value for this exact item + condition; set confidence honestly (low if unsure of the item).
- Flag any authenticity uncertainty in condition_notes.`;

export async function generateListing(
  images: { media_type: string; data: string }[],
): Promise<FlipListing> {
  const res = await client.messages.parse({
    model: "claude-sonnet-4-6", // COST LEVER: "claude-opus-4-8" for higher quality, ~40% more $/listing
    max_tokens: 4000, // listing JSON is small; no streaming needed
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: img.media_type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: img.data,
            },
          })),
          { type: "text" as const, text: PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(Listing) },
  });
  if (!res.parsed_output) throw new Error("listing parse failed");
  return res.parsed_output; // typed + validated
}

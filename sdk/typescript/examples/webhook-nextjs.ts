// Example: verify a Vraelis webhook in a Next.js App Router route handler.
// The signature is over the RAW body, so read req.text() (never req.json() first).
import { verifyWebhookSignature, type VraelisWebhookEvent } from "@vraelis/sdk";

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text(); // raw body — required for signature verification
  const ok = verifyWebhookSignature({
    payload: raw,
    signature: req.headers.get("x-vraelis-signature"),
    timestamp: req.headers.get("x-vraelis-timestamp"),
    secret: process.env.VRAELIS_WEBHOOK_SECRET!,
    toleranceSeconds: 300, // optional replay protection (±5 min)
  });
  if (!ok) return new Response("invalid signature", { status: 401 });

  const event = JSON.parse(raw) as VraelisWebhookEvent;
  if (event.event === "test.completed") {
    const dp = event.decision_package;
    console.log("decision:", dp?.["recommended_output"], "mode:", event.mode);
    // … act on the result (it's a test_event when sent from the dashboard console).
  }
  return new Response("ok", { status: 200 });
}

// Express equivalent — capture the raw body with express.raw():
//
//   import express from "express";
//   const app = express();
//   app.post("/webhooks/vraelis", express.raw({ type: "application/json" }), (req, res) => {
//     const raw = req.body.toString("utf8");
//     const ok = verifyWebhookSignature({
//       payload: raw,
//       signature: req.header("x-vraelis-signature"),
//       timestamp: req.header("x-vraelis-timestamp"),
//       secret: process.env.VRAELIS_WEBHOOK_SECRET!,
//     });
//     if (!ok) return res.status(401).send("invalid signature");
//     res.status(200).send("ok");
//   });

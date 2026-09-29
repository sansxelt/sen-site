// Example: receive a Vraelis verification.completed webhook in a Next.js App Router route handler.
// The signature is over the RAW body, so read req.text() (never req.json() first).
import { verifyWebhookSignature, type VraelisWebhookEvent } from "@vraelis/sdk";

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text(); // raw body, required for signature verification
  const ok = verifyWebhookSignature({
    payload: raw,
    signature: req.headers.get("x-vraelis-signature"),
    timestamp: req.headers.get("x-vraelis-timestamp"),
    secret: process.env.VRAELIS_WEBHOOK_SECRET!,
    toleranceSeconds: 300, // optional replay protection (5 minutes either way)
  });
  if (!ok) return new Response("invalid signature", { status: 401 });

  const event = JSON.parse(raw) as VraelisWebhookEvent;
  if (event.event === "verification.completed") {
    const verificationId = `vrf_${event.run_id}`; // the id the API and SDK use for this run
    console.log(
      `${verificationId}: ${event.decision} (${event.flows_passed}/${event.flows_total} flows passed)`,
      event.deployment_url ?? "",
      event.report_url ?? "",
    );
    if (event.test_event) return new Response("ok", { status: 200 }); // a sample sent from the dashboard
    if (event.decision === "failed") {
      // Read the failures and the repair prompt with vraelis.verifications.get(verificationId),
      // hand them to the coding agent, and re-check after it redeploys.
    }
  }
  return new Response("ok", { status: 200 });
}

// Express equivalent. Capture the raw body with express.raw():
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
//     const event = JSON.parse(raw);
//     console.log(event.decision);
//     res.status(200).send("ok");
//   });

// Example: create a sandbox evaluation, fetch its Decision Package, export it.
// Run: VRAELIS_API_KEY=vr_live_… npx tsx examples/sdk-sandbox.ts
// (Once published: import from "@vraelis/sdk". Locally: import from "../src/index".)
import { Vraelis, VraelisAPIError } from "@vraelis/sdk";

const vraelis = new Vraelis({ apiKey: process.env.VRAELIS_API_KEY! });

async function main() {
  try {
    // Sandbox: sample decision package, no credits, no quota.
    const evaluation = await vraelis.evaluations.create({
      title: "Sandbox hero test",
      category: "landing",
      sandbox: true,
      options: [{ label: "Hero A" }, { label: "Hero B" }],
    });
    console.log("created:", evaluation.id, "mode:", evaluation.mode, "credits:", evaluation.credits_charged);

    const result = await vraelis.evaluations.get(evaluation.id);
    const dp = result.decision_package;
    console.log("recommended:", dp?.decision.recommended_output);
    console.log("confidence:", dp?.decision.directional_confidence, "| health:", dp?.decision.evaluation_health);

    const full = await vraelis.evaluations.exportJson(evaluation.id, { tier: "scale" });
    console.log("export mode:", full.decision_package?.mode);

    const csv = await vraelis.evaluations.exportCsv(evaluation.id);
    console.log("csv header:", csv.split("\n")[0]);
  } catch (err) {
    if (err instanceof VraelisAPIError) {
      console.error(`Vraelis error ${err.status} ${err.code}: ${err.message}`, err.requestId ?? "");
    } else {
      throw err;
    }
  }
}

main();

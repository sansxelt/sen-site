import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
const content: DirectionContent = {
  "eyebrow": "Scope and limitations",
  "title": "A clear boundary for every claim.",
  "intro": "Vraelis is in private development. Its implemented foundations have specific limits and do not establish universal AI security or physical safety.",
  "photo": "hardwareInspection",
  "heading": "Know what the foundation establishes.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Policy core",
      "title": "Supplied context needs a trusted source",
      "body": "The core checks policy conditions. It does not authenticate identity, verify signatures or operate an enforcement gateway."
    },
    {
      "label": "Recorded evidence",
      "title": "Reports establish reported states",
      "body": "The evaluator depends on supplied capture and clock declarations. Device reports are not independent measurements of physical behavior."
    },
    {
      "label": "Research",
      "title": "Threat coverage is system-specific",
      "body": "Native sensor testing, continuous monitoring and artifact verification need integrations and evaluation. No government authorization or certification is claimed."
    }
  ],
  "nextTitle": "Connect the foundation to a complete workflow.",
  "nextLead": "The next work is an authenticated, controlled test integration with a decision and outcome that reviewers can inspect.",
  "next": [
    {
      "label": "Context",
      "title": "Identify the workload and resource",
      "body": "Document the identity source, model version, allowed operations and environment."
    },
    {
      "label": "Control",
      "title": "Test the security boundary",
      "body": "Verify that authorized actions succeed and changed or unauthorized proposals are denied before dispatch."
    },
    {
      "label": "Evidence",
      "title": "Review the decision and outcome",
      "body": "Retain the exact policy and action bindings alongside the observations available to the reviewer."
    }
  ],
  "showStatus": true
};
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/limitations" });
export default function Page() { return <DirectionPage content={content} />; }

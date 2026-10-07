import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
const content: DirectionContent = {
  "eyebrow": "Research",
  "title": "Research guides the security controls.",
  "intro": "We are investigating AI-specific threats across defense, infrastructure and physical systems. Research topics are not claims of deployed protection.",
  "photo": "hardwareInspection",
  "heading": "Match the threat to a measurable test.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Adversarial inputs",
      "title": "Study the path to an action",
      "body": "Prompt injection and adversarial perception inputs require different test cases and controls. Constrain authority separately from detection."
    },
    {
      "label": "Supply chain",
      "title": "Establish artifact provenance",
      "body": "Study poisoned data, compromised dependencies and unauthorized model changes. Evaluate what the source evidence can authenticate."
    },
    {
      "label": "Behavior",
      "title": "Investigate changes over time",
      "body": "Performance drift can have operational causes. Use qualified baselines before attributing an anomaly to an attack."
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
  ]
};
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/research" });
export default function Page() { return <DirectionPage content={content} />; }

import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
const content: DirectionContent = {
  "eyebrow": "AI workloads",
  "title": "A model cannot grant itself authority.",
  "intro": "We are developing independent policy checks around AI tool use and proposed actions, including the boundaries relevant to physical systems.",
  "photo": "electronicsBench",
  "heading": "Separate proposing from authorizing.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Input",
      "title": "Treat generated content as untrusted",
      "body": "A prompt, retrieved document or model explanation cannot add permissions to a structured request."
    },
    {
      "label": "Scope",
      "title": "Constrain the tool boundary",
      "body": "Bind an operation to the authenticated workload, target resource and environment. The integration owns the mapping to the actual operation."
    },
    {
      "label": "Review",
      "title": "Keep approval independent",
      "body": "Consequential actions need separate human approval. Model confidence is not authorization or proof of a safe outcome."
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
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/agents" });
export default function Page() { return <DirectionPage content={content} />; }

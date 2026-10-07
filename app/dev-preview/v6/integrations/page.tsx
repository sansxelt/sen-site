import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
const content: DirectionContent = {
  "eyebrow": "Integration design",
  "title": "Connect the control to the system.",
  "intro": "Integration work for AI-enabled systems: trusted identity, verified model artifacts, controlled action interfaces and evidence collection.",
  "photo": "networkEngineer",
  "heading": "Trust boundaries belong to the integration.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Identity",
      "title": "Establish trusted context",
      "body": "Connect an identity provider and revocation source. A workload cannot supply its own trusted identity in a request body."
    },
    {
      "label": "Artifacts",
      "title": "Verify the model being used",
      "body": "Connect model and software provenance to a reviewed version. A digest supplied by the caller is not proof of origin."
    },
    {
      "label": "Actions",
      "title": "Control the dispatch boundary",
      "body": "Bind approval to the exact action and current policy. Prevent reuse and access through an unprotected route."
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
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/integrations" });
export default function Page() { return <DirectionPage content={content} />; }

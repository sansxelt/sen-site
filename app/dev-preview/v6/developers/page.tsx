import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
const content: DirectionContent = {
  "eyebrow": "Developer references",
  "title": "Build around an explicit boundary.",
  "intro": "Our implementation references support private development. The public console, product APIs and hosted verification services are closed.",
  "photo": "firmware",
  "heading": "Start with the security contract.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Policy",
      "title": "Review the exact grant",
      "body": "Specify the principal, session, environment, resource, operation and model version. Deny missing or ambiguous grants."
    },
    {
      "label": "Integration",
      "title": "Establish trusted adapter inputs",
      "body": "Derive identity and artifact evidence from a trusted verifier. Never accept trusted context directly from an AI proposal."
    },
    {
      "label": "Documentation",
      "title": "Use implementation references",
      "body": "The documentation retains recording formats and earlier browser-workflow references. Those references do not offer a running service."
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
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/developers" });
export default function Page() { return <DirectionPage content={content} />; }

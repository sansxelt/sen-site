import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
const content: DirectionContent = {
  "eyebrow": "Company",
  "title": "Building security for AI-enabled systems.",
  "intro": "Vraelis is being developed for cybersecurity of AI-enabled defense, infrastructure and physical systems. Our focus is explicit authority, integrity and evidence.",
  "photo": "satelliteStation",
  "heading": "Build on a clear purpose.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Security",
      "title": "Put controls at the boundary",
      "body": "Check what a workload may access and change, then connect the policy decision to an independently controlled execution path."
    },
    {
      "label": "Engineering",
      "title": "Make the result inspectable",
      "body": "Preserve the policy basis, model and action bindings, and observed outcome so a reviewer can investigate the result."
    },
    {
      "label": "Company",
      "title": "Earn adoption through working capability",
      "body": "Pursue industry and government work through demonstrated controls and the requirements of each environment."
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
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/company" });
export default function Page() { return <DirectionPage content={content} />; }

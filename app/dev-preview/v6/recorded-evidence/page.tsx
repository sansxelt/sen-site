import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
const content: DirectionContent = {
  "eyebrow": "Recorded evidence",
  "title": "Evidence for security investigation.",
  "intro": "Recorded behavior supports investigation alongside access controls and policy decisions. Our private evaluator compares supported task reports against reviewed criteria.",
  "photo": "robotDetail",
  "heading": "Follow the finding to its source.",
  "lead": "The product is being developed privately. Integration requirements must be established for the system being secured.",
  "items": [
    {
      "label": "Identity",
      "title": "Review the same task and asset",
      "body": "The evaluator checks task and asset identifiers, the completion window and assets that should remain unchanged."
    },
    {
      "label": "Sources",
      "title": "Expose conflicting reports",
      "body": "Compare supplied control, service and device states. Missing capture can make the outcome inconclusive."
    },
    {
      "label": "Comparison",
      "title": "Inspect a changed build",
      "body": "Compare recordings using the same reviewed criteria. Current local recordings and comparison baselines are cleared when the tab closes."
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
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/recorded-evidence" });
export default function Page() { return <DirectionPage content={content} />; }

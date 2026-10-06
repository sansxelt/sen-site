import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
export const metadata = v6meta({"title": "System integrators", "description": "Review task reports across the software and equipment you bring together. Find where supplier reports disagree before the integration reaches release.", "path": "/integrators", "type": "website"});
const content: DirectionContent = {
  "eyebrow": "System integrators",
  "title": "System integrators.",
  "intro": "Review task reports across the software and equipment you bring together. Find where supplier reports disagree before the integration reaches release.",
  "photo": "networkEngineer",
  "heading": "The task crosses more than one system.",
  "lead": "Keep source identity, asset identity and timestamps attached to the evidence.",
  "items": [
    {
      "label": "Identity",
      "title": "Find the intended asset",
      "body": "Compare reports for the requested task and asset. A successful service response does not establish that the intended robot completed the work."
    },
    {
      "label": "Timing",
      "title": "Expose missing completion",
      "body": "Review the available recording window and the task deadline. Missing evidence should remain visible instead of becoming a pass."
    },
    {
      "label": "Change",
      "title": "Catch unintended effects",
      "body": "Check whether an asset required to remain unchanged appears to have received or executed the task."
    }
  ],
  "nextTitle": "Make the first integration repeatable.",
  "nextLead": "Hardware-agnostic support is a development goal. Today, compatibility depends on the documented report schema.",
  "next": [
    {
      "label": "Today",
      "title": "Map supported reports",
      "body": "Use the documented JSON schema or supported MCAP messages. Preserve raw source events and coverage information during preparation."
    },
    {
      "label": "Pilot",
      "title": "Choose one supplier workflow",
      "body": "Use a bounded test recording with a known expected outcome. Compare the findings with the engineers who know the system."
    },
    {
      "label": "Next",
      "title": "Expand adapters with evidence",
      "body": "Prioritize additional formats from actual integration needs. Native SDK execution, live hardware access and continuous monitoring are future work."
    }
  ]
};
export default function Page(){ return <DirectionPage content={content}/>; }

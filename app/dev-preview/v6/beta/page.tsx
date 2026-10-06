import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
export const metadata = v6meta({"title": "The beta", "description": "Start with supported task recordings. Compare control-panel, service and device reports, inspect the source events, and see where the supplied evidence falls short.", "path": "/beta", "type": "website"});
const content: DirectionContent = {
  "eyebrow": "The beta",
  "title": "The beta.",
  "intro": "Start with supported task recordings. Compare control-panel, service and device reports, inspect the source events, and see where the supplied evidence falls short.",
  "photo": "robotDetail",
  "heading": "What you can work with today.",
  "lead": "The recording beta is a local report-review workflow. The website\u2019s mission-console example is a separate simulation, not an operational defense system.",
  "items": [
    {
      "label": "Input",
      "title": "Supported JSON and MCAP",
      "body": "Import recordings that match the documented formats. Files remain in your browser; the recording workflow does not upload them to a cloud evidence store."
    },
    {
      "label": "Review",
      "title": "Task and asset comparisons",
      "body": "Look for conflicting state, missing completion and unexpected changes to assets required to stay unchanged. Findings refer back to supplied events."
    },
    {
      "label": "Example",
      "title": "An explicitly simulated case",
      "body": "Explore the homepage mission-console example or the simulated robot reports. These examples demonstrate software behavior and are not customer deployment evidence."
    }
  ],
  "nextTitle": "Help shape the next release.",
  "nextLead": "Bring a concrete failure, a representative recording and the evidence an engineer would need to decide what happened.",
  "next": [
    {
      "label": "Feedback",
      "title": "Start with a reproducible problem",
      "body": "Share the format and behavior you need supported. Use synthetic or permitted test material and describe the expected outcome."
    },
    {
      "label": "Evaluation",
      "title": "Measure useful findings",
      "body": "Compare the result against engineer-reviewed failures. Track missed cases, false positives and incomplete evidence before broadening the scope."
    },
    {
      "label": "Boundary",
      "title": "Keep unfinished work visible",
      "body": "Live device connections, physical ground truth, automatic hardware repair and certified safety judgments are not current beta capabilities."
    }
  ]
};
export default function Page(){ return <DirectionPage content={content}/>; }

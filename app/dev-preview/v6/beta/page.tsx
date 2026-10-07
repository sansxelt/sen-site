import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
export const metadata = v6meta({"title": "Private beta", "description": "The Vraelis app and console are closed while the private beta is in development. Discuss a future recording-review pilot with the team.", "path": "/beta", "type": "website"});
const content: DirectionContent = {
  "eyebrow": "The beta",
  "title": "Private beta. In development.",
  "intro": "App and console access is closed for now. We\u2019re building a private workflow to review task recordings against requirements and inspect findings. Talk to the team about a future pilot.",
  "photo": "robotDetail",
  "heading": "What we\u2019re building.",
  "lead": "The first private beta will focus on reviewing supported recordings against approved requirements and inspecting the evidence behind findings. Access is not open. The website\u2019s mission-console example remains a separate simulation.",
  "items": [
    {
      "label": "Input",
      "title": "Supported JSON and MCAP",
      "body": "The current internal evaluator supports documented JSON and MCAP task reports. The private beta will start with recordings that match those formats."
    },
    {
      "label": "Review",
      "title": "Task and asset comparisons",
      "body": "Review conflicting state, missing completion and unexpected changes to assets required to stay unchanged. Findings should refer back to the supplied events."
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

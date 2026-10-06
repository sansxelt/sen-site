import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
export const metadata = v6meta({"title": "Our goals", "description": "Build external software review for defense, infrastructure and robotics. Our ambition is to earn U.S. government contracts and help teams find failures before release.", "path": "/goals", "type": "website"});
const content: DirectionContent = {
  "eyebrow": "Our goals",
  "title": "Our goals.",
  "intro": "Build external software review for defense, infrastructure and robotics. Our ambition is to earn U.S. government contracts and help teams find failures before release.",
  "photo": "satelliteStation",
  "heading": "Build around a real engineering problem.",
  "lead": "Start with a task that can be traced across systems. Earn trust with findings that engineers can reproduce and inspect.",
  "items": [
    {
      "label": "01 / Product",
      "title": "Follow software into physical systems",
      "body": "Connect the intended task to reports from the software and the asset it controls. Give reviewers the source evidence rather than another success indicator."
    },
    {
      "label": "02 / Customers",
      "title": "Earn government work",
      "body": "Pursue paid evaluations and U.S. government contracts through a documented procurement process. These are company goals, not claims of awarded contracts."
    },
    {
      "label": "03 / Expansion",
      "title": "Work across suppliers",
      "body": "Develop reusable report adapters and repeatable reviews so teams can compare systems from different vendors without rebuilding the process each time."
    }
  ],
  "nextTitle": "Prove the next step before expanding.",
  "nextLead": "Each stage needs a working product, customer evidence and a clear decision to continue.",
  "next": [
    {
      "label": "Near term",
      "title": "Finish the recording workflow",
      "body": "Improve supported formats, evidence navigation and repeat reviews of changed software. Measure useful findings against known failures and engineer review."
    },
    {
      "label": "Customer work",
      "title": "Run a bounded pilot",
      "body": "Agree on one task, the available recordings, data restrictions and success criteria with an engineering team. Document false positives and missing evidence."
    },
    {
      "label": "Future work",
      "title": "Establish deployment requirements",
      "body": "Evaluate private and disconnected environments with prospective customers. Classified handling, live device connections and safety certification are not current capabilities."
    }
  ]
};
export default function Page(){ return <DirectionPage content={content}/>; }

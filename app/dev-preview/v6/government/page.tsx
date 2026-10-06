import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
export const metadata = v6meta({"title": "Government & institutions", "description": "External software review for engineering teams working on mission systems, public infrastructure and robotics. Start with unclassified test recordings and a defined problem.", "path": "/government", "type": "website"});
const content: DirectionContent = {
  "eyebrow": "Government & institutions",
  "title": "Government & institutions.",
  "intro": "External software review for engineering teams working on mission systems, public infrastructure and robotics. Start with unclassified test recordings and a defined problem.",
  "photo": "windFarm",
  recordingExample: { assetId:"Test asset A", taskId:"test-104", completionWithinMs:10000, untouchedAssetIds:["Test asset B"] },
  "heading": "Make the record useful to the people responsible.",
  "lead": "A console result is only one source. Review the task, the intended asset and the state each supplied report describes.",
  "items": [
    {
      "label": "Engineering",
      "title": "Test before release",
      "body": "Investigate whether the intended task completed, whether another asset changed, and whether required evidence is missing."
    },
    {
      "label": "Programs",
      "title": "Keep a reviewable record",
      "body": "Use source events to explain a finding to engineers and program reviewers. Define what the recording can establish before using the result."
    },
    {
      "label": "Acquisition",
      "title": "Define a practical evaluation",
      "body": "Bring the use case, available formats, deployment constraints and evaluation criteria. The team can assess fit before a proposed pilot."
    }
  ],
  "nextTitle": "The deployment conversation comes first.",
  "nextLead": "Government procurement and operational use have requirements beyond a product demonstration.",
  "next": [
    {
      "label": "Data",
      "title": "Agree what can be shared",
      "body": "Begin with synthetic or unclassified test material. Discuss ownership, retention and access before sharing sensitive operational information."
    },
    {
      "label": "Environment",
      "title": "Document the required environment",
      "body": "Identify connectivity, hosting and identity requirements. Private, air-gapped and classified deployments require separate evaluation and are not offered by the current recording beta."
    },
    {
      "label": "Company ambition",
      "title": "Earn the right to deploy",
      "body": "Vraelis aims to win government contracts. This website does not claim an existing government award, authorization or certification."
    }
  ]
};
export default function Page(){ return <DirectionPage content={content}/>; }

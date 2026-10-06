import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
export const metadata = v6meta({"title": "The problems", "description": "Software can report success while the surrounding system tells a different story. Vraelis focuses on the evidence engineers need to investigate that gap.", "path": "/problems", "type": "website"});
const content: DirectionContent = {
  "references": [
    {"title":"Palantir Ontology","body":"Palantir describes Ontology as connecting integrated data and models to real-world counterparts, including physical assets, with objects, links and actions. This is substantial overlap with any broad operational-data platform claim.","href":"https://www.palantir.com/platforms/ontology/"},
    {"title":"Applied Intuition","body":"Applied Intuition offers physical-AI simulation, verification and validation products. Testing software for physical systems is an established market; our narrower recording workflow needs to demonstrate its own value.","href":"https://www.appliedintuition.com/products/simian"},
    {"title":"Scale AI","body":"Scale markets computer-vision and agentic AI programs for the U.S. public sector. Its site presents named use cases and clear customer audiences—a useful standard for how directly we should explain the work.","href":"https://scale.com/public-sector"}
  ],
  "eyebrow": "The problems",
  "title": "The problems.",
  "intro": "Software can report success while the surrounding system tells a different story. Vraelis focuses on the evidence engineers need to investigate that gap.",
  "photo": "hardwareInspection",
  "heading": "A success message is not the whole result.",
  "lead": "Traceability, fragmented data and human review are recurring engineering concerns. Start with a specific task and the evidence each source supplies.",
  "items": [
    {
      "label": "Conflicting state",
      "title": "Different sources disagree",
      "body": "The control panel reports completion while the service reports acceptance and the device has no completion event. Review the disagreement for the same task."
    },
    {
      "label": "Wrong asset",
      "title": "A task affects something else",
      "body": "The intended asset changes, but another asset that should remain untouched changes too. Checking only the requested asset can miss the error."
    },
    {
      "label": "Missing evidence",
      "title": "Silence gets mistaken for success",
      "body": "An absent device report cannot establish completion. Show the missing source, the available recording window and the resulting uncertainty."
    }
  ],
  "nextTitle": "Broader risks need separate work.",
  "nextLead": "The research direction includes model drift, adversarial inputs and operator overreliance. The current product does not solve all AI safety or defense software risks.",
  "next": [
    {
      "label": "Research",
      "title": "Test the surrounding workflow",
      "body": "Study how model-generated tasks become software actions and recorded outcomes. A deterministic report comparison cannot prove an unrestricted model\u2019s behavior."
    },
    {
      "label": "Research",
      "title": "Help reviewers challenge a result",
      "body": "Make contradictory reports and evidence gaps easy to inspect. Evaluate reviewer decisions and false positives instead of claiming that a dashboard eliminates automation bias."
    },
    {
      "label": "Scope",
      "title": "Work alongside existing platforms",
      "body": "Data platforms, autonomy systems and testing tools already address parts of this space. The opportunity is a focused cross-source review workflow, subject to customer validation."
    }
  ]
};
export default function Page(){ return <DirectionPage content={content}/>; }

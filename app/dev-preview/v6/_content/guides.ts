import { SECURITY_PAGES } from "./security-direction";
import type { PhotographKey } from "./photography";

type Guide = {
  slug: string; title: string; intro: string; photo: PhotographKey;
  sections: { title: string; paragraphs: string[] }[];
  references?: { title: string; href: string }[];
};

// Reading guides combine current public engineering guidance, not product demonstrations.
const contour = SECURITY_PAGES.contour;
const trust = SECURITY_PAGES["zero-trust"];
export const GUIDES: Guide[] = [
  {
    slug: "model-release-security", title: contour.heading, intro: contour.lead,
    photo: "hardwareInspection",
    sections: [
      ...contour.items.map(item => ({ title: item.title, paragraphs: [item.body] })),
      { title: trust.story!.title, paragraphs: [trust.story!.paragraphs[0]] },
      { title: contour.story!.title, paragraphs: [...contour.story!.paragraphs, contour.nextLead] },
    ],
  },
  {
    slug: "operating-constraints", title: "Different systems. Different security boundaries.",
    intro: "The control has to fit the environment, not just the model.", photo: "windFarm",
    sections: [
      { title: "Disconnected operation", paragraphs: ["Mission systems can lose connectivity. Identity, release approvals and evidence need a defined behavior when central services are unavailable.", "Define outages, revocation, safe operating boundaries and independent controllers with the system owner."] },
      { title: "Established operational controls", paragraphs: ["AI is introduced alongside existing equipment, permissions and change-management processes. Security needs to respect those boundaries.", trust.story!.paragraphs[0]] },
      { title: "Limited edge resources", paragraphs: ["Model updates and security checks must fit the robot's compute budget, timing requirements and recovery process.", SECURITY_PAGES.platform.story!.paragraphs[1]] },
    ],
    references: [{ title: "Secure AI integration in operational technology", href: "https://www.cyber.gov.au/publication/principles-for-the-secure-integration-of-artificial-intelligence-in-operational-technology" }],
  },
  {
    slug: "ai-security-evaluation", title: "Measure the boundary, not a broad security score.",
    intro: "Match the threat to a measurable test.", photo: "electronicsBench",
    sections: [
      { title: "Test against a defined threat", paragraphs: ["A useful evaluation separates model tampering, data poisoning, manipulated inputs and unauthorized actions. Define attacker access, normal operating conditions and the evidence needed to reproduce each result.", "Prompt injection and adversarial perception inputs require different test cases and controls. Constrain authority separately from detection."] },
      { title: "Measure the engineering tradeoffs", paragraphs: ["Measure missed attacks, false alarms, latency, compute use and investigation effort. An attack test result applies to its tested conditions, not every model or physical environment."] },
      { title: "Distinguish change from compromise", paragraphs: ["Performance drift can have operational causes. Use qualified baselines before attributing an anomaly to an attack.", "These are development and research areas. The private policy core does not claim universal attack detection."] },
    ],
    references: [{ title: "NIST adversarial machine learning taxonomy", href: "https://www.nist.gov/publications/adversarial-machine-learning-taxonomy-and-terminology-attacks-and-mitigations-0" }],
  },
];

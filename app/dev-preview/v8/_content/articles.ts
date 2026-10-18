// Vraelis News, newest first (founder, 2026-10-18: "news should be its own with its own fresh articles", built out as
// a full newsroom). Facts come only from what Vraelis already publishes (site.ts STATUS, STATUS_SOURCES, TERMS,
// OBSERVATIONS, CONTOUR and the captured app); the new material is analysis and explanation, never a new count,
// capability, customer or deployment. Each story has its own picture from the licensed library or a real Contour
// capture, none shown anywhere else on the site (founder, 2026-10-18: diversify the images, do not create them).
import { EDITORIAL_PHOTOGRAPHS } from "../../v6/_content/editorial-photography";

export type ArticleKind = "Product" | "Research" | "Perspective" | "Company";
export const ARTICLE_KINDS: ArticleKind[] = ["Product", "Research", "Perspective", "Company"];

export type Article = {
  slug: string;
  date: string; // ISO day
  kind: ArticleKind;
  title: string;
  dek: string;
  cover: Cover;
  /** Three short lines a reader can stop after. */
  inShort: string[];
  sections: { heading?: string; paras: string[] }[];
  /** What the article does not claim, shown as its own box. */
  notClaimed?: string[];
  links?: { label: string; to: string }[];
};

export type Cover = { src: string; srcSet?: string; alt: string; w: number; h: number; capture?: boolean };
/** A licensed library photograph (credited on Image sources). */
const pic = (key: keyof typeof EDITORIAL_PHOTOGRAPHS): Cover => {
  const p = EDITORIAL_PHOTOGRAPHS[key];
  return { src: `/site/photography/${p.file}.jpg`, alt: p.alt, w: p.w, h: p.h };
};
/** A real capture of the read-only Contour app (1200 version). */
const shot = (name: "app-traces"): Cover => ({ src: `/v8/contour/${name}-1200.webp`, srcSet: `/v8/contour/${name}-1200.webp 1200w, /v8/contour/${name}.webp 2400w`, alt: "The traces screen of the Vraelis Contour app.", w: 1200, h: 750, capture: true });

export const ARTICLES: Article[] = [
  {
    slug: "kubernetes-collector-prototype",
    date: "2026-10-18",
    kind: "Product",
    title: "Vraelis Contour status: a private Kubernetes collector prototype",
    dek: "What changed on the status page this week, what has been checked, and what has not.",
    cover: pic("dataCenterAisle"),
    inShort: [
      "The Kubernetes collector described in specification v1.3 now exists as a private prototype.",
      "Its host checks have run. Live-cluster validation of the current revision has not.",
      "The engineering record stays private, and no new test counts are published.",
    ],
    sections: [
      { heading: "What changed", paras: [
        "Until this week, the Planned next list on the Vraelis Contour status page read: a Kubernetes collector, proposed in specification v1.3. It now reads: private collector prototype, host-checked. It stays under Planned next.",
        "The source for that line is a private engineering record dated October 17, 2026. The status page cites it by date and says plainly that it is not public.",
      ] },
      { heading: "Why a collector", paras: [
        "In the reference experiment, one worker reports which release it loaded, and Contour compares that report with the approved release. Kubernetes is where many teams run inference services, so the specification describes a collector for it.",
      ] },
      { heading: "What host-checked means", paras: [
        "The prototype's checks ran on a host. The current revision has not been validated on a live cluster. Until it is, we do not describe the collector as working in a cluster, and the status page keeps that validation marked as pending.",
      ] },
      { heading: "What stays the same", paras: [
        "Vraelis Contour is in private development. Its reference path is still the synthetic ONNX CPU experiment, and runtime reports are worker self-reports.",
      ] },
    ],
    notClaimed: ["Live-cluster validation of the current revision", "Customer clusters or deployments", "Hardware attestation", "New test counts"],
    links: [{ label: "Development status", to: "/contour/status" }],
  },
  {
    slug: "five-ways-a-model-update-goes-wrong",
    date: "2026-10-18",
    kind: "Perspective",
    title: "Five ways a model update goes wrong after approval",
    dek: "Approval is a decision about a release. Each of these failures happens after it.",
    cover: pic("circuitLayers"),
    inShort: [
      "An approval names one release for one destination. It says nothing about what happens next.",
      "Five things can go wrong between approval and runtime, and each needs its own evidence.",
      "Contour covers parts of this inside a controlled experiment; the rest is specified or planned.",
    ],
    sections: [
      { heading: "1. The update never loads", paras: [
        "The runtime keeps serving the previous release. Nothing failed; the new one simply is not running yet. In Contour's recorded run this is exactly what happened: cpu-2 was approved while cpu-1 stayed loaded until an explicit reload.",
        "The evidence that catches it is a comparison of what the runtime reports loaded with what was approved.",
      ] },
      { heading: "2. Different bytes arrive", paras: [
        "The model file at the destination is not the file that was approved. It could be a different build, a swapped artifact or a damaged copy. Checking the bytes against the approved digest before a session loads them is artifact integrity, and the experiment does it.",
      ] },
      { heading: "3. Same model, different configuration", paras: [
        "The model is right but the configuration around it changed. Because configuration shapes behavior too, the experiment makes the configuration digest part of the release and compares it on every report.",
      ] },
      { heading: "4. The right release in the wrong place", paras: [
        "An approval meant for one environment is used in another. Destination-bound approval names the environment and resource an approval applies to. Scripted fault tests for wrong destinations and changed components are specified but have not been run.",
      ] },
      { heading: "5. Nobody is reporting", paras: [
        "The runtime stops reporting at all. The tempting answer is to show the last known state as if it were current. The honest answer is to record that evidence is unavailable, which is what the recorded run does in its fourth observation.",
      ] },
    ],
    notClaimed: ["Protection against every failure listed here", "Results from the specified fault tests, which have not run", "Use outside the controlled experiment"],
    links: [{ label: "How Vraelis Contour works", to: "/contour" }],
  },
  {
    slug: "a-self-report-is-evidence-not-proof",
    date: "2026-10-18",
    kind: "Research",
    title: "A self-report is evidence, not proof",
    dek: "What a runtime's own report can establish about a model release, and where it stops.",
    cover: pic("instrumentControls"),
    inShort: [
      "A self-report is the runtime saying which release it loaded and under which policy.",
      "It is good at exposing mismatches and keeping a history. It cannot prove its own honesty.",
      "Contour labels every report it shows as a worker self-report.",
    ],
    sections: [
      { heading: "What a self-report is", paras: [
        "Runtime identity, in Contour's vocabulary, is the runtime reporting which release it loaded, under which runtime policy. The report comes from the worker itself, which is why every screen that shows one says worker self-report.",
      ] },
      { heading: "What it can show", paras: [
        "When the report names a different release from the approved one, that difference is worth acting on, whatever else is uncertain. A sequence of reports also gives a history: when the update was approved, when the runtime caught up, and when it went quiet.",
      ] },
      { heading: "What it cannot show", paras: [
        "A report cannot vouch for itself. A faulty or compromised runtime could report anything. Binding a report to the measured state of the machine is the job of hardware attestation, which Contour does not claim.",
      ] },
      { heading: "When it was true", paras: [
        "A report describes a moment. Without a way to show that a report is current rather than stale, an old report can look like a new one. Heartbeat freshness for runtime reports is on Contour's Planned next list.",
      ] },
    ],
    notClaimed: ["Hardware attestation", "Heartbeat freshness, which is planned, not built", "Detection of a runtime that reports falsely"],
    links: [{ label: "The terms Contour uses", to: "/contour" }, { label: "Development status", to: "/contour/status" }],
  },
  {
    slug: "evidence-unavailable-is-a-result",
    date: "2026-10-18",
    kind: "Perspective",
    title: "Evidence unavailable is a result",
    dek: "Why a security record should keep the observations that confirm nothing.",
    cover: pic("serverAisle"),
    inShort: [
      "When a runtime stops reporting, showing its last known state as current is a guess.",
      "Contour records the gap instead, with a reason code.",
      "Missing evidence does not mean a different release is running. It means nothing is reporting.",
    ],
    sections: [
      { heading: "The easy mistake", paras: [
        "Dashboards like to show a status for everything. When a source goes quiet, the simplest thing is to keep showing the last value it sent. For a model release, that turns an old report into a claim about now.",
      ] },
      { heading: "What the recorded run does instead", paras: [
        "In the fourth recorded observation, the worker had stopped. cpu-2 was still approved, and nothing reported what was loaded. The record says evidence unavailable, with the reason code RUNTIME_UNAVAILABLE, rather than repeating the last report.",
      ] },
      { heading: "Why a reviewer wants the gap", paras: [
        "A reviewer reading the record later can see exactly when certainty ended. That is more useful than a clean timeline that hides it, and it keeps the record honest about its own limits.",
      ] },
      { heading: "Missing is not different", paras: [
        "The app says it directly: missing evidence does not show that a different release is running. It shows that nothing is reporting. The two call for different responses, so the record keeps them apart.",
      ] },
    ],
    notClaimed: ["Automatic recovery when reports stop", "Freshness detection, which is planned"],
    links: [{ label: "See the recorded observations", to: "/contour" }],
  },
  {
    slug: "release-integrity-in-the-field",
    date: "2026-10-18",
    kind: "Research",
    title: "Release integrity for machines in the field",
    dek: "Robots and vehicles receive model updates far from the people who approved them. What evidence would help.",
    cover: pic("robotGripper"),
    inShort: [
      "Machines in the field get updates from suppliers and are run by operators.",
      "The useful questions are the same as anywhere: which release was approved, and what is the machine running.",
      "Contour's work here is research, illustrated by a synthetic CPU run, not a robot integration.",
    ],
    sections: [
      { heading: "Who is involved", paras: [
        "A supplier builds and approves a model release. An operator runs the machines that receive it. When something goes wrong, both need to agree on which release was meant to run and which one did.",
      ] },
      { heading: "What changes in the field", paras: [
        "Machines are not always connected, and an update can sit approved for a while before a machine picks it up. That makes the gap between approved and loaded, and the gap in reports, ordinary rather than rare.",
      ] },
      { heading: "What evidence would help", paras: [
        "A record per machine of the approved release, the reported loaded release and the time of each report, kept even when a machine goes quiet. That is the same comparison Contour makes in its experiment, applied where reports are less regular.",
      ] },
      { heading: "Where Vraelis is", paras: [
        "The autonomous systems application page shows a release-review scenario for machines in the field, illustrated by a synthetic ONNX CPU run. It is not a robot integration and not evidence of physical safety.",
      ] },
    ],
    notClaimed: ["Robot or vehicle integration", "Evidence of physical safety", "Customer deployments"],
    links: [{ label: "Autonomous systems", to: "/applications/autonomous-systems" }],
  },
  {
    slug: "evidence-app",
    date: "2026-10-10",
    kind: "Product",
    title: "A read-only evidence app for Vraelis Contour",
    dek: "Six screens over the recorded trace, with every finding from internal automated review addressed.",
    cover: shot("app-traces"),
    inShort: [
      "Six screens: Overview, Releases, Destination, Observations, Policy and Traces.",
      "Read-only, with no deploy, approval, reload or fleet controls.",
      "Internal automated review reported five findings; each is addressed.",
    ],
    sections: [
      { paras: [
        "The Vraelis Contour evidence app reads the recorded trace and shows it in six screens. The Destination screen puts the approved release beside the reported loaded release, field by field. Observations keeps every record in order, including the ones that confirm nothing.",
      ] },
    ],
    links: [{ label: "See the app", to: "/contour" }],
  },
  {
    slug: "vraelis-contour",
    date: "2026-10-08",
    kind: "Product",
    title: "Vraelis Contour, our first product direction",
    dek: "Model release security, from approval to reported runtime state.",
    cover: pic("engineeringTeam"),
    inShort: [
      "For release, platform and security engineers at suppliers and system integrators.",
      "It compares the approved model release with what the receiving runtime reports running.",
      "In private development, on a synthetic ONNX CPU experiment.",
    ],
    sections: [
      { paras: [
        "An approved update is not proof it loaded. Contour compares the approved model release with what the receiving runtime reports running, and records differences or unavailable evidence.",
      ] },
    ],
    links: [{ label: "About Vraelis Contour", to: "/contour" }],
  },
  {
    slug: "ai-security",
    date: "2026-10-07",
    kind: "Company",
    title: "Vraelis focuses on AI security",
    dek: "Cybersecurity software for AI in defense, critical infrastructure and autonomous systems.",
    cover: pic("gridEquipment"),
    inShort: [
      "Vraelis develops cybersecurity software for AI in defense, critical infrastructure and autonomous systems.",
      "Four research areas: model integrity, adversarial threats, machine trust and security evidence.",
    ],
    sections: [
      { paras: [
        "Model integrity asks whether the model that runs is the model that was approved. Adversarial threats covers inputs, updates and supply paths built to change what a model does. Machine trust is explicit identity, limited permissions and checks at execution boundaries. Security evidence is records a person can read, kept in order, including what could not be confirmed.",
      ] },
    ],
    links: [{ label: "Our research", to: "/research" }],
  },
];

export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
/** Minutes to read at about 220 words a minute, at least one. */
export const readingMinutes = (a: Article) => {
  const words = [a.dek, ...a.inShort, ...a.sections.flatMap((s) => [s.heading ?? "", ...s.paras]), ...(a.notClaimed ?? [])].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
};

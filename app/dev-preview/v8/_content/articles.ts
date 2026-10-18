// Vraelis News: articles, newest first (founder, 2026-10-18: "news should be its own with its own fresh articles").
// Every statement restates a fact the site already publishes (site.ts FACTS, STATUS, CONTOUR, OBSERVATIONS,
// APPLICATIONS, RESEARCH and the evidence app review). No new counts, capabilities, customers or deployments.
// /changelog stays the dated record of site and product changes; these are written for readers.
import { EDITORIAL_PHOTOGRAPHS } from "../../v6/_content/editorial-photography";
import { CAPTURES, captureSrc, type CaptureName } from "../_kit/blocks";

export type ArticleImage = { src: string; alt: string; w: number; h: number; photo: boolean };
export type Article = {
  slug: string;
  date: string; // ISO day
  kind: "Company" | "Product" | "Research";
  title: string;
  dek: string;
  image: ArticleImage;
  body: string[];
  links?: { label: string; to: string }[];
};

const photo = (key: keyof typeof EDITORIAL_PHOTOGRAPHS): ArticleImage => {
  const p = EDITORIAL_PHOTOGRAPHS[key];
  return { src: `/site/photography/${p.file}.jpg`, alt: p.alt, w: p.w, h: p.h, photo: true };
};
const capture = (name: CaptureName): ArticleImage => ({ src: captureSrc(name), alt: CAPTURES[name].alt, w: CAPTURES[name].w, h: CAPTURES[name].h, photo: false });

export const ARTICLES: Article[] = [
  {
    slug: "approved-is-not-loaded",
    date: "2026-10-18",
    kind: "Research",
    title: "An approved update is not proof it loaded",
    dek: "Four recorded observations from the Vraelis Contour experiment, and what each one can and cannot show.",
    image: capture("app-destination-pending"),
    body: [
      "When a supplier approves a new model release, the approval says what should run. It does not say what the receiving system is running. Vraelis Contour compares the two: the approved release, and the release the runtime reports it loaded.",
      "In the reference experiment, a synthetic ONNX model runs on CPU under ONNX Runtime 1.23.2. The run below was recorded on October 10, 2026, and each observation is kept as it happened.",
      "Observation 01, at 07:41:29.606 UTC: cpu-1 is approved and reported loaded. Every identity field matches.",
      "Observation 02, at 07:41:29.613 UTC: cpu-2 is approved while cpu-1 stays loaded. In baseline mode the runtime keeps serving what it loaded until an explicit reload, so the comparison shows reload pending.",
      "Observation 03, at 07:41:29.619 UTC: after the explicit reload, the runtime reports cpu-2 and every field matches.",
      "Observation 04, at 07:41:29.723 UTC: the worker stopped. cpu-2 stays approved, and nothing reports what is loaded. The record says evidence unavailable, with the reason code RUNTIME_UNAVAILABLE, rather than guessing.",
      "These are worker self-reports from a controlled experiment. They are not hardware attestation and not a customer deployment. Vraelis Contour is in private development.",
    ],
    links: [{ label: "See the recorded observations", to: "/contour" }, { label: "Where Contour stands", to: "/contour/status" }],
  },
  {
    slug: "where-model-updates-cross-organizations",
    date: "2026-10-18",
    kind: "Company",
    title: "Where a model update crosses organizations",
    dek: "Five application areas, each with a proposed review workflow illustrated by the recorded experiment.",
    image: photo("robotAssemblyArm"),
    body: [
      "A model update often leaves the team that built it. A supplier ships it, an operator runs it, and a reviewer may need to know which release ran where. That handoff is where Vraelis focuses.",
      "Defense: AI in mission systems, where an unexpected model change can create security and operational risk.",
      "Critical infrastructure: AI in energy, water and communications, where releases cross operators.",
      "Autonomous systems: AI in robots and vehicles, where models ship to machines in the field.",
      "Government and institutions: public bodies that need evidence a reviewer can read.",
      "Suppliers and integrators: the teams who ship model updates into systems they do not own.",
      "Each page now shows a proposed review workflow, illustrated by the recorded synthetic ONNX experiment. None of them describes a deployment, a customer or an authorization process.",
    ],
    links: [{ label: "Explore the applications", to: "/applications" }],
  },
  {
    slug: "evidence-app",
    date: "2026-10-10",
    kind: "Product",
    title: "A read-only evidence app for Vraelis Contour",
    dek: "Six screens over the recorded trace, with every finding from internal automated review addressed.",
    image: capture("app-overview"),
    body: [
      "The Vraelis Contour evidence app reads the recorded trace and shows it in six screens: Overview, Releases, Destination, Observations, Policy and Traces.",
      "The Destination screen puts the approved release beside the reported loaded release, field by field, so a version mismatch is visible. Observations keeps every record in order, including the ones that confirm nothing.",
      "The app is read-only. It has no deploy, approval, reload or fleet controls. Internal automated review of the app reported five findings, and each is addressed in the current version.",
    ],
    links: [{ label: "See the app", to: "/contour" }],
  },
  {
    slug: "vraelis-contour",
    date: "2026-10-08",
    kind: "Product",
    title: "Vraelis Contour, our first product direction",
    dek: "Model release security, from approval to reported runtime state.",
    image: photo("releaseReview"),
    body: [
      "Vraelis Contour is our first product direction. It is for release, platform and security engineers at suppliers and system integrators.",
      "An approved update is not proof it loaded. Contour compares the approved model release with what the receiving runtime reports running, and records differences or unavailable evidence.",
      "It is in private development. The reference path today is a synthetic ONNX CPU experiment, and runtime reports are trusted worker self-reports.",
    ],
    links: [{ label: "About Vraelis Contour", to: "/contour" }],
  },
  {
    slug: "ai-security",
    date: "2026-10-07",
    kind: "Company",
    title: "Vraelis focuses on AI security",
    dek: "Cybersecurity software for AI in defense, critical infrastructure and autonomous systems.",
    image: photo("substationNetwork"),
    body: [
      "Vraelis develops cybersecurity software for AI in defense, critical infrastructure and autonomous systems.",
      "Our work spans four research areas. Model integrity: whether the model that runs is the model that was approved. Adversarial threats: inputs, updates and supply paths built to change what a model does. Machine trust: explicit identity, limited permissions and checks at execution boundaries. Security evidence: records a person can read, kept in order, including what could not be confirmed.",
    ],
    links: [{ label: "Our research", to: "/research" }],
  },
];

export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);

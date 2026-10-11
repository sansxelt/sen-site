// The newest Vraelis entries, newest first. Each one is a dated fact from the repository or the review record.
// The homepage strip shows the first four; /changelog shows all of these above the earlier record.
export type NewsItem = {
  id: string;
  date: string; // ISO day
  kind: "Product" | "Company" | "Engineering";
  title: string;
  summary: string;
  image: { src: string; alt: string; w: number; h: number };
  to?: string;
};

export const NEWS: NewsItem[] = [
  {
    id: "2026-10-10-evidence-app",
    date: "2026-10-10",
    kind: "Product",
    title: "A read-only evidence app for Vraelis Contour",
    summary: "A six-screen read-only app over the recorded trace, with the QA fixes.",
    image: { src: "/v8/contour/app-destination-pending-1200.webp", alt: "The Vraelis Contour app comparing approved cpu-2 with reported loaded cpu-1.", w: 1200, h: 750 },
    to: "/contour",
  },
  {
    id: "2026-10-10-qa-131",
    date: "2026-10-10",
    kind: "Engineering",
    title: "QA reproduces 131 of 131 experiment tests offline",
    summary: "QA rebuilt the pinned harness offline and reproduced every experiment test.",
    image: { src: "/v8/contour/app-policy-1200.webp", alt: "The runtime policy in the Vraelis Contour app: ONNX Runtime 1.23.2 and CPUExecutionProvider.", w: 1200, h: 750 },
    to: "/contour/status",
  },
  {
    id: "2026-10-08-contour",
    date: "2026-10-08",
    kind: "Product",
    title: "Vraelis Contour, our first product direction",
    summary: "Model release security, from approval to reported runtime state.",
    image: { src: "/site/photography/editorial-releaseReview.jpg", alt: "An engineer working with a robotic arm.", w: 1920, h: 1282 },
    to: "/contour",
  },
  {
    id: "2026-10-07-ai-security",
    date: "2026-10-07",
    kind: "Company",
    title: "Vraelis focuses on AI security",
    summary: "Cybersecurity software for AI in defense, critical infrastructure and autonomous systems.",
    image: { src: "/site/photography/editorial-substationNetwork.jpg", alt: "Electrical equipment at a power substation.", w: 1920, h: 1182 },
    to: "/company",
  },
];

export const formatDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

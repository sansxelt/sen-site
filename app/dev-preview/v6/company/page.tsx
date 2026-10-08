import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
import { SUPPORT } from "../_system/positioning";
const content: DirectionContent = {
  eyebrow: "Company",
  title: "Independent software. System-specific security.",
  intro: SUPPORT,
  photo: "satelliteStation",
  heading: "Security for the AI within the system.",
  lead: "An independent software company in private development, working with the boundaries and owners of AI-enabled systems.",
  items: [
    { label: "Purpose", title: "Protect the intelligence inside.", body: "Models, untrusted inputs and machine authority introduce different security problems. Match each control to a defined threat.", href: "/platform" },
    { label: "People", title: "Engineering teams and system owners", body: "Our intended customers supply, integrate and operate AI in defense, critical infrastructure and robotics.", href: "/solutions" },
    { label: "First product", title: "Vraelis Contour", body: "Model release security for robotics suppliers and system integrators. In private development.", href: "/contour" },
  ],
  nextTitle: "Build on evidence.",
  nextLead: "Useful security must fit the actual workflow and stand up to a reproducible test.",
  next: [
    { label: "Research", title: "Start with a threat you can test.", body: "Select a model, input path and controlled test environment. Document the attack cases, normal behavior and limits of the proposed protection." },
    { label: "Engineering", title: "Connect the foundation to a complete workflow.", body: "Document the identity source, model version, allowed operations and environment." },
    { label: "Evidence", title: "Review the decision and outcome", body: "Retain the exact policy and action bindings alongside the observations available to the reviewer." },
  ],
};
export const metadata = v6meta({ title: "Vraelis | Independent AI cybersecurity", description: SUPPORT, path: "/company" });
export default function Page() { return <DirectionPage content={content} />; }

import "../_system/company-story.css";
import { DirectionPage, type DirectionContent } from "../_system/direction-page";
import { v6meta } from "../_system/meta";
import { SUPPORT } from "../_system/positioning";
import { COMPANY_SECURITY_AREAS } from "../_content/company-direction";
const content: DirectionContent = {
  eyebrow: "Company",
  title: "AI security for consequential systems.",
  intro: SUPPORT,
  photo: "satelliteStation",
  heading: "From release to operation and investigation.",
  lead: "Within these sectors, our research follows the models, inputs and authority across a system's lifecycle. Each product addresses a specific customer job.",
  items: COMPANY_SECURITY_AREAS.map(area => ({ label: area.phase, title: area.title, body: area.body, href: area.href })),
  nextTitle: "One company. Products for distinct jobs.",
  nextLead: "Our intended customers supply, integrate and operate AI in defense, critical infrastructure and robotics. Vraelis Contour is our first product direction, focused on model release security.",
  next: [
    { label: "First product", title: "Vraelis Contour", body: "For release, platform and security engineers at robotics suppliers and system integrators. Connect the approved release to its destination and the version the managed runtime reports loading. In private development.", href: "/contour", linkLabel: "Explore Vraelis Contour" },
    { label: "Research", title: "Defined threats and measurable controls", body: "Model integrity, adversarial assessment and machine authority have different proof requirements. Research must establish where a proposed control works and where it stops." },
    { label: "Product development", title: "The customer job defines the product", body: "Additional products follow distinct customer needs and operating requirements. Application areas and deployment modes do not automatically become separate products." },
  ],
};
export const metadata = v6meta({ title: "Vraelis | Company and founder Nishanth Dasari", description: "Vraelis is founded by Nishanth Dasari and is part of Foremake. Developing AI security for defense, critical infrastructure and autonomous systems.", path: "/company" });
export default function Page() { return <><section id="nishanth-dasari" className="v6-wrap founder-profile"><p className="home-eyebrow">Founder</p><h1>Nishanth Dasari</h1><p>Nishanth Dasari is the founder of Vraelis. Vraelis develops cybersecurity software for AI in defense, critical infrastructure and autonomous systems, and is part of Foremake.</p><a className="story-link" href="https://www.linkedin.com/in/beamed/">Nishanth on LinkedIn ↗</a><br /><a className="story-link" href="https://foremake.com/nishanth">Nishanth Dasari’s Foremake profile ↗</a></section><DirectionPage content={content} /></>; }

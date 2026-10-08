import { DirectionPage } from "../_system/direction-page";
import { SECURITY_PAGES } from "../_content/security-direction";
import { v6meta } from "../_system/meta";

const content = SECURITY_PAGES["integrators"];
export const metadata = v6meta({ title: content.title.replace(/\.$/, ""), description: content.intro, path: "/integrators" });
export default function Page() { return <DirectionPage content={content} />; }

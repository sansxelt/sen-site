import { DirectionPage } from "../_system/direction-page";
import { SECURITY_PAGES } from "../_content/security-direction";
import { v6meta } from "../_system/meta";

const content = SECURITY_PAGES["platform"];
export const metadata = v6meta({ title: content.eyebrow, description: content.intro, path: "/platform" });
export default function Page() { return <DirectionPage content={content} />; }

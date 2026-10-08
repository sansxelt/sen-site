import { DirectionPage } from "../_system/direction-page";
import { SECURITY_PAGES } from "../_content/security-direction";
import { v6meta } from "../_system/meta";

const content = SECURITY_PAGES["enterprise"];
export const metadata = v6meta({ title: content.title.replace(/\.$/, ""), description: content.intro, path: "/enterprise" });
export default function Page() { return <DirectionPage content={content} />; }

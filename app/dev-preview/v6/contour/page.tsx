import { DirectionPage } from "../_system/direction-page";
import { SECURITY_PAGES } from "../_content/security-direction";
import { v6meta } from "../_system/meta";

const content = SECURITY_PAGES.contour;
export const metadata = v6meta({ title: "Vraelis Contour", description: content.intro, path: "/contour" });
export default function Page() { return <DirectionPage content={content} />; }

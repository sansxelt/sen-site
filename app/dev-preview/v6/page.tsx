import type { Metadata } from "next";
import Home from "./home";
import { v6meta } from "./_system/meta";
import { META_TITLE, META_DESCRIPTION, OG_TITLE, OG_DESCRIPTION } from "./_system/positioning";

export const metadata: Metadata = {
  // Positioning strings are provisional and centralized in _system/positioning.ts. Change them there.
  ...v6meta({
    title: META_TITLE,
    description: META_DESCRIPTION,
    path: "/",
    ogTitle: OG_TITLE,
    ogDescription: OG_DESCRIPTION,
  }),
  // Absolute so the homepage title is not suffixed by the site template (avoids a doubled "Vraelis").
  title: { absolute: META_TITLE },
};

export default function Page() {
  return <Home />;
}

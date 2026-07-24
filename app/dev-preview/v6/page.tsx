import type { Metadata } from "next";
import Home from "./home";
import { v6meta } from "./_system/meta";

export const metadata: Metadata = {
  ...v6meta({
    title: "Vraelis — Oversight for AI software agents",
    description:
      "Vraelis follows AI software agents from assigned responsibility to trusted completion — surfacing uncertainty, evidence, decisions, repairs, and what the company learns.",
    path: "/",
    ogTitle: "Give AI agents responsibility without giving up control.",
    ogDescription:
      "Vraelis provides independent oversight for AI software work across planning, execution, review, repair, and trusted completion.",
  }),
  // Absolute so the homepage title is not suffixed by the site template (avoids a doubled "Vraelis").
  title: { absolute: "Vraelis — Oversight for AI software agents" },
};

export default function Page() {
  return <Home />;
}

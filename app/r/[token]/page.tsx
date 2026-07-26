import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { socialCard } from "@/lib/social-card";

// Public shared-report viewer for the retired human-evaluation product (voting reports with per-judgment results and a recommended winner). The current Vraelis product does not share
// through this path, so any such link redirects rather than rendering a retired report.
//
// TWO THINGS WERE STILL LEAKING HERE.
//
// The embed was hand-written and said "Production validation for AI-built systems", a positioning two pivots
// old, attached to a rendered 1200x630 card served as summary_large_image. So a bookmarked link from a dead
// product was still advertising the wrong company with the wrong artwork, on a page whose whole job is to
// send the visitor somewhere current. It now uses the one shared card like every other surface.
//
// The redirect pointed at /how-it-works, which design 06 deliberately drops (superseded by /method and
// /platform). That target resolves to the previous site today and would keep doing so after promotion, so
// an old link would land on the generation this repo is replacing. "/" is correct in both regimes.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Vraelis",
    robots: { index: false, follow: false },
    ...socialCard(),
  };
}

export default function PublicReportRedirect() {
  redirect("/");
}

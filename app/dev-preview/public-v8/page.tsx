import type { Metadata } from "next";
import { ScrollStory } from "./scroll-story";

// Not indexable: a scroll-directed art-direction prototype for the Design 05 public site (public-v8). The live
// homepage is untouched; nothing here is merged. Five authored scroll scenes that reinvent the page as the
// visitor scrolls, telling Vraelis's canonical story: category (AI cannot prove itself) -> the requirement held
// outside the code -> the real Failed to Verified production lineage -> the field of proof -> the durable
// Guarantee product. Real production lineage (8f21ad Failed, 72c98e Verified), no fabricated customer, no
// "Illustrative", honest current-versus-next.
export const metadata: Metadata = { title: "Vraelis, public-v8 prototype", robots: { index: false, follow: false } };

export default function PublicV8() {
  return <ScrollStory />;
}

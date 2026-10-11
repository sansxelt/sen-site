import { permanentRedirect } from "next/navigation";
import { href } from "../../_kit/site";

// The earlier site published these records at /partnerships/<slug>; they now live at /partners/<slug>.
type Props = { params: Promise<{ slug: string }> };
export default async function Page({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(href(slug === "reddit" || slug === "bytedance" ? `/partners/${slug}` : "/partners"));
}

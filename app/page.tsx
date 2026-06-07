import { redirect } from "next/navigation";

// The sansxel.ai apex/homepage was retired; vraelis is the site now.
// vraelis.com hits never reach here (proxy.ts rewrites their "/" to
// "/v"); this only covers the bare deployment URL / localhost root, so
// default it to the vraelis home too.
export default function RootPage() {
  redirect("/v");
}

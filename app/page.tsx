import { redirect } from "next/navigation";

// The sansxel.ai apex/homepage was retired; vraelis is the site now.
// vraelis.com hits never reach here (proxy.ts rewrites their "/" to
// "/rank"); this only covers the bare deployment URL / localhost root,
// so default it to the same vraelis home.
export default function RootPage() {
  redirect("/rank");
}

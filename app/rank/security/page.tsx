import { redirect } from "next/navigation";

// /security moved to /enterprise (enterprise + security are one hub now). The
// proxy also redirects the clean path; this server redirect covers direct hits
// and cached links.
export default function SecurityMoved() {
  redirect("/enterprise");
}

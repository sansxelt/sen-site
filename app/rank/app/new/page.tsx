import { redirect } from "next/navigation";

// The retired crowd-vote "new test" form is gone. In the current product "+ New" means
// connecting an application for verification, so /new resolves there — an old
// bookmark lands on the current flow rather than a 404.
export default function NewRedirect() {
  redirect("/systems/new");
}

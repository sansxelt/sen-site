import { notFound } from "next/navigation";

// Any v8 path that matches no page (with v8 promoted, any unknown address on vraelis.com) ends here, so the 404 is
// v8's own, inside the site's header and footer (not-found.tsx beside this folder), not the root app's older page.
export default function Missing() {
  notFound();
}

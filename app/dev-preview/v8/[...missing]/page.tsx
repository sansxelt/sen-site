import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { robotsMeta } from "@/lib/stealth";

// Any v8 path that matches no page (with v8 promoted, any unknown address on vraelis.com) ends here, so the 404 is
// v8's own (not-found.tsx beside this folder), not the root app's older page. The tab title is set here as well:
// a 404 raised by notFound() in a page takes the page's metadata, not the not-found file's.
export const metadata: Metadata = { title: { absolute: "Error | Vraelis" }, robots: robotsMeta(false) };

export default function Missing() {
  notFound();
}

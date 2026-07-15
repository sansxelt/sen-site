import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/v-entitlements";

// Server gate for the internal admin surface. The admin PAGE is a client component whose data APIs are
// already 403-gated server-side, but without this layout the page SHELL (headings, filters, and internal
// vocabulary) would still render to an unauthenticated/non-admin request before the client gate resolves —
// exposing an internal surface publicly. This layout resolves the session on the server and returns a
// uniform 404 for anyone who is not an admin, so a non-admin/crawler sees "not found," never the panel.
export const metadata = { title: "Vraelis", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const email = (await auth())?.user?.email;
  if (!isAdmin(email)) notFound();
  return children;
}

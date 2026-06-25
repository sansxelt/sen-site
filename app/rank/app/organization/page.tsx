import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrganizationContext } from "@/lib/v-organization";
import { organizationActivity } from "@/lib/v-audit";
import { OrgClient } from "./org-client";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Forganization");
  const ctx = await getOrganizationContext(email);
  const activity = ctx.organization ? await organizationActivity(email, ctx.organization.id, 12) : [];
  return <OrgClient email={email.trim().toLowerCase()} ctx={ctx} activity={activity} />;
}

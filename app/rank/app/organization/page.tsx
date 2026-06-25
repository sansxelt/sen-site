import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrganizationContext, getDomainAccessForEmail } from "@/lib/v-organization";
import { organizationActivity } from "@/lib/v-audit";
import { OrgClient } from "./org-client";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Forganization");
  const ctx = await getOrganizationContext(email);
  // No org of their own → they may be eligible to join one via a verified email domain.
  const domainAccess = ctx.organization ? [] : await getDomainAccessForEmail(email);
  const activity = ctx.organization ? await organizationActivity(email, ctx.organization.id, 12) : [];
  return <OrgClient email={email.trim().toLowerCase()} ctx={ctx} activity={activity} domainAccess={domainAccess} />;
}

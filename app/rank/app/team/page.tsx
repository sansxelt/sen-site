import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getWorkspaceContext } from "@/lib/v-workspace";
import { TeamClient } from "./team-client";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fteam");

  const ctx = await getWorkspaceContext(email);
  return <TeamClient email={email.trim().toLowerCase()} initial={ctx} />;
}

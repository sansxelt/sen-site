import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { listWebhooks } from "@/lib/v-webhooks";
import { SandboxConsole } from "./sandbox-console";

export const metadata: Metadata = { title: "Sandbox console" };

export default async function SandboxPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fsandbox");

  const hasApiAccess = apiAccessAllowed(await getPlan(email), email);
  // The owner's own webhook endpoints (url + id only, never the secret).
  const endpoints = hasApiAccess
    ? (await listWebhooks(email)).map((w) => ({ id: w.id, url: w.url, enabled: w.enabled }))
    : [];

  return <SandboxConsole hasApiAccess={hasApiAccess} endpoints={endpoints} />;
}

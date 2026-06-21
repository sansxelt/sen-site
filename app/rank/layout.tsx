import type { ReactNode } from "react";
import { auth } from "@/auth";
import { RankShell } from "./_components/rank-ui";

export default async function RankLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return <RankShell signedIn={Boolean(email)} email={email}>{children}</RankShell>;
}

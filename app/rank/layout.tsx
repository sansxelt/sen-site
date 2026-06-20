import type { ReactNode } from "react";
import { auth } from "@/auth";
import { RankShell } from "./_components/rank-ui";

export default async function RankLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return <RankShell signedIn={Boolean(session?.user?.email)}>{children}</RankShell>;
}

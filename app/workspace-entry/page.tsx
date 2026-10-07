/* Workspace access is closed; this page collects no credentials or access requests. */
import type { Metadata } from "next";
import { AuthFrame } from "@/app/_components/auth-frame";

export const metadata: Metadata = {
  title:"Private workspace | Vraelis",
  description:"Vraelis private workspace. Product access remains closed during development.",
  robots:{index:false,follow:false},
};

export default function WorkspaceEntry() {
  return <AuthFrame workspace><section className="workspace-closed" aria-labelledby="workspace-closed-title">
    <p className="workspace-closed__eyebrow">Private workspace</p>
    <h1 id="workspace-closed-title">Access is currently closed.</h1>
    <p className="workspace-closed__copy">Vraelis is in private development. Sign-in and new account access are not available yet.</p>
    <a href="https://vraelis.com/beta" className="btn">Development status</a>
    <a href="/auth/reset-password" className="workspace-closed__recovery">Recover an existing account</a>
  </section></AuthFrame>;
}

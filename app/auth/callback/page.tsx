import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCallbackClient } from "../../../components/auth-callback-client";

export const metadata: Metadata = {
  title: "Auth Callback",
  description: "Completes secure sign-in and routes you back into sansxel.",
};

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
          <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
              Auth callback
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Finishing your sign-in
            </h1>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-200">
              Loading your session...
            </div>
          </div>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { assertDevAccess } from "@/lib/dev-gate";
import { EMAIL_SAMPLES } from "@/lib/email-samples";
import { isEmailConfigured } from "@/lib/email";
import { SendButton } from "./send-button";

export const metadata: Metadata = {
  title: "Email templates — dev",
  robots: { index: false, follow: false },
};

const channelTone: Record<"account" | "billing" | "support", string> = {
  account: "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300",
  billing: "border-sky-400/30 bg-sky-400/[0.08] text-sky-300",
  support: "border-amber-300/30 bg-amber-300/[0.08] text-amber-200",
};

export default async function DevEmailsPage() {
  if ((await assertDevAccess()) !== null) notFound();

  const session = await auth();
  const defaultTarget = session?.user?.email ?? "";
  const configured = isEmailConfigured();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
              Dev tools
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Email templates
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Every transactional template, with live HTML previews and a
              one-click real send through the production Resend pipeline.
              Both the preview and the send call the same renderer — a
              preview that looks right is a send that will look right.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
            <span className={configured ? "h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 rounded-full bg-rose-400"} />
            {configured ? "Resend configured" : "RESEND_API_KEY missing — sends will silently no-op"}
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {EMAIL_SAMPLES.map((sample) => (
            <section
              key={sample.key}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">
                      {sample.label}
                    </h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${channelTone[sample.channel]}`}
                    >
                      {sample.channel}
                    </span>
                    <code className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-neutral-400">
                      {sample.key}
                    </code>
                  </div>
                  <p className="mt-1.5 max-w-2xl text-xs leading-5 text-neutral-400">
                    {sample.description}
                  </p>
                </div>

                <SendButton sampleKey={sample.key} defaultTo={defaultTarget} />
              </header>

              <iframe
                title={`${sample.label} preview`}
                srcDoc={sample.renderHtml()}
                sandbox=""
                className="h-[640px] w-full border-0 bg-white"
              />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

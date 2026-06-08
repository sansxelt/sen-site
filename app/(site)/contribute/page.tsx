import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../../auth";
import { AuroraBackground } from "@/components/aurora-background";
import { isAdminEmail } from "@/lib/admin";
import { getSignInPath } from "@/lib/auth-ui";
import { getContributorByEmail } from "@/lib/contributors";
import { ContributeForm } from "./contribute-form";

// Public Learn-contributor application page. The four states:
//   1. Anonymous → CTA to sign in (then comes back here)
//   2. Admin → "you're already on the byline as Vraelis (OWNER)"
//   3. Signed-in, no record (or rejected) → apply form
//   4. Signed-in, pending → "we're reviewing"
//   5. Signed-in, approved → byline locked, writing surface notice

export const metadata: Metadata = {
  title: "Write for Vraelis",
  description:
    "Apply to contribute to the Vraelis Learn library. Approved writers get a hardlocked byline.",
};

export const dynamic = "force-dynamic";

export default async function ContributePage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const admin = isAdminEmail(email);
  const contributor = email ? await getContributorByEmail(email) : null;

  return (
    <>
      <AuroraBackground />
      <section className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-24 lg:px-8 lg:pt-10">
        <header className="space-y-4">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Write for Vraelis
          </div>
          <h1 className="hx-gradient-text text-3xl font-semibold tracking-tight sm:text-5xl">
            Pitch a topic, get a hardlocked byline.
          </h1>
          <p className="text-base leading-7 text-neutral-200">
            The Learn library publishes guides, info pages, and research deep-dives. We approve writers individually so the bar stays high. Once approved, every piece you publish carries the same byline forever.
          </p>
        </header>

        <div className="mt-10">
          {!email && <AnonymousCTA />}
          {email && admin && <AdminNotice />}
          {email && !admin && contributor?.status === "pending" && (
            <PendingNotice
              appliedName={contributor.applied_name}
              appliedReason={contributor.applied_reason}
            />
          )}
          {email && !admin && contributor?.status === "approved" && (
            <ApprovedNotice
              displayName={contributor.display_name ?? contributor.applied_name ?? email}
            />
          )}
          {email && !admin && (!contributor || contributor.status === "rejected") && (
            <div className="space-y-5">
              {contributor?.status === "rejected" && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
                  Your previous application wasn&apos;t accepted. You can resubmit with new context.
                </div>
              )}
              <ContributeForm
                defaultName={contributor?.applied_name ?? session?.user?.name ?? ""}
                defaultReason={contributor?.applied_reason ?? ""}
                isResubmit={contributor?.status === "rejected"}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function AnonymousCTA() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <p className="text-sm leading-6 text-neutral-300">
        You need an account to apply, so we know where to send the decision and which email to lock the byline to.
      </p>
      <Link
        href={getSignInPath("/contribute")}
        className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-neutral-100"
      >
        Sign in to apply
      </Link>
    </div>
  );
}

function AdminNotice() {
  return (
    <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-6">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300">
        You&apos;re an admin
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-200">
        Admin pieces publish under the brand byline (Vraelis · OWNER), no application needed.
      </p>
      <Link
        href="/account/content"
        className="mt-4 inline-flex rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.12]"
      >
        Open Learn content board
      </Link>
    </div>
  );
}

function PendingNotice({
  appliedName,
  appliedReason,
}: {
  appliedName: string | null;
  appliedReason: string | null;
}) {
  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-6">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-300">
        Under review
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-200">
        We&apos;re reviewing your application. You&apos;ll get an email when there&apos;s a decision. No need to follow up.
      </p>
      {(appliedName || appliedReason) && (
        <div className="mt-4 space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm">
          {appliedName && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Name
              </span>
              <div className="text-neutral-200">{appliedName}</div>
            </div>
          )}
          {appliedReason && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Pitch
              </span>
              <p className="whitespace-pre-wrap leading-relaxed text-neutral-300">
                {appliedReason}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApprovedNotice({ displayName }: { displayName: string }) {
  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-6">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">
        Approved
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-200">
        Your byline is locked as{" "}
        <span className="font-semibold text-white">{displayName}</span>. Every piece you publish from here on out ships with that name.
      </p>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        We&apos;ll email you when the contributor writing surface is ready. In the meantime, send drafts to help@vraelis.com and an admin will seed them for you.
      </p>
    </div>
  );
}

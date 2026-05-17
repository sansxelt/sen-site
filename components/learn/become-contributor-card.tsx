import Link from "next/link";

// Standing CTA at the bottom of every Learn piece (DB-backed and
// hardcoded). Surfaces the path for outside writers without making
// it a primary site nav item. Routes to /contribute, the structured
// application page (status-aware for signed-in users); the public
// /contact page still mentions help@ for unstructured pitches.
export function BecomeContributorCard() {
  return (
    <section className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300/70">
            Write for Vraelis
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-neutral-300">
            Want your work in the Learn library? Apply for a hardlocked byline.
          </p>
        </div>
        <Link
          href="/contribute"
          className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.12]"
        >
          Apply to write
        </Link>
      </div>
    </section>
  );
}

export default function UsageLoading() {
  return (
    <div className="max-w-3xl animate-pulse">
      <div className="h-7 w-20 rounded bg-white/10" />
      <div className="mt-2 h-4 w-56 rounded bg-white/[0.06]" />
      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="h-4 w-24 rounded bg-white/10" />
          <div className="mt-4 h-8 w-32 rounded bg-white/10" />
          <div className="mt-3 h-2 rounded-full bg-white/10" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="mt-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

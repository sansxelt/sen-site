export default function AccountLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Profile card */}
      <div className="flex items-center gap-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="h-14 w-14 shrink-0 rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-3 w-56 rounded bg-white/[0.06]" />
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="h-6 w-10 rounded bg-white/10" />
            <div className="mt-1 h-3 w-16 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="h-32 rounded-xl border border-white/10 bg-white/[0.02]" />
          <div className="h-48 rounded-xl border border-white/10 bg-white/[0.02]" />
        </div>
        <div className="space-y-5">
          <div className="h-56 rounded-xl border border-white/10 bg-white/[0.02]" />
          <div className="h-40 rounded-xl border border-white/10 bg-white/[0.02]" />
        </div>
      </div>
    </div>
  );
}

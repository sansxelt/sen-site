export default function KeysLoading() {
  return (
    <div className="max-w-3xl animate-pulse">
      <div className="h-7 w-24 rounded bg-white/10" />
      <div className="mt-2 h-4 w-72 rounded bg-white/[0.06]" />
      <div className="mt-8 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-white/10" />
                <div className="h-3 w-48 rounded bg-white/[0.06]" />
              </div>
              <div className="h-8 w-20 rounded bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

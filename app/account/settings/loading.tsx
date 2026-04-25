export default function SettingsLoading() {
  return (
    <div className="max-w-3xl animate-pulse">
      <div className="h-7 w-24 rounded bg-white/10" />
      <div className="mt-2 h-4 w-64 rounded bg-white/[0.06]" />
      <div className="mt-8 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="mt-3 h-9 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="glass-panel p-6 rounded-3xl border border-white/60 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-emerald-200/50 rounded-full w-40" />
          <div className="h-7 bg-slate-200/60 rounded-xl w-64" />
          <div className="h-3.5 bg-slate-200/40 rounded-lg w-80" />
        </div>
        <div className="w-10 h-10 rounded-2xl bg-emerald-100/60 flex items-center justify-center animate-spin">
          🥗
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/60 h-44 space-y-3">
          <div className="h-5 bg-slate-200/60 rounded-lg w-1/2" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
        </div>
        <div className="glass-panel p-6 rounded-3xl border border-white/60 h-44 space-y-3">
          <div className="h-5 bg-slate-200/60 rounded-lg w-1/2" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
        </div>
        <div className="glass-panel p-6 rounded-3xl border border-white/60 h-44 space-y-3">
          <div className="h-5 bg-slate-200/60 rounded-lg w-1/2" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}


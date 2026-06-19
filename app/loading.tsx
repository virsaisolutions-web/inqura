export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI skeleton */}
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 h-20">
            <div className="h-2.5 bg-slate-100 rounded w-3/4 mb-3" />
            <div className="h-6 bg-slate-100 rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-white rounded-lg border border-slate-200 h-64" />
        <div className="col-span-2 bg-white rounded-lg border border-slate-200 h-64" />
      </div>
      {/* Table skeleton */}
      <div className="bg-white rounded-lg border border-slate-200 h-48" />
    </div>
  )
}

/**
 * Reusable skeleton/shimmer loading components
 * Usage: <CardSkeleton />, <TableSkeleton rows={5} />, <KPISkeleton count={4} />, <ChartSkeleton />
 */

function Shimmer({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
      style={style}
    />
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-3 w-1/2" />
            </div>
          </div>
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
          <div className="flex gap-2 pt-1">
            <Shimmer className="h-6 w-16 rounded-full" />
            <Shimmer className="h-6 w-20 rounded-full" />
          </div>
          <Shimmer className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-5 py-3 border-b border-border bg-muted/30">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-4 flex-1" style={{ maxWidth: i === 0 ? "30%" : "20%" }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, ci) => (
            <Shimmer
              key={ci}
              className="h-3.5 flex-1"
              style={{
                maxWidth: ci === 0 ? "30%" : ci === cols - 1 ? "10%" : "20%",
                opacity: 0.5 + (ri % 3) * 0.15,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KPISkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="w-8 h-8 rounded-lg" />
          </div>
          <Shimmer className="h-7 w-20" />
          <div className="flex items-center gap-2">
            <Shimmer className="h-3 w-12" />
            <Shimmer className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-32" />
        <div className="flex gap-2">
          <Shimmer className="h-7 w-16 rounded-md" />
          <Shimmer className="h-7 w-16 rounded-md" />
        </div>
      </div>
      <div className="flex items-end gap-2 h-[200px] pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between pt-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer key={i} className="h-2.5 w-8" />
        ))}
      </div>
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-6 w-48" />
          <Shimmer className="h-3 w-72" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-24 rounded-lg" />
          <Shimmer className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      {/* KPIs */}
      <KPISkeleton count={4} />
      {/* Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      {/* Table */}
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}

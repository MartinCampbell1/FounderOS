import { cn } from "@founderos/ui/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted/70",
        className
      )}
    />
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", className)}>
      <Skeleton className="h-9 w-9 rounded-[10px]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-4/5" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-border/70 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        className
      )}
    >
      <div className="divide-y divide-border/70">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-3 sm:gap-4", className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-[12px] border border-border/70 bg-background/70 px-3 py-2.5"
        >
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[14px] border border-border/70 bg-background/70 p-4", className)}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="flex flex-wrap gap-2 pt-0.5">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <SkeletonStats count={4} />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <SkeletonList rows={8} />
      </div>
    </div>
  );
}

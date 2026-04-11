import {
  SkeletonCard,
  SkeletonList,
  SkeletonStats,
} from "@/components/shell/shell-skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
      <div className="space-y-2">
        <div className="h-7 w-52 rounded-md bg-muted/60 animate-pulse" />
        <div className="h-4 w-72 rounded-md bg-muted/60 animate-pulse" />
      </div>
      <SkeletonStats count={3} className="max-w-3xl" />
      <div className="grid gap-4 lg:grid-cols-[208px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3">
          <div className="h-3 w-20 rounded-md bg-muted/60 animate-pulse" />
          <SkeletonList rows={4} className="divide-y-0" />
        </div>
        <div className="space-y-4">
          <SkeletonCard className="min-h-[124px]" />
          <SkeletonCard className="min-h-[160px]" />
          <SkeletonList rows={4} />
        </div>
      </div>
    </div>
  );
}

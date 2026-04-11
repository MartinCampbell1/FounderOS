import {
  SkeletonCard,
  SkeletonList,
  SkeletonStats,
} from "@/components/shell/shell-skeleton";

export default function DiscoveryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-md bg-muted/60 animate-pulse" />
        <div className="h-4 w-[28rem] rounded-md bg-muted/60 animate-pulse" />
      </div>
      <SkeletonStats count={5} className="max-w-6xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SkeletonCard className="min-h-[260px]" />
        <div className="space-y-4">
          <SkeletonCard className="min-h-[140px]" />
          <SkeletonList rows={5} />
        </div>
      </div>
    </div>
  );
}

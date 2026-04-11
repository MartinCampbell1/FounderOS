import {
  SkeletonCard,
  SkeletonList,
  SkeletonStats,
} from "@/components/shell/shell-skeleton";

export default function ExecutionLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
      <div className="space-y-2">
        <div className="h-7 w-60 rounded-md bg-muted/60 animate-pulse" />
        <div className="h-4 w-[26rem] rounded-md bg-muted/60 animate-pulse" />
      </div>
      <SkeletonStats count={4} className="max-w-5xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <SkeletonCard className="min-h-[140px]" />
          <SkeletonList rows={5} />
        </div>
        <SkeletonCard className="min-h-[260px]" />
      </div>
    </div>
  );
}

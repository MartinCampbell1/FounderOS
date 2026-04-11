import Link from "next/link";
import {
  ShellHero,
  ShellPage,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";

const primaryLinkClassName =
  "inline-flex h-8 items-center justify-center rounded-[8px] border border-primary bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-[background-color,border-color,color,box-shadow] hover:brightness-[1.03]";

const secondaryLinkClassName =
  "inline-flex h-8 items-center justify-center rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 text-[13px] font-medium text-foreground transition-[background-color,border-color,color,box-shadow] hover:bg-[color:var(--shell-control-hover)]";

export default function ShellNotFound() {
  return (
    <ShellPage className="min-h-[60vh] justify-center py-6">
      <div className="mx-auto w-full max-w-[720px] space-y-4">
        <ShellHero
          title="Page not found"
          description="The route may have moved, been renamed, or is not available in this shell."
          meta={
            <span className="rounded-full border border-border/60 bg-[color:var(--shell-control-bg)] px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              404
            </span>
          }
          actions={
            <>
              <Link href="/dashboard" className={primaryLinkClassName}>
                Go to dashboard
              </Link>
              <Link href="/inbox" className={secondaryLinkClassName}>
                Open inbox
              </Link>
            </>
          }
        />
        <ShellSectionCard
          title="Recovery"
          description="Use a known shell entry point or return to the main workspace."
          contentClassName="space-y-3"
        >
          <ShellStatusBanner tone="info">
            This shell exposes only routes you can currently access.
          </ShellStatusBanner>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className={primaryLinkClassName}>
              Go to dashboard
            </Link>
            <Link href="/inbox" className={secondaryLinkClassName}>
              Open inbox
            </Link>
          </div>
        </ShellSectionCard>
      </div>
    </ShellPage>
  );
}

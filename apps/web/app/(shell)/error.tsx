"use client";

import { Button } from "@founderos/ui/components/button";
import {
  ShellHero,
  ShellPage,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import { useEffect } from "react";
import Link from "next/link";

const primaryLinkClassName =
  "inline-flex h-8 items-center justify-center rounded-[8px] border border-primary bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-[background-color,border-color,color,box-shadow] hover:brightness-[1.03]";

export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Shell error:", error);
  }, [error]);

  const message = error.message || "An unexpected error occurred. Please try again.";

  return (
    <ShellPage className="min-h-[60vh] justify-center py-6">
      <div className="mx-auto w-full max-w-[720px] space-y-4">
        <ShellHero
          title="Shell unavailable"
          description="This route hit an unexpected error before it could finish rendering. Try again or return to the dashboard."
          meta={
            <>
              <span className="rounded-full border border-border/60 bg-[color:var(--shell-control-bg)] px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                Route error
              </span>
              {error.digest ? (
                <span className="rounded-full border border-border/60 bg-[color:var(--shell-control-bg)] px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  Digest {error.digest}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Button type="button" variant="outline" onClick={reset}>
                Try again
              </Button>
              <Link href="/dashboard" className={primaryLinkClassName}>
                Go to dashboard
              </Link>
            </>
          }
        />
        <ShellSectionCard
          title="Details"
          description="The shell kept your session and navigation context intact where possible."
          contentClassName="space-y-3"
        >
          <ShellStatusBanner tone="danger">{message}</ShellStatusBanner>
          <p className="max-w-2xl text-[12px] leading-5 text-muted-foreground">
            If this keeps happening, refresh the dashboard and retry the route. The
            digest above helps trace the failure.
          </p>
        </ShellSectionCard>
      </div>
    </ShellPage>
  );
}

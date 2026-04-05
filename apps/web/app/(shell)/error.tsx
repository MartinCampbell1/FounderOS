"use client";

import { useEffect } from "react";

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

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mb-4 text-[48px]">⚠</div>
        <h2 className="text-[18px] font-medium text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

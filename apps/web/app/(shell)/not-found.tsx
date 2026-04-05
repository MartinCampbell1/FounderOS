import Link from "next/link";

export default function ShellNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="text-[64px] font-bold text-muted-foreground/20">404</div>
        <h2 className="mt-2 text-[18px] font-medium text-foreground">
          Page not found
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

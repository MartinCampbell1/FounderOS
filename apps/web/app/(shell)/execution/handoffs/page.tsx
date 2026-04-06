import Link from "next/link";

import { Badge } from "@founderos/ui/components/badge";
import { ShellPage } from "@/components/shell/shell-screen-primitives";
import { listExecutionBriefHandoffs } from "@/lib/execution-brief-handoffs";
import type { ExecutionBriefHandoffRecord } from "@/lib/execution-brief-handoffs";
import { buildExecutionHandoffScopeHref } from "@/lib/route-scope";

function formatRelativeTime(value: string) {
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.max(1, Math.floor(diffSeconds / 60))}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function briefTitle(brief: Record<string, unknown>): string {
  if (typeof brief.title === "string" && brief.title.length > 0) {
    return brief.title;
  }
  return "Untitled brief";
}

function launchIntentTone(intent: string | null | undefined) {
  if (intent === "launch") return "success" as const;
  return "neutral" as const;
}

function launchIntentLabel(intent: string | null | undefined) {
  if (intent === "launch") return "Launch";
  if (intent === "create") return "Create";
  return "Draft";
}

function HandoffRow({ handoff }: { handoff: ExecutionBriefHandoffRecord }) {
  const title = briefTitle(handoff.brief);
  const href = buildExecutionHandoffScopeHref(handoff.id);

  return (
    <Link
      href={href}
      className="flex min-h-[52px] items-center gap-3 border-b border-border/60 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
          Source: {handoff.source_session_id ?? handoff.source_plane}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge tone={launchIntentTone(handoff.launch_intent)}>
          {launchIntentLabel(handoff.launch_intent)}
        </Badge>
        <span className="w-[52px] text-right text-[12px] tabular-nums text-muted-foreground/70">
          {formatRelativeTime(handoff.created_at)}
        </span>
      </div>
    </Link>
  );
}

export default function ExecutionHandoffsPage() {
  const handoffs = listExecutionBriefHandoffs();

  return (
    <ShellPage>
      {handoffs.length > 0 ? (
        <div className="rounded-lg border border-border bg-card">
          {handoffs.map((handoff) => (
            <HandoffRow key={handoff.id} handoff={handoff} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="text-center">
            <div className="text-[14px] font-medium text-foreground">
              No active handoffs
            </div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              Handoffs appear here when ideas are ready for execution.
            </div>
            <div className="mt-4">
              <Link
                href="/inbox"
                className="text-[13px] text-primary hover:underline"
              >
                Go to Inbox
              </Link>
            </div>
          </div>
        </div>
      )}
    </ShellPage>
  );
}

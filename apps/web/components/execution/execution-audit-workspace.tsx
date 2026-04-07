"use client";

import type {
  AutopilotExecutionShadowAuditDetail,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { AlertTriangle, ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellComposerTextarea,
  ShellDetailCard,
  ShellEmptyState,
  ShellFactTileGrid,
  ShellHero,
  ShellInlineStatus,
  ShellLoadingState,
  ShellPage,
  ShellPillButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellExecutionAuditSnapshot } from "@/lib/execution-audits-model";
import { emptyShellExecutionAuditSnapshot } from "@/lib/execution-audits-model";
import { safeFormatDate, safeFormatRelativeTime } from "@/lib/format-utils";
import { resolveExecutionShadowAudit } from "@/lib/execution-mutations";
import {
  buildExecutionAuditsScopeHref,
  buildExecutionProjectScopeHref,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionAuditSnapshot } from "@/lib/shell-snapshot-client";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";

const EMPTY_AUDIT_SNAPSHOT = emptyShellExecutionAuditSnapshot();

function statusTone(status: string) {
  if (status === "open") return "danger" as const;
  if (status === "resolved") return "success" as const;
  return "neutral" as const;
}

function actionTone(action: string) {
  if (action === "quarantine" || action === "escalate") return "danger" as const;
  if (action === "retry") return "warning" as const;
  return "neutral" as const;
}

function sanitizeAuditError(error: string | null) {
  if (!error) return null;

  const normalized = error.toLowerCase();
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return "Autopilot audit detail is unavailable right now. Check the upstream connection in Settings, then refresh this route.";
  }

  return error;
}

function resolutionValue(
  audit: AutopilotExecutionShadowAuditDetail | null | undefined,
  key: string,
  fallback = "—"
) {
  const value = audit?.resolution?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function ContentPreview({
  title,
  content,
  fallback,
}: {
  title: string;
  content?: string | null;
  fallback: string;
}) {
  return (
    <ShellDetailCard className="bg-background/70">
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      <div className="mt-3 rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3">
        {content ? (
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-muted-foreground">
            {content}
          </pre>
        ) : (
          <div className="text-[12px] leading-6 text-muted-foreground">{fallback}</div>
        )}
      </div>
    </ShellDetailCard>
  );
}

function RelatedRunCard({
  runId,
  createdAt,
  status,
  completionState,
  runKind,
  projectId,
  routeScope,
}: {
  runId: string;
  createdAt: string;
  status: string;
  completionState: string;
  runKind: string;
  projectId?: string | null;
  routeScope: ShellRouteScope;
}) {
  const href =
    projectId && projectId.trim()
      ? buildExecutionProjectScopeHref(
          projectId,
          routeScopeFromProjectRef(projectId, null, routeScope)
        )
      : null;

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-medium text-foreground">{runId}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(status)}>{status}</Badge>
          <Badge tone={statusTone(completionState)}>{completionState}</Badge>
        </div>
      </div>
      <div className="mt-2 text-[12px] leading-6 text-muted-foreground">
        {runKind} · created {safeFormatRelativeTime(createdAt, safeFormatDate(createdAt))}
      </div>
    </>
  );

  if (!href) {
    return (
      <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
        {content}
      </div>
    );
  }

  return (
    <a
      href={href}
      className="block rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4 transition-colors hover:border-primary/25 hover:bg-[color:var(--shell-control-hover)]"
    >
      {content}
    </a>
  );
}

export function ExecutionAuditWorkspace({
  auditId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  auditId: string;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionAuditSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const {
    busyActionKey,
    errorMessage,
    isPending,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner({
    planes: ["execution"],
    scope: routeScope,
    source: "execution-audit",
    reason: "shadow-audit-review",
  });
  const effectiveScope = useMemo(() => {
    const projectId = initialSnapshot?.audit?.project_id || routeScope.projectId;
    return projectId
      ? routeScopeFromProjectRef(projectId, routeScope.intakeSessionId, routeScope)
      : routeScope;
  }, [
    initialSnapshot?.audit?.project_id,
    routeScope,
  ]);
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["execution"],
      scope: effectiveScope,
    },
    invalidationOptions: {
      ignoreSources: ["execution-audit"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollIntervalMs = getShellPollInterval(
    "execution_project_detail",
    preferences.refreshProfile
  );
  const loadSnapshot = useMemo(
    () => () => fetchShellExecutionAuditSnapshot(auditId),
    [auditId]
  );
  const selectLoadState = useMemo(
    () =>
      (snapshot: ShellExecutionAuditSnapshot) =>
        snapshot.auditLoadState === "ready" ? "ready" : "error",
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_AUDIT_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });
  const [note, setNote] = useState("");

  const audit = snapshot.audit;
  const error = errorMessage ?? sanitizeAuditError(snapshot.auditError);
  const projectHref = audit?.project_id
    ? buildExecutionProjectScopeHref(
        audit.project_id,
        routeScopeFromProjectRef(audit.project_id, null, routeScope)
      )
    : null;
  const auditsHref = buildExecutionAuditsScopeHref(routeScope);
  const canResolve = Boolean(audit && audit.open);

  async function handleResolve(outcome: string) {
    if (!audit) {
      return;
    }
    await runMutation(`shadow-audit:${audit.id}:${outcome}`, () =>
      resolveExecutionShadowAudit({
        audit,
        note,
        outcome,
        routeScope,
        source: "execution-audit",
      })
    );
  }

  if (loadState === "loading" && !audit && !error) {
    return (
      <ShellPage>
        <ShellLoadingState
          centered
          title="Loading shadow audit"
          description="Pulling the quarantined artifact, findings, and linked execution context."
          className="min-h-[60vh]"
        />
      </ShellPage>
    );
  }

  return (
    <ShellPage>
      <ShellHero
        title={audit?.summary || `Shadow audit ${auditId}`}
        description="Explicit review surface for quarantined execution-plane artifacts before they continue downstream."
        meta={
          <>
            <span>{audit?.project_id || "No project id"}</span>
            <span>{audit?.orchestrator_session_id || "No session id"}</span>
            <span>{audit?.runtime_agent_ids.length ?? 0} runtime agents</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <ShellActionLink href={auditsHref} label="Back to audits" />
            {projectHref ? <ShellActionLink href={projectHref} label="Open project" /> : null}
          </div>
        }
      />

      {error ? <ShellStatusBanner tone="danger">{error}</ShellStatusBanner> : null}
      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {!audit ? (
        <ShellEmptyState
          centered
          icon={<ShieldAlert className="h-5 w-5" />}
          title="Shadow audit unavailable"
          description={error || "This audit could not be loaded from the execution plane."}
          className="py-16"
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellFactTileGrid
                items={[
                  {
                    label: "Status",
                    value: <Badge tone={statusTone(audit.status)}>{audit.status}</Badge>,
                    detail: audit.open ? "Still blocking downstream use." : "Already reviewed.",
                  },
                ]}
                columnsClassName="grid-cols-1"
              />
            </div>
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellFactTileGrid
                items={[
                  {
                    label: "Action",
                    value: <Badge tone={actionTone(audit.action)}>{audit.action}</Badge>,
                    detail: `${audit.findings.length} findings`,
                  },
                ]}
                columnsClassName="grid-cols-1"
              />
            </div>
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellFactTileGrid
                items={[
                  {
                    label: "Updated",
                    value: safeFormatRelativeTime(audit.updated_at, safeFormatDate(audit.updated_at)),
                    detail: safeFormatDate(audit.updated_at),
                  },
                ]}
                columnsClassName="grid-cols-1"
              />
            </div>
            <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
              <ShellFactTileGrid
                items={[
                  {
                    label: "Linked Runs",
                    value: String(snapshot.linkedRuns.length),
                    detail: `${audit.runtime_agent_ids.length} runtime agents impacted`,
                  },
                ]}
                columnsClassName="grid-cols-1"
              />
            </div>
          </div>

          {!audit.open ? (
            <ShellStatusBanner tone="success">
              Resolved by {resolutionValue(audit, "actor")} with outcome{" "}
              <strong>{resolutionValue(audit, "outcome")}</strong> on{" "}
              {safeFormatDate(audit.resolved_at)}.
            </ShellStatusBanner>
          ) : (
            <ShellStatusBanner tone="warning">
              This audit is still open and the blocked artifact should be treated as quarantined until an operator resolves it.
            </ShellStatusBanner>
          )}

          <ShellSectionCard
            title="Audit context"
            description="Core identifiers, provenance, and resolution metadata for the quarantined artifact."
            contentClassName="space-y-4"
          >
            <ShellFactTileGrid
              items={[
                {
                  label: "Audit id",
                  value: audit.id,
                  detail: audit.source_kind,
                },
                {
                  label: "Source",
                  value: audit.source_name || audit.source_id || "n/a",
                  detail: audit.source_id || "No source id",
                },
                {
                  label: "Blocked owner",
                  value: audit.blocked_artifact_owner_kind || "n/a",
                  detail: audit.blocked_artifact_owner_id || "No owner id",
                },
                {
                  label: "Artifact id",
                  value: audit.blocked_artifact_id || "n/a",
                  detail: audit.artifact_id || "No audit artifact id",
                },
                {
                  label: "Project",
                  value: audit.project_id || "n/a",
                  detail: audit.orchestrator_session_id || "No session id",
                },
                {
                  label: "Resolution",
                  value: resolutionValue(audit, "outcome"),
                  detail: resolutionValue(audit, "note"),
                },
              ]}
            />
          </ShellSectionCard>

          <ShellSectionCard
            title={`Findings (${audit.findings.length})`}
            description="Operator-readable reasons why this artifact was quarantined before downstream use."
            contentClassName="grid gap-3"
          >
            {audit.findings.length > 0 ? (
              audit.findings.map((finding) => (
                <ShellDetailCard key={finding} className="bg-background/70">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div className="text-[13px] leading-6 text-muted-foreground">{finding}</div>
                  </div>
                </ShellDetailCard>
              ))
            ) : (
              <ShellEmptyState
                centered
                icon={<ShieldCheck className="h-5 w-5" />}
                title="No findings recorded"
                description="The audit summary exists, but no individual finding lines were stored for this artifact."
                className="py-10"
              />
            )}
          </ShellSectionCard>

          <ShellSectionCard
            title="Resolution"
            description="Keep resolution explicit. Use a note when releasing or closing a quarantine so future operators understand why."
            contentClassName="space-y-4"
          >
            <ShellComposerTextarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Explain why this quarantine can be released or marked reviewed..."
              disabled={!canResolve || isPending}
            />
            <div className="flex flex-wrap items-center gap-3">
              <ShellPillButton
                type="button"
                tone="outline"
                disabled={!canResolve || isPending}
                onClick={() => void handleResolve("released")}
              >
                Release quarantine
              </ShellPillButton>
              <ShellPillButton
                type="button"
                tone="outline"
                disabled={!canResolve || isPending}
                onClick={() => void handleResolve("resolved")}
              >
                Mark reviewed
              </ShellPillButton>
              {isPending ? (
                <ShellInlineStatus
                  busy
                  label={
                    busyActionKey?.includes("released")
                      ? "Releasing quarantine..."
                      : "Saving audit resolution..."
                  }
                />
              ) : null}
            </div>
          </ShellSectionCard>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ContentPreview
              title="Blocked artifact content"
              content={audit.blocked_artifact?.content}
              fallback="No blocked artifact payload is available for this audit."
            />
            <ContentPreview
              title="Audit artifact content"
              content={audit.audit_artifact?.content}
              fallback="No audit artifact payload is available for this audit."
            />
          </div>

          <ShellSectionCard
            title={`Linked action runs (${snapshot.linkedRuns.length})`}
            description="Execution-plane runs that carried or exposed this shadow audit."
            contentClassName="grid gap-3"
          >
            {snapshot.linkedRunsError ? (
              <ShellStatusBanner tone="danger">
                {sanitizeAuditError(snapshot.linkedRunsError)}
              </ShellStatusBanner>
            ) : null}
            {snapshot.linkedRuns.length > 0 ? (
              snapshot.linkedRuns.map((run) => (
                <RelatedRunCard
                  key={run.id}
                  runId={run.id}
                  createdAt={run.created_at}
                  status={run.status}
                  completionState={run.completion_state}
                  runKind={run.run_kind}
                  projectId={run.project_ids[0] ?? audit.project_id}
                  routeScope={routeScope}
                />
              ))
            ) : (
              <ShellEmptyState
                centered
                icon={<ArrowRight className="h-5 w-5" />}
                title="No linked action runs"
                description="This audit detail loaded, but no action-run context was recovered from the current execution-plane feed."
                className="py-10"
              />
            )}
          </ShellSectionCard>
        </>
      )}
    </ShellPage>
  );
}

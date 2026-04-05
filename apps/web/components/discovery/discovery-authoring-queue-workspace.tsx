"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  CheckCircle2,
  Orbit,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellEmptyState,
  ShellFilterChipButton,
  ShellFilterChipLink,
  ShellHero,
  ShellLoadingState,
  ShellPage,
  ShellQueueSectionCard,
  ShellRefreshButton,
  ShellRefreshStateCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  ShellRecordAccessory,
  ShellRecordActionBar,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordLinkButton,
  ShellRecordSection,
} from "@/components/shell/shell-record-primitives";
import {
  matchesShellChainRouteScope,
  shellChainRouteScope,
} from "@/lib/chain-graph";
import type {
  ShellDiscoveryAuthoringQueueRecord,
  ShellDiscoveryAuthoringQueueSnapshot,
} from "@/lib/discovery-authoring-queue";
import {
  discoveryAuthoringGapLabel,
  discoveryAuthoringStatusTone,
} from "@/lib/discovery-authoring";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { fetchShellDiscoveryAuthoringQueueSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildDiscoveryAuthoringScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryIdeasScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildInboxScopeHref,
  buildSettingsScopeHref,
  hasShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type DiscoveryAuthoringQueueRouteScope = ShellRouteScope;
type AuthoringFilter =
  | "needs_work"
  | "all"
  | "ready"
  | "linked"
  | "attention"
  | "evidence"
  | "validation"
  | "decision"
  | "timeline";

const EMPTY_DISCOVERY_AUTHORING_QUEUE_SNAPSHOT: ShellDiscoveryAuthoringQueueSnapshot = {
  generatedAt: "",
  records: [],
  stats: {
    totalCount: 0,
    readyCount: 0,
    needsWorkCount: 0,
    linkedCount: 0,
    attentionLinkedCount: 0,
    evidenceGapCount: 0,
    validationGapCount: 0,
    decisionGapCount: 0,
    timelineGapCount: 0,
  },
  error: null,
  loadState: "ready",
};

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncate(value: string, limit: number = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1).trimEnd()}...`;
}

function stageTone(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "simulated" || stage === "debated") return "warning" as const;
  return "neutral" as const;
}

function matchesFilter(
  record: ShellDiscoveryAuthoringQueueRecord,
  filter: AuthoringFilter
) {
  if (filter === "all") {
    return true;
  }
  if (filter === "needs_work") {
    return record.authoring.gapCount > 0;
  }
  if (filter === "ready") {
    return record.authoring.gapCount === 0;
  }
  if (filter === "linked") {
    return Boolean(record.chain);
  }
  if (filter === "attention") {
    return (record.chain?.attention?.total ?? 0) > 0;
  }
  return record.authoring.gaps.includes(filter);
}

function buildScopedStats(records: ShellDiscoveryAuthoringQueueRecord[]) {
  return {
    totalCount: records.length,
    readyCount: records.filter((record) => record.authoring.gapCount === 0).length,
    needsWorkCount: records.filter((record) => record.authoring.gapCount > 0).length,
    linkedCount: records.filter((record) => Boolean(record.chain)).length,
    attentionLinkedCount: records.filter(
      (record) => (record.chain?.attention?.total ?? 0) > 0
    ).length,
    evidenceGapCount: records.filter((record) =>
      record.authoring.gaps.includes("evidence")
    ).length,
    validationGapCount: records.filter((record) =>
      record.authoring.gaps.includes("validation")
    ).length,
    decisionGapCount: records.filter((record) =>
      record.authoring.gaps.includes("decision")
    ).length,
    timelineGapCount: records.filter((record) =>
      record.authoring.gaps.includes("timeline")
    ).length,
  };
}

function AuthoringQueueRecordCard({
  record,
  routeScope,
}: {
  record: ShellDiscoveryAuthoringQueueRecord;
  routeScope: DiscoveryAuthoringQueueRouteScope;
}) {
  const scopedRoute = record.chain
    ? shellChainRouteScope(record.chain, routeScope)
    : routeScope;
  const authoringHref = buildDiscoveryIdeaAuthoringScopeHref(
    record.dossier.idea.idea_id,
    scopedRoute
  );
  const settingsHref = buildSettingsScopeHref(scopedRoute, {
    discoveryIdeaId: record.dossier.idea.idea_id,
  });

  return (
    <ShellRecordCard>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone={stageTone(record.dossier.idea.latest_stage)}>
              {record.dossier.idea.latest_stage}
            </Badge>
            <Badge tone={discoveryAuthoringStatusTone(record.authoring.status)}>
              authoring {record.authoring.status}
            </Badge>
            {record.chain ? <Badge tone="info">chain-linked</Badge> : null}
            {record.chain?.project ? (
              <Badge
                tone={
                  record.chain.project.status === "running"
                    ? "success"
                    : record.chain.project.status === "paused"
                      ? "warning"
                      : record.chain.project.status === "failed"
                        ? "danger"
                        : "neutral"
                }
              >
                {record.chain.project.status}
              </Badge>
            ) : null}
            {(record.chain?.attention?.total ?? 0) > 0 ? (
              <Badge tone="warning">{record.chain?.attention?.total} attention</Badge>
            ) : null}
          </>
        }
        title={record.dossier.idea.title}
        description={truncate(
          record.dossier.idea.summary ||
            record.dossier.idea.thesis ||
            record.authoring.headline,
          260
        )}
        accessory={
          <ShellRecordAccessory
            label="Coverage"
            value={`${Math.round(record.authoring.coverageScore * 100)}%`}
            detail={`updated ${formatDate(record.authoring.lastUpdatedAt)}`}
          />
        }
      />

      <ShellRecordBody>
        <ShellRecordSection
          title="Coverage gap"
          className="bg-[color:var(--shell-panel-muted)]/40"
        >
          <div className="flex flex-wrap items-center gap-2">
            {record.authoring.gaps.length > 0 ? (
              record.authoring.gaps.map((gap) => (
                <Badge key={gap} tone="warning">
                  {discoveryAuthoringGapLabel(gap)}
                </Badge>
              ))
            ) : (
              <Badge tone="success">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                ready
              </Badge>
            )}
          </div>
          <div className="mt-2 text-[13px] font-medium leading-5 text-foreground">
            {record.authoring.headline}
          </div>
          <div className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
            {record.authoring.detail}
          </div>
        </ShellRecordSection>

        {record.chain ? (
          <ShellRecordSection
            title="Execution-chain context"
            className="bg-[color:var(--shell-panel-muted)]/32"
          >
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">brief {record.chain.briefId}</Badge>
              {record.chain.project ? (
                <Badge tone="neutral">{record.chain.project.name}</Badge>
              ) : null}
              {record.chain.intakeSession ? (
                <Badge tone="neutral">{record.chain.intakeSession.title}</Badge>
              ) : null}
            </div>
          </ShellRecordSection>
        ) : null}

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <ShellRecordSection title="Observations">
            <div className="text-[20px] font-medium leading-none text-foreground">
              {record.authoring.observationCount}
            </div>
          </ShellRecordSection>
          <ShellRecordSection title="Evidence items">
            <div className="text-[20px] font-medium leading-none text-foreground">
              {record.authoring.evidenceCount}
            </div>
          </ShellRecordSection>
          <ShellRecordSection title="Validation">
            <div className="text-[20px] font-medium leading-none text-foreground">
              {record.authoring.validationCount}
            </div>
          </ShellRecordSection>
          <ShellRecordSection title="Decisions">
            <div className="text-[20px] font-medium leading-none text-foreground">
              {record.authoring.decisionCount}
            </div>
          </ShellRecordSection>
          <ShellRecordSection title="Timeline">
            <div className="text-[20px] font-medium leading-none text-foreground">
              {record.authoring.timelineCount}
            </div>
          </ShellRecordSection>
        </div>

        <ShellRecordActionBar>
          <ShellRecordLinkButton href={authoringHref} label="Open authoring route" />
          <ShellRecordLinkButton
            href={buildDiscoveryIdeaScopeHref(record.dossier.idea.idea_id, scopedRoute)}
            label="Open dossier"
          />
          {record.chain?.project ? (
            <ShellRecordLinkButton
              href={buildExecutionProjectScopeHref(record.chain.project.id, scopedRoute)}
              label="Open execution project"
            />
          ) : null}
          {record.chain?.intakeSessionId ? (
            <ShellRecordLinkButton
              href={buildExecutionIntakeScopeHref(
                record.chain.intakeSessionId,
                scopedRoute
              )}
              label="Open intake session"
            />
          ) : null}
          {record.chain ? (
            <ShellRecordLinkButton
              href={buildInboxScopeHref(scopedRoute)}
              label="Open scoped inbox"
            />
          ) : null}
          <ShellRecordLinkButton href={settingsHref} label="Open scoped settings" />
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

export function DiscoveryAuthoringQueueWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope,
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryAuthoringQueueSnapshot | null;
  routeScope: DiscoveryAuthoringQueueRouteScope;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AuthoringFilter>("needs_work");
  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh({
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
      source: "discovery-authoring-queue",
      reason: "manual-refresh",
    },
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const { preferences } = useShellPreferences(initialPreferences);
  const pollInterval = getShellPollInterval(
    "discovery_authoring_queue",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryAuthoringQueueSnapshot(),
    []
  );
  const selectLoadState = useCallback(
    (snapshot: ShellDiscoveryAuthoringQueueSnapshot) => snapshot.loadState,
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_AUTHORING_QUEUE_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });
  const scopeActive = hasShellRouteScope(routeScope);
  const routeScopedRecords = useMemo(
    () =>
      scopeActive
        ? snapshot.records.filter(
            (record) =>
              Boolean(record.chain) &&
              matchesShellChainRouteScope(record.chain!, routeScope)
          )
        : snapshot.records,
    [routeScope, scopeActive, snapshot.records]
  );
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return routeScopedRecords.filter((record) => {
      if (!matchesFilter(record, filter)) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return record.searchText.includes(normalized);
    });
  }, [filter, query, routeScopedRecords]);
  const scopedStats = useMemo(
    () => buildScopedStats(routeScopedRecords),
    [routeScopedRecords]
  );
  return (
    <ShellPage>
      <ShellHero
        eyebrow={<Badge tone="info">Discovery authoring queue</Badge>}
        title="Operator queue for dossiers that still need evidence, validation, decisions, or timeline coverage."
        meta={
          <>
            <span>{routeScopedRecords.length} dossiers in the current scope.</span>
            <span>{scopedStats.needsWorkCount} still need coverage.</span>
            <span>Snapshot {formatDate(snapshot.generatedAt)}</span>
          </>
        }
        actions={
          <>
            <ShellRefreshButton type="button" onClick={refresh} busy={isRefreshing} />
            <ShellFilterChipLink href={buildDiscoveryIdeasScopeHref(routeScope)} label="Ideas" />
            <ShellFilterChipLink href={buildDiscoveryBoardScopeHref(routeScope)} label="Board" />
            <ShellFilterChipLink
              href={buildRememberedDiscoveryReviewScopeHref({
                scope: routeScope,
                preferences,
                bucket: resolveReviewMemoryBucket({ scope: routeScope }),
              })}
              label="Review"
            />
          </>
        }
        aside={
          scopeActive
            ? "Queue state is pinned to the current execution chain, so coverage work, inbox returns, and execution links stay inside the same project and intake context."
            : "Authoring readiness now lives as an explicit operator lane instead of being buried across dossier detail, portfolio, and dashboard summaries."
        }
      />


      {snapshot.error ? (
        <ShellStatusBanner tone="warning">{snapshot.error}</ShellStatusBanner>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <ShellQueueSectionCard
            title="Find the next dossier to complete"
            eyebrow={<div className="text-sm leading-6 text-muted-foreground">Authoring backlog</div>}
            actions={<Badge tone="info">{filteredRecords.length} visible</Badge>}
            searchValue={query}
            onSearchChange={(event) => setQuery(event.target.value)}
            searchPlaceholder="Filter by idea, stage, gap, project, intake, or brief"
            hint={scopeActive ? "scope" : "queue"}
            summary={`${filteredRecords.length} visible after filter`}
            chips={[
              ["needs_work", "Needs work"],
              ["all", "All"],
              ["ready", "Ready"],
              ["linked", "Chain-linked"],
              ["attention", "Attention"],
              ["evidence", "Evidence"],
              ["validation", "Validation"],
              ["decision", "Decision"],
              ["timeline", "Timeline"],
            ].map(([key, label]) => (
              <ShellFilterChipButton
                key={key}
                onClick={() => setFilter(key as AuthoringFilter)}
                label={String(label ?? key ?? "")}
                active={filter === key}
              />
            ))}
          >
              {loadState === "loading" && routeScopedRecords.length === 0 ? (
                <ShellLoadingState description="Loading discovery authoring queue..." />
              ) : null}

              {filteredRecords.map((record) => (
                <AuthoringQueueRecordCard
                  key={record.key}
                  record={record}
                  routeScope={routeScope}
                />
              ))}

              {loadState !== "loading" && filteredRecords.length === 0 ? (
                <ShellEmptyState
                  centered
                  description={
                    scopeActive
                      ? "No authoring queue records match the current route scope and filter."
                      : "No discovery authoring records match the current filter."
                  }
                  className="py-10"
                />
              ) : null}
          </ShellQueueSectionCard>
        </div>

        <div className="space-y-4">

          <ShellRefreshStateCard
            description="The authoring queue polls through the shell-owned same-origin seam."
            busy={loadState === "loading"}
            busyLabel="Queue refresh in progress..."
            idleLabel="Queue idle."
            icon={<Orbit className="h-4 w-4 text-accent" />}
            intervalSeconds={Math.round(pollInterval / 1000)}
            guidance="Use authoring route links whenever the next step is writing evidence, validation, decisions, or timeline updates."
          />
        </div>
      </section>
    </ShellPage>
  );
}

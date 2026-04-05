"use client";

import type {
  ShellPreferences,
  ShellReviewMemoryBucket,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  AlertTriangle,
  ClipboardCheck,
  FileSearch,
  GitBranch,
  Orbit,
  Workflow,
} from "lucide-react";
import Link from "next/link";

import { ShellRecordSection } from "@/components/shell/shell-record-primitives";
import {
  ShellActionStateLabel,
  ShellActionLink,
  ShellFilterChipLink,
  ShellPillButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import { shellChainRouteScope, type ShellChainRecord } from "@/lib/chain-graph";
import type {
  ShellReviewPressureHotspot,
  ShellReviewPressureLaneSummary,
  ShellReviewPressureSummary,
} from "@/lib/review-pressure";
import {
  recommendedReviewPresetForHotspot,
  reviewPresetDefinitions,
} from "@/lib/review-presets";
import {
  describeReviewPassPreference,
  resolveRememberedReviewPass,
} from "@/lib/review-memory";
import {
  buildDiscoveryIdeaAuthoringScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildReviewScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  buildRememberedShellReviewEntryHrefs,
  buildShellEntrySettingsHref,
} from "@/lib/shell-entry-hrefs";
import { shellSettingsParityTargetsFromChainRecord } from "@/lib/settings-parity-targets";
import {
  reviewPressureBusyKey,
  type ReviewPressureActionKind,
} from "@/lib/use-review-pressure-actions";

function hotspotTitle(record: ShellChainRecord) {
  if (record.kind === "linked") {
    return record.idea.title;
  }
  if (record.project?.name) {
    return record.project.name;
  }
  if (record.intakeSession?.title) {
    return record.intakeSession.title;
  }
  return record.intakeSessionId || record.briefId || record.key;
}

function hotspotContext(record: ShellChainRecord) {
  if (record.kind === "linked") {
    return [
      record.project?.name,
      record.intakeSession?.title,
      record.briefId ? `brief ${record.briefId}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (record.kind === "intake-linked") {
    return [record.project?.name, record.intakeSession?.title || record.intakeSessionId]
      .filter(Boolean)
      .join(" · ");
  }

  return [record.project.name, record.intakeSession?.title || record.intakeSessionId]
    .filter(Boolean)
    .join(" · ");
}

function hotspotTone(hotspot: ShellReviewPressureHotspot) {
  if (hotspot.criticalIssueCount > 0) return "danger" as const;
  if (hotspot.issueCount > 0 || hotspot.decisionCount > 0 || hotspot.authoringCount > 0) {
    return "warning" as const;
  }
  if (hotspot.traceCount > 0 || hotspot.handoffCount > 0) return "info" as const;
  return "neutral" as const;
}

function laneIcon(label: string) {
  if (label === "Critical" || label === "Issues") {
    return <AlertTriangle className="h-3.5 w-3.5" />;
  }
  if (label === "Decisions" || label === "Tool review") {
    return <ClipboardCheck className="h-3.5 w-3.5" />;
  }
  if (label === "Trace") {
    return <FileSearch className="h-3.5 w-3.5" />;
  }
  if (label === "Handoff") {
    return <GitBranch className="h-3.5 w-3.5" />;
  }
  if (label === "Authoring") {
    return <Orbit className="h-3.5 w-3.5" />;
  }
  return <Workflow className="h-3.5 w-3.5" />;
}

function laneActions(lane: ShellReviewPressureLaneSummary) {
  if (
    lane.key === "authoring" ||
    lane.key === "trace" ||
    lane.key === "handoff" ||
    lane.key === "followthrough"
  ) {
    return [
      {
        key: "confirm-discovery",
        label: "Confirm",
      },
      {
        key: "reopen-discovery",
        label: "Reopen",
      },
    ] satisfies Array<{ key: ReviewPressureActionKind; label: string }>;
  }

  if (lane.key === "issues" || lane.key === "critical") {
    return [
      {
        key: "resolve-issues",
        label: "Resolve",
      },
    ] satisfies Array<{ key: ReviewPressureActionKind; label: string }>;
  }

  if (lane.key === "approvals") {
    return [
      {
        key: "approve-approvals",
        label: "Approve",
      },
      {
        key: "reject-approvals",
        label: "Reject",
      },
    ] satisfies Array<{ key: ReviewPressureActionKind; label: string }>;
  }

  if (lane.key === "runtimes") {
    return [
      {
        key: "allow-runtimes",
        label: "Allow",
      },
      {
        key: "deny-runtimes",
        label: "Deny",
      },
    ] satisfies Array<{ key: ReviewPressureActionKind; label: string }>;
  }

  return [];
}

function hotspotActions(hotspot: ShellReviewPressureHotspot) {
  const actions: Array<{ key: ReviewPressureActionKind; label: string }> = [];

  if (hotspot.discoveryCount > 0) {
    actions.push(
      { key: "confirm-discovery", label: "Confirm" },
      { key: "reopen-discovery", label: "Reopen" }
    );
  }
  if (hotspot.issueCount > 0) {
    actions.push({ key: "resolve-issues", label: "Resolve issues" });
  }
  if (hotspot.approvalCount > 0) {
    actions.push(
      { key: "approve-approvals", label: "Approve" },
      { key: "reject-approvals", label: "Reject" }
    );
  }
  if (hotspot.runtimeCount > 0) {
    actions.push(
      { key: "allow-runtimes", label: "Allow tools" },
      { key: "deny-runtimes", label: "Deny tools" }
    );
  }

  return actions;
}

export function ReviewPressurePanel({
  title,
  description,
  summary,
  routeScope,
  preferences,
  preferredMemoryBucket,
  emptyDetail,
  busyActionKey,
  errorMessage,
  onRunHotspotAction,
  onRunLaneAction,
  statusMessage,
}: {
  title: string;
  description: string;
  summary: ShellReviewPressureSummary;
  routeScope?: Partial<ShellRouteScope> | null;
  preferences?: Pick<ShellPreferences, "reviewMemory">;
  preferredMemoryBucket?: ShellReviewMemoryBucket | null;
  emptyDetail: string;
  busyActionKey?: string;
  errorMessage?: string | null;
  onRunHotspotAction?: (
    hotspot: ShellReviewPressureHotspot,
    action: ReviewPressureActionKind
  ) => void;
  onRunLaneAction?: (
    laneKey: ShellReviewPressureLaneSummary["key"],
    action: ReviewPressureActionKind
  ) => void;
  statusMessage?: string | null;
}) {
  const rememberedPass =
    preferences &&
    resolveRememberedReviewPass(preferences, preferredMemoryBucket ?? "global");
  const rememberedEntryHrefs =
    preferences &&
    buildRememberedShellReviewEntryHrefs({
      scope: routeScope,
      preferences,
      bucket: preferredMemoryBucket,
    });
  const settingsParityTargets = shellSettingsParityTargetsFromChainRecord(
    summary.hotspots[0]?.chain ?? null
  );
  const scopedSettingsHref = buildShellEntrySettingsHref(routeScope, settingsParityTargets);

  return (
    <ShellSectionCard
      title={title}
      description={summary.totalCount > 0 ? description : emptyDetail}
      actions={
        <>
          <Badge tone={summary.totalCount > 0 ? "warning" : "success"}>
            {summary.totalCount} total
          </Badge>
          <Badge tone="info">{summary.discoveryCount} discovery</Badge>
          <Badge tone="warning">{summary.executionCount} execution</Badge>
          {summary.criticalCount > 0 ? (
            <Badge tone="danger">{summary.criticalCount} critical</Badge>
          ) : null}
          {summary.linkedCount > 0 ? (
            <Badge tone="info">{summary.linkedCount} linked</Badge>
          ) : null}
          {summary.unlinkedCount > 0 ? (
            <Badge tone="neutral">{summary.unlinkedCount} unlinked</Badge>
          ) : null}
        </>
      }
      headerChildren={
        <>
          <div className="flex flex-wrap gap-3 text-sm font-medium">
            <ShellActionLink
              href={rememberedEntryHrefs?.reviewHref ?? buildReviewScopeHref(routeScope)}
              label="Open review center"
            />
            {rememberedPass ? (
              <Badge tone="neutral">
                default {describeReviewPassPreference(rememberedPass)}
              </Badge>
            ) : null}
            <ShellActionLink
              href={
                rememberedEntryHrefs?.discoveryReviewHref ??
                buildReviewScopeHref(routeScope, "discovery")
              }
              label="Open discovery review"
            />
            <ShellActionLink
              href={
                rememberedEntryHrefs?.executionReviewHref ??
                buildReviewScopeHref(routeScope, "execution")
              }
              label="Open execution review"
            />
            <ShellActionLink href={scopedSettingsHref} label="Open scoped settings" />
          </div>
          <div className="flex flex-wrap gap-2">
            {reviewPresetDefinitions().map((preset) => (
              <ShellFilterChipLink
                key={preset.key}
                href={buildReviewScopeHref(routeScope, null, preset.key)}
                label={preset.label}
                active={rememberedPass?.preset === preset.key}
              />
            ))}
          </div>
        </>
      }
      className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(91,79,241,0.05),rgba(28,130,247,0.05)_46%,rgba(255,255,255,0.72)_100%)] dark:bg-[linear-gradient(135deg,rgba(91,79,241,0.09),rgba(28,130,247,0.06)_46%,rgba(8,18,35,0.84)_100%)]"
      headerClassName="gap-3"
      contentClassName="space-y-4"
      titleClassName="text-2xl leading-tight"
    >
        {statusMessage ? (
          <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
        ) : null}
        {errorMessage ? (
          <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
        ) : null}
        {summary.lanes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summary.lanes.map((lane) => {
              const actions = laneActions(lane);
              return (
                <div
                  key={lane.key}
                  className="flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-2 py-2"
                >
                  <Link
                    href={buildReviewScopeHref(routeScope, lane.lane)}
                    className="inline-flex items-center gap-2 px-1 text-xs font-medium text-foreground transition-colors hover:text-accent"
                  >
                    <span className="text-muted-foreground">{laneIcon(lane.label)}</span>
                    <Badge tone={lane.tone}>{lane.count}</Badge>
                    <span>{lane.label}</span>
                  </Link>
                  {onRunLaneAction && actions.length > 0 ? (
                    <div className="flex items-center gap-1 border-l border-border/70 pl-2">
                      {actions.map((action) => {
                        const actionBusy =
                          busyActionKey ===
                          reviewPressureBusyKey("lane", lane.key, action.key);
                        return (
                          <ShellPillButton
                            key={action.key}
                            type="button"
                            tone="ghost"
                            onClick={() => onRunLaneAction(lane.key, action.key)}
                            disabled={actionBusy}
                            compact
                            className="px-2"
                          >
                            <ShellActionStateLabel
                              busy={actionBusy}
                              idleLabel={action.label}
                            />
                          </ShellPillButton>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {summary.hotspots.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {summary.hotspots.map((hotspot) => {
              const scopedChainRoute = shellChainRouteScope(hotspot.chain, routeScope);
              const ideaAuthoringHref =
                hotspot.chain.kind === "linked"
                  ? buildDiscoveryIdeaAuthoringScopeHref(
                      hotspot.chain.idea.idea_id,
                      scopedChainRoute
                    )
                  : null;
              const projectHref = hotspot.chain.project
                ? buildExecutionProjectScopeHref(
                    hotspot.chain.project.id,
                    scopedChainRoute
                  )
                : null;
              const intakeHref = hotspot.chain.intakeSessionId
                ? buildExecutionIntakeScopeHref(
                    hotspot.chain.intakeSessionId,
                    scopedChainRoute
                  )
                : null;

              return (
                <ShellRecordSection
                  key={hotspot.chain.key}
                  className="bg-background/70"
                  titleClassName="text-inherit"
                  title={
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={hotspotTone(hotspot)}>
                            {hotspot.totalCount} items
                          </Badge>
                          {hotspot.criticalIssueCount > 0 ? (
                            <Badge tone="danger">
                              {hotspot.criticalIssueCount} critical
                            </Badge>
                          ) : null}
                          {hotspot.authoringCount > 0 ? (
                            <Badge tone="warning">
                              {hotspot.authoringCount} authoring
                            </Badge>
                          ) : null}
                          {hotspot.traceCount > 0 ? (
                            <Badge tone="info">{hotspot.traceCount} trace</Badge>
                          ) : null}
                          {hotspot.decisionCount > 0 ? (
                            <Badge tone="warning">
                              {hotspot.decisionCount} decisions
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {hotspotTitle(hotspot.chain)}
                        </div>
                        <div className="text-xs leading-6 text-muted-foreground">
                          {hotspotContext(hotspot.chain)}
                        </div>
                      </div>
                      <ShellActionLink
                        href={buildReviewScopeHref(
                          scopedChainRoute,
                          hotspot.suggestedLane,
                          recommendedReviewPresetForHotspot(hotspot)
                        )}
                        label="Triage whole chain"
                        className="text-xs"
                      />
                    </div>
                  }
                >
                  <div className="mt-3 text-sm leading-6 text-muted-foreground">
                    {hotspot.reason}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
                    {onRunHotspotAction
                      ? hotspotActions(hotspot).map((action) => {
                          const actionBusy =
                            busyActionKey ===
                            reviewPressureBusyKey(
                              "hotspot",
                              hotspot.chain.key,
                              action.key
                            );
                          return (
                            <ShellPillButton
                              key={action.key}
                              type="button"
                              tone="outline"
                              onClick={() => onRunHotspotAction(hotspot, action.key)}
                              disabled={actionBusy}
                            >
                              <ShellActionStateLabel
                                busy={actionBusy}
                                idleLabel={action.label}
                              />
                            </ShellPillButton>
                          );
                        })
                      : null}
                    {projectHref ? (
                      <ShellActionLink
                        href={projectHref}
                        label="Open project"
                        className="text-xs"
                      />
                    ) : null}
                    {intakeHref ? (
                      <ShellActionLink
                        href={intakeHref}
                        label="Open intake"
                        className="text-xs"
                      />
                    ) : null}
                    {ideaAuthoringHref ? (
                      <ShellActionLink
                        href={ideaAuthoringHref}
                        label="Open authoring"
                        className="text-xs"
                      />
                    ) : null}
                  </div>
                </ShellRecordSection>
              );
            })}
          </div>
        ) : null}
    </ShellSectionCard>
  );
}

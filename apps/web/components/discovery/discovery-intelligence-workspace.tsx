"use client";

import type { ShellPreferences } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  FolderSearch2,
  GitBranch,
  Network,
  Sparkles,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionStateLabel,
  ShellActionLink,
  ShellComposerTextarea,
  ShellDetailCard,
  ShellEmptyState,
  ShellFactTileGrid,
  ShellHero,
  ShellHeroSearchField,
  ShellInputField,
  ShellInlineStatus,
  ShellListLink,
  ShellLoadingState,
  ShellMetricCard,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSelectField,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  runDiscoveryRepoDigest,
  runDiscoveryRepoGraph,
} from "@/lib/discovery-intelligence-mutations";
import {
  emptyShellDiscoveryIntelligenceSnapshot,
  type ShellDiscoveryIntelligenceRecord,
  type ShellDiscoveryIntelligenceSnapshot,
} from "@/lib/discovery-intelligence-model";
import { safeFormatDate, safeFormatRelativeTime } from "@/lib/format-utils";
import {
  buildDiscoveryIntelligenceProfileScopeHref,
  buildDiscoveryIntelligenceScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellDiscoveryIntelligenceSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";

const EMPTY_INTELLIGENCE_SNAPSHOT = emptyShellDiscoveryIntelligenceSnapshot();

function sanitizeError(error: string | null) {
  if (!error) return null;

  const normalized = error.toLowerCase();
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return "Quorum repo intelligence is unavailable right now. Check the upstream connection in Settings, then refresh this route.";
  }

  return error;
}

function parseDelimitedList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesQuery(record: ShellDiscoveryIntelligenceRecord, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const profile = record.profile;
  return [
    profile.profile_id,
    profile.repo_name,
    profile.source,
    profile.languages.join(" "),
    profile.domain_clusters.join(" "),
    profile.recurring_pain_areas.join(" "),
    profile.repeated_builds.join(" "),
    profile.adjacent_product_opportunities.join(" "),
    record.latestGraph?.graphId ?? "",
    record.latestGraph?.repoName ?? "",
  ].some((field) => field.toLowerCase().includes(normalized));
}

function complexityTone(value: string) {
  if (value === "very_high") return "danger" as const;
  if (value === "high") return "warning" as const;
  if (value === "medium") return "info" as const;
  return "neutral" as const;
}

function sourceTone(value: string) {
  if (value === "github") return "info" as const;
  if (value === "local") return "success" as const;
  return "neutral" as const;
}

function IntelligenceRecordCard({
  record,
  selected,
  routeScope,
}: {
  record: ShellDiscoveryIntelligenceRecord;
  selected: boolean;
  routeScope: ShellRouteScope;
}) {
  const profile = record.profile;
  const href = buildDiscoveryIntelligenceProfileScopeHref(
    profile.profile_id,
    routeScope
  );

  return (
    <ShellListLink
      href={href}
      className={selected ? "border-primary/30 bg-primary/[0.06]" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {profile.repo_name}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {profile.source}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={sourceTone(record.latestGraph ? "github" : "local")}>
            {record.latestGraph ? "graph ready" : "digest only"}
          </Badge>
          <Badge tone={complexityTone(profile.preferred_complexity)}>
            {profile.preferred_complexity}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-muted-foreground">
        {profile.domain_clusters.slice(0, 3).map((cluster) => (
          <span
            key={cluster}
            className="rounded-full border border-[color:var(--shell-control-border)] px-2 py-0.5"
          >
            {cluster}
          </span>
        ))}
        {profile.languages.slice(0, 3).map((language) => (
          <span
            key={language}
            className="rounded-full border border-[color:var(--shell-control-border)] px-2 py-0.5"
          >
            {language}
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-2 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>Generated {safeFormatRelativeTime(profile.generated_at, safeFormatDate(profile.generated_at))}</span>
        <span>
          {record.graphCount > 0
            ? `${record.graphCount} deep graph ${record.graphCount === 1 ? "run" : "runs"}`
            : "No repo graph yet"}
        </span>
      </div>
    </ShellListLink>
  );
}

function TokenList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <ShellDetailCard className="bg-background/70">
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[12px] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-[12px] leading-6 text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </ShellDetailCard>
  );
}

export function DiscoveryIntelligenceWorkspace({
  profileId = null,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  profileId?: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryIntelligenceSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const {
    busyActionKey,
    errorMessage,
    refreshNonce: mutationRefreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner(
    {
      planes: ["discovery"],
      scope: routeScope,
      source: "discovery-intelligence",
      reason: "repo-intelligence",
    },
    {
      fallbackErrorMessage: "Repo intelligence action failed.",
    }
  );
  const pollIntervalMs = getShellPollInterval(
    "discovery_ideas",
    preferences.refreshProfile
  );
  const {
    isRefreshing,
    refresh,
    refreshNonce: manualRefreshNonce,
  } = useShellManualRefresh();
  const [query, setQuery] = useState("");
  const [repoSource, setRepoSource] = useState(
    initialSnapshot?.selectedDigest?.profile.source ||
      initialSnapshot?.records[0]?.profile.source ||
      ""
  );
  const [repoBranch, setRepoBranch] = useState(
    initialSnapshot?.selectedDigest?.digest.branch || ""
  );
  const [issueText, setIssueText] = useState("");
  const [maxFiles, setMaxFiles] = useState("250");
  const [hotFileLimit, setHotFileLimit] = useState("8");
  const [graphTrigger, setGraphTrigger] = useState("explicit");
  const [refreshMode, setRefreshMode] = useState("cache");
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryIntelligenceSnapshot(profileId),
    [profileId]
  );
  const selectLoadState = useCallback(
    (snapshot: ShellDiscoveryIntelligenceSnapshot) =>
      profileId
        ? snapshot.selectedDigestLoadState === "ready" ||
          snapshot.selectedDigestLoadState === "idle"
          ? "ready"
          : "error"
        : snapshot.recordsLoadState,
    [profileId]
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_INTELLIGENCE_SNAPSHOT,
    initialSnapshot,
    refreshNonce: manualRefreshNonce + mutationRefreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const error = sanitizeError(
    errorMessage ||
    snapshot.recordsError ||
      snapshot.selectedDigestError ||
      snapshot.selectedGraphError
  );
  const records = useMemo(
    () => snapshot.records.filter((record) => matchesQuery(record, query)),
    [query, snapshot.records]
  );
  const selectedRecord = useMemo(
    () =>
      snapshot.records.find(
        (record) => record.profile.profile_id === snapshot.selectedProfileId
      ) ?? null,
    [snapshot.records, snapshot.selectedProfileId]
  );
  const selectedDigest = snapshot.selectedDigest;
  const selectedGraph = snapshot.selectedGraph;
  const graphCoverageCount = snapshot.records.filter(
    (record) => record.latestGraph
  ).length;
  const warningCount =
    (selectedDigest?.warnings.length ?? 0) + (selectedGraph?.warnings.length ?? 0);
  const intelligenceHref = buildDiscoveryIntelligenceScopeHref(routeScope);
  const normalizedSource = repoSource.trim();
  const parsedMaxFiles = Math.max(1, Number.parseInt(maxFiles, 10) || 250);
  const parsedHotFileLimit = Math.max(
    1,
    Number.parseInt(hotFileLimit, 10) || 8
  );
  const issueTexts = parseDelimitedList(issueText);
  const canRunIntelligence = normalizedSource.length > 0;

  return (
    <ShellPage>
      <ShellHero
        title="Repo Intelligence"
        description="Quorum RepoDNA and repo-graph outputs are now surfaced as shell-native discovery routes, so operators can audit repository signals and deep-dive coverage without leaving FounderOS."
        meta={
          <>
            <span>{snapshot.records.length} tracked repos</span>
            <span>{graphCoverageCount} with deep graph coverage</span>
            <span>{warningCount} active warnings on the selected repo</span>
          </>
        }
        actions={
          <>
            {profileId ? (
              <ShellActionLink href={intelligenceHref} label="All repos" />
            ) : null}
            <ShellRefreshButton busy={isRefreshing} onClick={refresh} />
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <ShellMetricCard
          label="RepoDNA Profiles"
          value={String(snapshot.records.length)}
          detail="Latest repository digests and derived builder priors."
        />
        <ShellMetricCard
          label="Deep Graph Coverage"
          value={String(graphCoverageCount)}
          detail="Repos with at least one repo-graph deep dive already materialized."
        />
        <ShellMetricCard
          label="Selected Warnings"
          value={String(warningCount)}
          detail="Digest and graph warnings surfaced on the active repo detail."
        />
      </div>

      {error ? (
        <ShellStatusBanner tone="warning">{error}</ShellStatusBanner>
      ) : null}
      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      <ShellSectionCard
        title="Run New Analysis"
        description="Kick off fast RepoDNA digest or deeper repo-graph analysis through shell-owned discovery actions."
        contentClassName="space-y-4"
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <ShellInputField
                value={repoSource}
                onChange={(event) => setRepoSource(event.target.value)}
                placeholder="Repo source path or GitHub URL"
              />
              <ShellInputField
                value={repoBranch}
                onChange={(event) => setRepoBranch(event.target.value)}
                placeholder="Branch (optional)"
              />
            </div>
            <ShellComposerTextarea
              value={issueText}
              onChange={(event) => setIssueText(event.target.value)}
              placeholder="Issue prompts for the analyzer, one per line or comma-separated"
              className="min-h-[116px]"
            />
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <ShellInputField
                value={maxFiles}
                onChange={(event) => setMaxFiles(event.target.value)}
                placeholder="Max files"
                inputMode="numeric"
              />
              <ShellInputField
                value={hotFileLimit}
                onChange={(event) => setHotFileLimit(event.target.value)}
                placeholder="Hot file limit"
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <ShellSelectField
                value={graphTrigger}
                onChange={(event) => setGraphTrigger(event.target.value)}
              >
                <option value="explicit">Graph trigger: explicit</option>
                <option value="promoted">Graph trigger: promoted</option>
                <option value="background">Graph trigger: background</option>
              </ShellSelectField>
              <ShellSelectField
                value={refreshMode}
                onChange={(event) => setRefreshMode(event.target.value)}
              >
                <option value="cache">Use cache when available</option>
                <option value="refresh">Force upstream refresh</option>
              </ShellSelectField>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ShellPillButton
            type="button"
            tone="primary"
            disabled={!canRunIntelligence || Boolean(busyActionKey)}
            onClick={() =>
              runMutation("repo-digest", () =>
                runDiscoveryRepoDigest({
                  request: {
                    source: normalizedSource,
                    branch: repoBranch.trim() || null,
                    issue_texts: issueTexts,
                    max_files: parsedMaxFiles,
                    hot_file_limit: parsedHotFileLimit,
                    refresh: refreshMode === "refresh",
                  },
                  routeScope,
                })
              )
            }
          >
            <ShellActionStateLabel
              busy={busyActionKey === "repo-digest"}
              idleLabel="Run RepoDNA Digest"
              busyLabel="Running digest..."
              icon={<FolderSearch2 className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            disabled={!canRunIntelligence || Boolean(busyActionKey)}
            onClick={() =>
              runMutation("repo-graph", () =>
                runDiscoveryRepoGraph({
                  request: {
                    source: normalizedSource,
                    branch: repoBranch.trim() || null,
                    issue_texts: issueTexts,
                    max_files: parsedMaxFiles,
                    refresh: refreshMode === "refresh",
                    trigger: graphTrigger as "explicit" | "promoted" | "background",
                  },
                  routeScope,
                })
              )
            }
          >
            <ShellActionStateLabel
              busy={busyActionKey === "repo-graph"}
              idleLabel="Run Repo Graph"
              busyLabel="Running graph..."
              icon={<Network className="h-4 w-4" />}
            />
          </ShellPillButton>
        </div>
      </ShellSectionCard>

      {loadState === "loading" && snapshot.records.length === 0 ? (
        <ShellLoadingState
          title="Loading repo intelligence"
          description="Pulling RepoDNA profiles and repo-graph coverage from Quorum."
        />
      ) : null}

      {loadState !== "loading" && snapshot.records.length === 0 ? (
        <ShellEmptyState
          centered
          icon={<FolderSearch2 className="h-5 w-5" />}
          title="No repo intelligence yet"
          description="Run a Quorum repo digest or repo graph analysis first, then this shell route will surface the resulting intelligence here."
        />
      ) : null}

      {snapshot.records.length > 0 ? (
        <>
          <ShellSectionCard
            title={selectedDigest?.profile.repo_name || selectedRecord?.profile.repo_name || "Selected repo"}
            description="RepoDNA summary, digest evidence, and deep graph outputs for the current repository."
            actions={
              selectedGraph ? (
                <ShellInlineStatus
                  icon={<Network className="h-4 w-4" />}
                  label={`Graph ${selectedGraph.graph_id} · ${selectedGraph.stats.node_count} nodes`}
                />
              ) : undefined
            }
            contentClassName="space-y-4"
          >
            {selectedDigest ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Source",
                          value: <Badge tone={sourceTone(selectedDigest.digest.source_type)}>{selectedDigest.digest.source_type}</Badge>,
                          detail: selectedDigest.digest.source,
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Generated",
                          value: safeFormatRelativeTime(selectedDigest.digest.generated_at, safeFormatDate(selectedDigest.digest.generated_at)),
                          detail: safeFormatDate(selectedDigest.digest.generated_at),
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Complexity",
                          value: <Badge tone={complexityTone(selectedDigest.profile.preferred_complexity)}>{selectedDigest.profile.preferred_complexity}</Badge>,
                          detail: `${selectedDigest.profile.languages.length} languages`,
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Graph Coverage",
                          value: selectedRecord?.latestGraph ? "ready" : "pending",
                          detail: selectedRecord?.latestGraph
                            ? `${selectedRecord.graphCount} deep graph runs`
                            : "No repo graph result yet",
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <TokenList
                    title="Domain Clusters"
                    items={selectedDigest.profile.domain_clusters}
                    emptyLabel="No domain clusters were inferred for this repo yet."
                  />
                  <TokenList
                    title="Repeated Builds"
                    items={selectedDigest.profile.repeated_builds}
                    emptyLabel="Repeated build motifs are not available yet."
                  />
                  <TokenList
                    title="Recurring Pain Areas"
                    items={selectedDigest.profile.recurring_pain_areas}
                    emptyLabel="Recurring pain areas are not available yet."
                  />
                  <TokenList
                    title="Adjacent Opportunities"
                    items={selectedDigest.profile.adjacent_product_opportunities}
                    emptyLabel="Adjacent product opportunities are not available yet."
                  />
                </div>

                <ShellSectionCard
                  title="Digest Evidence"
                  description="Hot files, issue themes, and README claims surfaced by the fast RepoDNA digest."
                  contentClassName="space-y-4"
                >
                  <div className="grid gap-3 xl:grid-cols-2">
                    <ShellDetailCard className="bg-background/70">
                      <div className="text-[13px] font-medium text-foreground">Hot Files</div>
                      {selectedDigest.digest.hot_files.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {selectedDigest.digest.hot_files.slice(0, 6).map((file) => (
                            <div
                              key={file.path}
                              className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3"
                            >
                              <div className="text-[12px] font-medium text-foreground">
                                {file.path}
                              </div>
                              <div className="mt-1 text-[12px] text-muted-foreground">
                                {file.language || "unknown"} · {file.line_count} lines · score {file.importance_score.toFixed(2)}
                              </div>
                              {file.reasons.length > 0 ? (
                                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                                  {file.reasons.slice(0, 2).join(" · ")}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-[12px] leading-6 text-muted-foreground">
                          No hot files were extracted for this digest yet.
                        </div>
                      )}
                    </ShellDetailCard>

                    <ShellDetailCard className="bg-background/70">
                      <div className="text-[13px] font-medium text-foreground">Issue Themes</div>
                      {selectedDigest.digest.issue_themes.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {selectedDigest.digest.issue_themes.slice(0, 6).map((theme) => (
                            <div
                              key={theme.label}
                              className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[12px] font-medium text-foreground">
                                  {theme.label}
                                </div>
                                <Badge tone="warning">{theme.frequency}</Badge>
                              </div>
                              <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                                {theme.evidence.slice(0, 2).join(" · ") || "No evidence lines stored."}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-[12px] leading-6 text-muted-foreground">
                          No issue themes were extracted for this digest yet.
                        </div>
                      )}
                    </ShellDetailCard>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    <TokenList
                      title="README Claims"
                      items={selectedDigest.digest.readme_claims}
                      emptyLabel="No README claims were extracted."
                    />
                    <TokenList
                      title="Key Paths"
                      items={selectedDigest.digest.key_paths}
                      emptyLabel="No key paths were extracted."
                    />
                  </div>
                </ShellSectionCard>

                {selectedGraph ? (
                  <ShellSectionCard
                    title="Repo Graph Deep Dive"
                    description="Startup territories, risk hotspots, and evidence trails synthesized by the deeper repo graph analysis."
                    contentClassName="space-y-4"
                  >
                    <div className="grid gap-3 xl:grid-cols-2">
                      <TokenList
                        title="Startup Territories"
                        items={selectedGraph.deep_dive.startup_territories}
                        emptyLabel="No startup territories were generated."
                      />
                      <TokenList
                        title="Adjacency Opportunities"
                        items={selectedGraph.deep_dive.adjacency_opportunities}
                        emptyLabel="No adjacency opportunities were generated."
                      />
                      <TokenList
                        title="Architectural Focus"
                        items={selectedGraph.deep_dive.architectural_focus}
                        emptyLabel="No architectural focus areas were generated."
                      />
                      <TokenList
                        title="Risk Hotspots"
                        items={selectedGraph.deep_dive.risk_hotspots}
                        emptyLabel="No risk hotspots were generated."
                      />
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                      <ShellDetailCard className="bg-background/70">
                        <div className="text-[13px] font-medium text-foreground">Communities</div>
                        {selectedGraph.communities.length > 0 ? (
                          <div className="mt-3 space-y-3">
                            {selectedGraph.communities.slice(0, 6).map((community) => (
                              <div
                                key={community.community_id}
                                className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3"
                              >
                                <div className="text-[12px] font-medium text-foreground">
                                  {community.title}
                                </div>
                                <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
                                  {community.summary}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-[12px] leading-6 text-muted-foreground">
                            No graph communities were generated.
                          </div>
                        )}
                      </ShellDetailCard>

                      <ShellDetailCard className="bg-background/70">
                        <div className="text-[13px] font-medium text-foreground">Evidence Trails</div>
                        {selectedGraph.deep_dive.evidence_trails.length > 0 ? (
                          <div className="mt-3 space-y-3">
                            {selectedGraph.deep_dive.evidence_trails
                              .slice(0, 6)
                              .map((trail) => (
                                <div
                                  key={trail.trail_id}
                                  className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-3"
                                >
                                  <div className="text-[12px] font-medium text-foreground">
                                    {trail.thesis}
                                  </div>
                                  <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
                                    {trail.explanation}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-[12px] leading-6 text-muted-foreground">
                            No evidence trails were generated.
                          </div>
                        )}
                      </ShellDetailCard>
                    </div>
                  </ShellSectionCard>
                ) : (
                  <ShellStatusBanner tone="warning">
                    RepoDNA is available for this repository, but no repo-graph deep dive has been materialized yet.
                  </ShellStatusBanner>
                )}
              </>
            ) : (
              <ShellEmptyState
                centered
                icon={<GitBranch className="h-5 w-5" />}
                title="Repo detail unavailable"
                description="The repo list loaded, but the selected digest detail could not be recovered from Quorum."
                className="py-12"
              />
            )}
          </ShellSectionCard>

          <ShellSectionCard
            title="Tracked Repositories"
            description="Latest RepoDNA profiles with graph coverage hints and quick drill-ins."
            contentClassName="space-y-4"
          >
            <ShellHeroSearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter repos by name, source, language, or domain..."
            />

            {records.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {records.map((record) => (
                  <IntelligenceRecordCard
                    key={record.profile.profile_id}
                    record={record}
                    selected={record.profile.profile_id === snapshot.selectedProfileId}
                    routeScope={routeScope}
                  />
                ))}
              </div>
            ) : (
              <ShellEmptyState
                centered
                icon={<Sparkles className="h-5 w-5" />}
                title="No matching repos"
                description="Adjust the query to see the tracked RepoDNA profiles again."
                className="py-12"
              />
            )}
          </ShellSectionCard>
        </>
      ) : null}
    </ShellPage>
  );
}

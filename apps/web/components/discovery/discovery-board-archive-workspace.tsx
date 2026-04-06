"use client";

import {
  archiveDiscoveryIdeaRecord,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import type {
  QuorumArchiveCheckpointDigest,
  QuorumDiscoveryIdea,
  QuorumIdeaArchiveCell,
  QuorumPromptEvolutionProfile,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { useCallback, useMemo, useState } from "react";

import {
  ShellRecordAccessory,
  ShellRecordActionBar,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordLinkButton,
  ShellRecordMeta,
  ShellRecordSection,
  ShellRecordSelectionButton,
} from "@/components/shell/shell-record-primitives";
import {
  ShellComposerTextarea,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellInputField,
  ShellPage,
  ShellActionStateLabel,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryArchiveSnapshot } from "@/lib/discovery-board-history";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { safeFormatDate } from "@/lib/format-utils";
import { fetchShellDiscoveryArchiveSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import {
  buildDiscoveryBoardFinalsScopeHref,
  buildDiscoveryBoardRankingScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";

type DiscoveryBoardArchiveRouteScope = ShellRouteScope;

const EMPTY_DISCOVERY_ARCHIVE_SNAPSHOT: ShellDiscoveryArchiveSnapshot = {
  generatedAt: "",
  archive: null,
  archiveError: null,
  archiveLoadState: "ready",
  leaderboard: null,
  leaderboardError: null,
  leaderboardLoadState: "ready",
  ideas: [],
  ideasError: null,
  ideasLoadState: "ready",
  errors: [],
  loadState: "ready",
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value?: string | null) {
  return safeFormatDate(value, "n/a");
}

function stageTone(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "simulated" || stage === "debated") return "warning" as const;
  if (stage === "archived") return "danger" as const;
  return "neutral" as const;
}

function ArchiveCellRow({
  cell,
  routeScope,
}: {
  cell: QuorumIdeaArchiveCell;
  routeScope: DiscoveryBoardArchiveRouteScope;
}) {
  return (
    <ShellRecordCard>
      <ShellRecordHeader
        badges={<Badge tone="info">{cell.key}</Badge>}
        title={cell.elite.title}
        description={`${cell.domain} · ${cell.complexity} · ${cell.distribution_strategy}`}
        accessory={
          <ShellRecordAccessory
            label="Buyer"
            value={cell.buyer_type}
            detail={`fitness ${cell.elite.fitness.toFixed(2)}`}
          />
        }
      />
      <ShellRecordBody>
        <ShellRecordMeta>
          <span>{cell.elite.idea_id}</span>
          <span>novelty {cell.elite.novelty_score.toFixed(2)}</span>
        </ShellRecordMeta>
        <ShellRecordActionBar>
          <ShellRecordLinkButton
            href={buildDiscoveryIdeaScopeHref(cell.elite.idea_id, routeScope)}
            label="Open dossier"
          />
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

function PromptProfileRow({ profile }: { profile: QuorumPromptEvolutionProfile }) {
  return (
    <ShellRecordCard>
      <ShellRecordHeader
        title={profile.label}
        description={profile.operator_kind}
        accessory={
          <ShellRecordAccessory
            label="Elo"
            value={Math.round(profile.elo_rating)}
            detail={`${profile.usage_count} uses`}
          />
        }
      />
      <ShellRecordBody>
        <ShellRecordMeta>
          <span>{profile.profile_id}</span>
          <span>
            {profile.wins}-{profile.losses}-{profile.ties}
          </span>
        </ShellRecordMeta>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

function CheckpointRow({ item }: { item: QuorumArchiveCheckpointDigest }) {
  return (
    <ShellRecordCard>
      <ShellRecordHeader
        title={`Generation ${item.generation}`}
        accessory={
          <ShellRecordAccessory
            label="Coverage"
            value={percent(item.coverage)}
            detail={`QD ${item.qd_score.toFixed(2)}`}
          />
        }
      />
      <ShellRecordBody>
        <ShellRecordMeta>
          <span>{item.filled_cells} filled cells</span>
          <span>{formatDate(item.created_at)}</span>
        </ShellRecordMeta>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

function ArchiveCandidateRow({
  idea,
  selected,
  onSelect,
  routeScope,
}: {
  idea: QuorumDiscoveryIdea;
  selected: boolean;
  onSelect: (ideaId: string) => void;
  routeScope: DiscoveryBoardArchiveRouteScope;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(idea.idea_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(idea.idea_id);
        }
      }}
      className="w-full cursor-pointer text-left"
    >
      <ShellRecordCard selected={selected}>
        <ShellRecordHeader
          badges={<Badge tone={stageTone(idea.latest_stage)}>{idea.latest_stage}</Badge>}
          title={idea.title}
          description={idea.summary || idea.thesis || idea.description}
          accessory={
            <div className="flex items-start gap-2">
              <ShellRecordAccessory
                label="Score"
                value={`rank ${percent(idea.rank_score)}`}
                detail={`belief ${percent(idea.belief_score)}`}
              />
              <div onClick={(event) => event.stopPropagation()}>
                <ShellRecordSelectionButton
                  selected={selected}
                  onClick={() => onSelect(idea.idea_id)}
                  label={selected ? "Deselect archive candidate" : "Select archive candidate"}
                />
              </div>
            </div>
          }
        />
        <ShellRecordBody>
          <ShellRecordMeta>
            <span>{idea.idea_id}</span>
            <span>{idea.source}</span>
            <span>{formatDate(idea.updated_at)}</span>
          </ShellRecordMeta>
          {idea.topic_tags.length ? (
            <ShellRecordSection title="Signals">
              <div className="flex flex-wrap gap-2">
                {idea.topic_tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            </ShellRecordSection>
          ) : null}
          <div onClick={(event) => event.stopPropagation()}>
            <ShellRecordActionBar>
              <ShellRecordLinkButton
                href={buildDiscoveryIdeaScopeHref(idea.idea_id, routeScope)}
                label="Open dossier"
                className="pointer-events-auto"
              />
              <ShellRecordLinkButton
                href={buildDiscoveryIdeaAuthoringScopeHref(idea.idea_id, routeScope)}
                label="Open authoring"
                className="pointer-events-auto"
              />
            </ShellRecordActionBar>
          </div>
        </ShellRecordBody>
      </ShellRecordCard>
    </div>
  );
}

export function DiscoveryBoardArchiveWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryArchiveSnapshot | null;
  routeScope?: DiscoveryBoardArchiveRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const reviewHref = useMemo(
    () =>
      buildRememberedDiscoveryReviewScopeHref({
        scope: routeScope,
        preferences,
        bucket: resolveReviewMemoryBucket({ scope: routeScope }),
      }),
    [preferences, routeScope]
  );
  const {
    busyActionKey,
    errorMessage,
    refreshClient,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner<DiscoveryMutationEffect>({
    planes: ["discovery"],
    scope: routeScope,
    source: "discovery-board-archive",
    reason: "discovery-board-archive-mutation",
  }, {
    fallbackErrorMessage: "Archive action failed.",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["discovery-board-archive"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "discovery_archive",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(() => fetchShellDiscoveryArchiveSnapshot(), []);
  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryArchiveSnapshot) => nextSnapshot.loadState,
    []
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_ARCHIVE_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  const [archiveIdeaId, setArchiveIdeaId] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [supersededByIdeaId, setSupersededByIdeaId] = useState("");

  const archiveableIdeas = useMemo(() => {
    const seenIdeaIds = new Set<string>();
    const rankedIdeas =
      snapshot.leaderboard?.items
        .map((item) => item.idea)
        .filter((idea) => {
          if (idea.validation_state === "archived" || seenIdeaIds.has(idea.idea_id)) {
            return false;
          }
          seenIdeaIds.add(idea.idea_id);
          return true;
        }) ?? [];

    const extraIdeas = snapshot.ideas.filter((idea) => {
      if (idea.validation_state === "archived" || seenIdeaIds.has(idea.idea_id)) {
        return false;
      }
      seenIdeaIds.add(idea.idea_id);
      return true;
    });

    return [...rankedIdeas, ...extraIdeas].slice(0, 16);
  }, [snapshot.ideas, snapshot.leaderboard]);

  const selectedIdeaId = archiveIdeaId || archiveableIdeas[0]?.idea_id || "";
  const selectedIdea = useMemo(
    () =>
      archiveableIdeas.find((idea) => idea.idea_id === selectedIdeaId) ?? null,
    [archiveableIdeas, selectedIdeaId]
  );
  const archivedIdeaCount = snapshot.ideas.filter(
    (idea) => idea.validation_state === "archived"
  ).length;
  const archive = snapshot.archive;
  const errors = [...snapshot.errors, errorMessage ?? ""].filter(Boolean);

  const handleArchive = useCallback(() => {
    if (!selectedIdeaId) {
      return;
    }

    void runMutation(
      `archive:${selectedIdeaId}`,
      () =>
        archiveDiscoveryIdeaRecord({
          ideaId: selectedIdeaId,
          reason: archiveReason,
          supersededByIdeaId: supersededByIdeaId.trim() || null,
          routeScope,
          source: "discovery-board-archive",
        }),
      {
        onSuccess: () => {
          setArchiveIdeaId("");
          setArchiveReason("");
          setSupersededByIdeaId("");
        },
      }
    );
  }, [
    archiveReason,
    routeScope,
    runMutation,
    selectedIdeaId,
    supersededByIdeaId,
  ]);

  return (
    <ShellPage className="max-w-[1600px]">
      <div className="flex items-center justify-end gap-2">
        <ShellRefreshButton type="button" onClick={() => refreshClient()} />
        {[
          [buildDiscoveryBoardScopeHref(routeScope), "Board"],
          [buildDiscoveryBoardRankingScopeHref(routeScope), "Ranking"],
          [buildDiscoveryBoardFinalsScopeHref(routeScope), "Finals"],
          [reviewHref, "Review"],
        ].map(([href, label]) => (
          <ShellFilterChipLink
            key={String(href)}
            href={String(href)}
            label={String(label)}
          />
        ))}
      </div>

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}


      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <ShellSectionCard
          title="Archive frontier"
          contentClassName="grid gap-4"
        >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Occupied niches
                </div>
                {archive?.cells.length ? (
                  archive.cells.slice(0, 8).map((cell) => (
                    <ArchiveCellRow
                      key={cell.cell_id}
                      cell={cell}
                      routeScope={routeScope}
                    />
                  ))
                ) : (
                  <ShellEmptyState description="Archive cells are not available yet." />
                )}
              </div>
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Generation checkpoints
                </div>
                {archive?.checkpoints.length ? (
                  archive.checkpoints.slice(0, 8).map((item) => (
                    <CheckpointRow key={item.checkpoint_id} item={item} />
                  ))
                ) : (
                  <ShellEmptyState description="Archive checkpoints are not available yet." />
                )}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Prompt profiles
                </div>
                {archive?.prompt_profiles.length ? (
                  archive.prompt_profiles.slice(0, 6).map((profile) => (
                    <PromptProfileRow key={profile.profile_id} profile={profile} />
                  ))
                ) : (
                  <ShellEmptyState description="No prompt evolution profiles have landed yet." />
                )}
              </div>
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Archive recommendations
                </div>
                {archive?.recommendations.length ? (
                  archive.recommendations.slice(0, 6).map((item) => (
                    <ShellRecordCard key={item.recommendation_id}>
                      <ShellRecordHeader
                        title={item.headline}
                        description={item.description}
                      />
                      <ShellRecordBody>
                        <ShellRecordSection title="Target axes">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(item.target_axes)
                              .slice(0, 3)
                              .map(([label, value]) => (
                                <Badge key={`${item.recommendation_id}:${label}`} tone="neutral">
                                  {label}: {String(value)}
                                </Badge>
                              ))}
                          </div>
                        </ShellRecordSection>
                      </ShellRecordBody>
                    </ShellRecordCard>
                  ))
                ) : (
                  <ShellEmptyState description="No archive recommendations are visible yet." />
                )}
              </div>
            </div>
        </ShellSectionCard>

        <ShellSectionCard
          title="Archive candidate"
          contentClassName="space-y-4"
        >
            <div className="space-y-3">
              {archiveableIdeas.length ? (
                archiveableIdeas.slice(0, 8).map((idea) => (
                  <ArchiveCandidateRow
                    key={idea.idea_id}
                    idea={idea}
                    selected={idea.idea_id === selectedIdeaId}
                    onSelect={setArchiveIdeaId}
                    routeScope={routeScope}
                  />
                ))
              ) : (
                <ShellEmptyState description="No active discovery ideas are ready to archive yet." />
              )}
            </div>
            <ShellRecordSection title="Archive note" className="p-4">
              <div className="space-y-3">
                <ShellComposerTextarea
                  value={archiveReason}
                  onChange={(event) => setArchiveReason(event.target.value)}
                  placeholder="Why should this idea move into the archive frontier?"
                  className="min-h-[104px]"
                />
                <ShellInputField
                  value={supersededByIdeaId}
                  onChange={(event) => setSupersededByIdeaId(event.target.value)}
                  placeholder="Optional superseded by idea id"
                />
                <ShellPillButton
                  type="button"
                  tone="primary"
                  disabled={Boolean(busyActionKey) || !selectedIdea}
                  onClick={handleArchive}
                >
                  <ShellActionStateLabel
                    busy={Boolean(busyActionKey)}
                    idleLabel="Archive selected idea"
                    busyLabel="Archive selected idea"
                  />
                </ShellPillButton>
              </div>
            </ShellRecordSection>
        </ShellSectionCard>
      </section>

    </ShellPage>
  );
}

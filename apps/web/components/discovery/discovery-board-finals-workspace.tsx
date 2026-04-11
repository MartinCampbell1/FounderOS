"use client";

import {
  resolveDiscoveryRankingFinals,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import type {
  QuorumFinalVoteBallot,
  QuorumFinalVoteResult,
  QuorumRankedIdeaRecord,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { Crown } from "lucide-react";
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
  ShellEmptyState,
  ShellFilterChipLink,
  ShellPage,
  ShellActionStateLabel,
  ShellPillButton,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellDiscoveryFinalsSnapshot } from "@/lib/discovery-board-history";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { fetchShellDiscoveryFinalsSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import {
  buildDiscoveryBoardArchiveScopeHref,
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

type DiscoveryBoardFinalsRouteScope = ShellRouteScope;

const EMPTY_DISCOVERY_FINALS_SNAPSHOT: ShellDiscoveryFinalsSnapshot = {
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

function stageTone(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "simulated" || stage === "debated") return "warning" as const;
  return "neutral" as const;
}

function metricValue(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }
  return value.toFixed(2);
}

function buildShellFinalsBallots(
  finalists: QuorumRankedIdeaRecord[]
): QuorumFinalVoteBallot[] {
  const ideaIds = finalists.map((item) => item.idea.idea_id);
  if (ideaIds.length < 2) {
    return [];
  }

  const meritIds = [...finalists]
    .sort((left, right) => {
      const meritDelta = right.merit_score - left.merit_score;
      if (meritDelta !== 0) {
        return meritDelta;
      }
      return right.rating - left.rating;
    })
    .map((item) => item.idea.idea_id);

  const stabilityIds = [...finalists]
    .sort((left, right) => {
      const stabilityDelta = right.stability_score - left.stability_score;
      if (stabilityDelta !== 0) {
        return stabilityDelta;
      }
      return right.rating - left.rating;
    })
    .map((item) => item.idea.idea_id);

  return [
    {
      voter_id: "shell-finals-leaderboard",
      ranked_idea_ids: ideaIds,
      weight: 1,
      judge_source: "system",
      judge_model: "shell-leaderboard-order",
      confidence: 0.84,
      agent_importance_score: 1,
    },
    {
      voter_id: "shell-finals-merit",
      ranked_idea_ids: meritIds,
      weight: 0.8,
      judge_source: "system",
      judge_model: "shell-merit-order",
      confidence: 0.76,
      agent_importance_score: 0.9,
    },
    {
      voter_id: "shell-finals-stability",
      ranked_idea_ids: stabilityIds,
      weight: 0.7,
      judge_source: "system",
      judge_model: "shell-stability-order",
      confidence: 0.72,
      agent_importance_score: 0.85,
    },
  ];
}

function FinalsCandidateCard({
  item,
  selected,
  onToggle,
  routeScope,
}: {
  item: QuorumRankedIdeaRecord;
  selected: boolean;
  onToggle: (ideaId: string) => void;
  routeScope: DiscoveryBoardFinalsRouteScope;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggle(item.idea.idea_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(item.idea.idea_id);
        }
      }}
      className="w-full cursor-pointer text-left"
    >
      <ShellRecordCard selected={selected}>
        <ShellRecordHeader
          badges={<Badge tone={stageTone(item.idea.latest_stage)}>{item.idea.latest_stage}</Badge>}
          title={`#${item.rank_position} ${item.idea.title}`}
          description={item.idea.summary || item.idea.thesis || item.idea.description}
          accessory={
            <div className="flex items-start gap-2">
              <ShellRecordAccessory
                label="Rating"
                value={metricValue(item.rating)}
                detail={`${percent(item.stability_score)} stable`}
              />
              <div onClick={(event) => event.stopPropagation()}>
                <ShellRecordSelectionButton
                  selected={selected}
                  onClick={() => onToggle(item.idea.idea_id)}
                  label={selected ? "Deselect finals candidate" : "Select finals candidate"}
                />
              </div>
            </div>
          }
        />
        <ShellRecordBody>
          <ShellRecordMeta>
            <span>{item.idea.idea_id}</span>
            <span>{item.idea.source}</span>
            <span>{percent(item.merit_score)} merit</span>
          </ShellRecordMeta>
          {item.idea.topic_tags.length ? (
            <ShellRecordSection title="Signals">
              <div className="flex flex-wrap gap-2">
                {item.idea.topic_tags.slice(0, 4).map((tag) => (
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
                href={buildDiscoveryIdeaScopeHref(item.idea.idea_id, routeScope)}
                label="Open dossier"
              />
              <ShellRecordLinkButton
                href={buildDiscoveryIdeaAuthoringScopeHref(item.idea.idea_id, routeScope)}
                label="Open authoring"
              />
            </ShellRecordActionBar>
          </div>
        </ShellRecordBody>
      </ShellRecordCard>
    </div>
  );
}

function FinalsResultPanel({
  result,
  finalists,
  routeScope,
}: {
  result: QuorumFinalVoteResult;
  finalists: QuorumRankedIdeaRecord[];
  routeScope: DiscoveryBoardFinalsRouteScope;
}) {
  const finalistsById = new Map(finalists.map((item) => [item.idea.idea_id, item]));

  return (
    <ShellStatusBanner tone="success" className="overflow-hidden p-0">
      <div className="space-y-2 border-b border-emerald-500/15 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Crown className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          <span>Resolved finals</span>
        </div>
        <div className="text-sm leading-7 text-muted-foreground">
          Winner {result.winner_idea_id || "not selected"} · {result.rounds.length} rounds
        </div>
      </div>
      <div className="grid gap-4 px-5 py-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <ShellRecordCard>
            <ShellRecordHeader
              title={
                result.winner_idea_id
                  ? finalistsById.get(result.winner_idea_id)?.idea.title ||
                    result.winner_idea_id
                  : "No winner"
              }
              description="Winner"
              accessory={
                <ShellRecordAccessory
                  label="Rounds"
                  value={result.rounds.length}
                  detail="Resolved in shell"
                />
              }
            />
            <ShellRecordBody>
              {result.winner_idea_id ? (
                <ShellRecordActionBar>
                  <ShellRecordLinkButton
                    href={buildDiscoveryIdeaScopeHref(result.winner_idea_id, routeScope)}
                    label="Open winning dossier"
                  />
                </ShellRecordActionBar>
              ) : null}
            </ShellRecordBody>
          </ShellRecordCard>
          <div className="grid gap-3">
            {result.rounds.map((round) => (
              <ShellRecordCard key={`round:${round.round_number}`}>
                <ShellRecordHeader
                  title={`Round ${round.round_number}`}
                  accessory={
                    <ShellRecordAccessory
                      label="Weight"
                      value={round.total_weight.toFixed(2)}
                    />
                  }
                />
                <ShellRecordBody>
                  <ShellRecordSection title="Tallies">
                    <div className="space-y-2 text-[13px] leading-6 text-muted-foreground">
                      {Object.entries(round.tallies).map(([ideaId, score]) => (
                        <div key={`${round.round_number}:${ideaId}`}>
                          {finalistsById.get(ideaId)?.idea.title || ideaId}: {score.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  </ShellRecordSection>
                </ShellRecordBody>
              </ShellRecordCard>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Aggregate rankings
          </div>
          {result.aggregate_rankings.length ? (
            result.aggregate_rankings.map((entry, index) => (
              <ShellRecordCard key={`${entry.idea_id}:${index}`}>
                <ShellRecordHeader
                  badges={<Badge tone="info">#{index + 1}</Badge>}
                  title={finalistsById.get(entry.idea_id)?.idea.title || entry.idea_id}
                  description={`Average rank ${entry.average_rank.toFixed(2)} across ${entry.rankings_count} ballots`}
                />
              </ShellRecordCard>
            ))
          ) : (
            <ShellEmptyState description="Finals resolved without aggregate rankings." />
          )}
        </div>
      </div>
    </ShellStatusBanner>
  );
}

export function DiscoveryBoardFinalsWorkspace({
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryFinalsSnapshot | null;
  routeScope?: DiscoveryBoardFinalsRouteScope;
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
    source: "discovery-board-finals",
    reason: "discovery-board-finals-mutation",
  }, {
    fallbackErrorMessage: "Finals resolution failed.",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["discovery-board-finals"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "discovery_finals",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(() => fetchShellDiscoveryFinalsSnapshot(), []);
  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryFinalsSnapshot) => nextSnapshot.loadState,
    []
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_FINALS_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [finalsResult, setFinalsResult] = useState<QuorumFinalVoteResult | null>(null);

  const leaderboardItems = snapshot.leaderboard?.items.slice(0, 8) ?? [];
  const defaultCandidateIds = leaderboardItems
    .slice(0, Math.min(4, leaderboardItems.length))
    .map((item) => item.idea.idea_id);
  const effectiveSelectedIds =
    selectedCandidateIds.length > 0 ? selectedCandidateIds : defaultCandidateIds;
  const selectedFinalists = leaderboardItems.filter((item) =>
    effectiveSelectedIds.includes(item.idea.idea_id)
  );
  const ballots = buildShellFinalsBallots(selectedFinalists);
  const errors = [...snapshot.errors, errorMessage ?? ""].filter(Boolean);

  function toggleCandidate(ideaId: string) {
    setSelectedCandidateIds((current) => {
      const base = current.length > 0 ? current : defaultCandidateIds;
      return base.includes(ideaId)
        ? base.filter((entry) => entry !== ideaId)
        : [...base, ideaId];
    });
  }

  function handleResolve() {
    if (selectedFinalists.length < 2 || ballots.length === 0) {
      return;
    }

    void runMutation(
      "finals:resolve",
      () =>
        resolveDiscoveryRankingFinals({
          candidateIdeaIds: selectedFinalists.map((item) => item.idea.idea_id),
          ballots,
          routeScope,
          source: "discovery-board-finals",
        }),
      {
        onSuccess: (effect) => {
          setFinalsResult(effect.finalsResult ?? null);
        },
      }
    );
  }

  return (
    <ShellPage className="max-w-[1600px]">
      <div className="flex items-center justify-end gap-2">
        <ShellRefreshButton type="button" onClick={() => refreshClient()} />
        {[
          [buildDiscoveryBoardScopeHref(routeScope), "Board", false],
          [buildDiscoveryBoardRankingScopeHref(routeScope), "Ranking", false],
          [buildDiscoveryBoardArchiveScopeHref(routeScope), "Archive", false],
          [buildDiscoveryBoardFinalsScopeHref(routeScope), "Finals", true],
          [reviewHref, "Review", false],
        ].map(([href, label, active]) => (
          <ShellFilterChipLink
            key={String(href)}
            href={String(href)}
            label={String(label)}
            active={Boolean(active)}
          />
        ))}
      </div>

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm shadow-black/5 dark:bg-card/40">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Shortlist
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {leaderboardItems.length} ranked ideas
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedFinalists.length} selected · {ballots.length} ballots staged
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm shadow-black/5 dark:bg-card/40">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Resolution
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {selectedFinalists.length >= 2 ? "Ready to resolve" : "Select at least two"}
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedFinalists.length >= 2
              ? "Ballots will preserve verdict flow."
              : "Ballots stay disabled until there is enough signal."}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm shadow-black/5 dark:bg-card/40">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Review
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {routeScope.projectId || routeScope.intakeSessionId
              ? "Scoped finals"
              : "Unscoped finals"}
          </div>
          <div className="text-xs text-muted-foreground">
            Review memory and board links stay intact.
          </div>
        </div>
      </div>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <ShellSectionCard
          title="Finalists shortlist"
          contentClassName="space-y-2"
        >
          {leaderboardItems.length ? (
            leaderboardItems.map((item) => (
              <FinalsCandidateCard
                key={item.idea.idea_id}
                item={item}
                selected={effectiveSelectedIds.includes(item.idea.idea_id)}
                onToggle={toggleCandidate}
                routeScope={routeScope}
              />
            ))
          ) : (
            <ShellEmptyState description="Ranking candidates are not available yet." />
          )}
        </ShellSectionCard>

        <ShellSectionCard
          title="Shell finals ballots"
          contentClassName="space-y-3"
        >
          <div className="space-y-3">
            {ballots.length ? (() => {
              const finalistsById = new Map(selectedFinalists.map((item) => [item.idea.idea_id, item.idea.title]));
              return ballots.map((ballot) => (
                <ShellRecordCard key={ballot.voter_id}>
                  <ShellRecordHeader
                    title={ballot.judge_model}
                    description={ballot.ranked_idea_ids.map((id) => finalistsById.get(id) ?? id.slice(0, 8)).join(" -> ")}
                    accessory={
                      <ShellRecordAccessory
                        label="Weight"
                        value={ballot.weight.toFixed(2)}
                      />
                    }
                  />
                  <ShellRecordBody>
                    <ShellRecordMeta>
                      <span>{ballot.voter_id}</span>
                      <span>{ballot.judge_source}</span>
                      <span>{ballot.confidence?.toFixed(2) ?? "n/a"} confidence</span>
                    </ShellRecordMeta>
                  </ShellRecordBody>
                </ShellRecordCard>
              ));
            })() : (
              <ShellEmptyState description="Select at least two finalists to generate shell ballots." />
            )}
          </div>
          <ShellPillButton
            type="button"
            tone="primary"
            disabled={Boolean(busyActionKey) || selectedFinalists.length < 2}
            onClick={handleResolve}
          >
            <ShellActionStateLabel
              busy={busyActionKey === "finals:resolve"}
              idleLabel="Resolve finals in shell"
              busyLabel="Resolve finals in shell"
            />
          </ShellPillButton>
        </ShellSectionCard>
      </section>

      {finalsResult ? (
        <FinalsResultPanel
          result={finalsResult}
          finalists={selectedFinalists}
          routeScope={routeScope}
        />
      ) : null}

    </ShellPage>
  );
}

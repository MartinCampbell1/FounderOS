"use client";

import {
  type QuorumDiscoveryIdea,
  type QuorumIdeaDossier,
  type ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import { AlertCircle, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellLoadingState,
  ShellPage,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import {
  executionSourceLabel,
  executionSourceTone,
} from "@/lib/attention-records";
import {
  shellChainRouteScope,
  type LinkedShellChainRecord,
} from "@/lib/chain-graph";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { resolveDiscoveryIdeaAutoOpenHref } from "@/lib/shell-route-intents";
import { fetchShellDiscoveryIdeasSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  buildDashboardScopeHref,
  buildDiscoveryAuthoringScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryBoardSimulationIdeaScopeHref,
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildInboxScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ShellDiscoveryIdeasSnapshot } from "@/lib/discovery";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";

type LoadState = "idle" | "loading" | "ready" | "error";
type DiscoveryIdeasRouteScope = ShellRouteScope;

function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.max(1, Math.floor(diffSeconds / 60))}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
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

function stageDotColor(stage: string) {
  if (stage === "executed" || stage === "handed_off") return "bg-emerald-500";
  if (stage === "simulated") return "bg-blue-500";
  if (stage === "debated") return "bg-amber-500";
  if (stage === "ranked" || stage === "swiped") return "bg-violet-500";
  return "bg-muted-foreground/50";
}

function outcomeTone(status: string) {
  if (status === "validated") return "success" as const;
  if (status === "in_progress") return "info" as const;
  if (status === "stalled" || status === "pivot_candidate") return "warning" as const;
  if (status === "invalidated" || status === "execution_trap" || status === "cost_trap") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function projectStatusTone(status: string) {
  if (status === "running") return "success" as const;
  if (status === "paused") return "warning" as const;
  if (status === "completed") return "info" as const;
  if (status === "failed") return "danger" as const;
  return "neutral" as const;
}

function scopeForOutcomeProject(
  projectId: string,
  routeScope: DiscoveryIdeasRouteScope
): DiscoveryIdeasRouteScope {
  return {
    projectId,
    intakeSessionId: routeScope.projectId === projectId ? routeScope.intakeSessionId : "",
  };
}

const EMPTY_DISCOVERY_IDEAS_SNAPSHOT: ShellDiscoveryIdeasSnapshot = {
  generatedAt: "",
  ideas: [],
  ideasError: null,
  ideasLoadState: "ready",
  chains: [],
  chainsError: null,
  chainsLoadState: "ready",
  dossier: null,
  dossierError: null,
  dossierLoadState: "idle",
};

function DiscoveryIdeasList({
  ideas,
  chainsByIdeaId,
  activeIdeaId,
  loadState,
  error,
  chainsError,
  reviewHref,
  routeScope,
}: {
  ideas: QuorumDiscoveryIdea[];
  chainsByIdeaId: Map<string, LinkedShellChainRecord>;
  activeIdeaId: string | null;
  loadState: LoadState;
  error: string | null;
  chainsError: string | null;
  reviewHref: string;
  routeScope: DiscoveryIdeasRouteScope;
}) {
  const [query, setQuery] = useState("");

  const filteredIdeas = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return ideas;
    }

    return ideas.filter((idea) => {
      const chain = chainsByIdeaId.get(idea.idea_id) ?? null;
      return (
        idea.title.toLowerCase().includes(normalized) ||
        idea.idea_id.toLowerCase().includes(normalized) ||
        idea.latest_stage.toLowerCase().includes(normalized) ||
        idea.topic_tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
        (chain?.project?.name || "").toLowerCase().includes(normalized) ||
        (chain?.intakeSession?.title || "").toLowerCase().includes(normalized) ||
        chain?.briefId.toLowerCase().includes(normalized)
      );
    });
  }, [chainsByIdeaId, ideas, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter ideas..."
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
          {filteredIdeas.length}/{ideas.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {chainsError ? (
          <ShellStatusBanner tone="warning">{chainsError}</ShellStatusBanner>
        ) : null}

        {loadState === "loading" && ideas.length === 0 ? (
          <ShellLoadingState description="Loading discovery ideas..." />
        ) : null}

        <div className="divide-y divide-border">
          {filteredIdeas.map((idea) => {
            const isActive = idea.idea_id === activeIdeaId;
            const chain = chainsByIdeaId.get(idea.idea_id) ?? null;
            const scopedChainRoute = chain
              ? shellChainRouteScope(chain, routeScope)
              : routeScope;
            const href = buildDiscoveryIdeaScopeHref(idea.idea_id, scopedChainRoute);
            return (
              <Link
                key={idea.idea_id}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40",
                  isActive && "bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-2 w-2 shrink-0 rounded-full",
                    stageDotColor(idea.latest_stage)
                  )}
                  title={idea.latest_stage}
                />
                <span className="min-w-[72px] shrink-0 text-[12px] text-muted-foreground">
                  {idea.latest_stage}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {idea.title}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  {idea.rank_score > 0 ? Math.round(idea.rank_score) : "\u2014"}
                </span>
                <span className="w-[44px] shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                  {idea.belief_score > 0 ? idea.belief_score.toFixed(2) : "\u2014"}
                </span>
                <span className="w-[52px] shrink-0 text-right text-[12px] text-muted-foreground/60">
                  {formatRelativeTime(idea.updated_at)}
                </span>
              </Link>
            );
          })}
        </div>

        {loadState !== "loading" && filteredIdeas.length === 0 ? (
          <div className="space-y-4">
            <ShellEmptyState
              centered
              className="py-12"
              icon={<Lightbulb className="h-5 w-5" />}
              title={ideas.length === 0 ? "No ideas yet" : "No results"}
              description={
                ideas.length === 0
                  ? "Ideas are generated from discovery sessions. Start a session to populate this list."
                  : "No discovery ideas match the current filter."
              }
            />
            {error ? (
              <div className="mx-auto flex max-w-sm items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-[12px] text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span>Service offline — <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">check connections</Link></span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}


function DossierSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[14px] font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function DiscoveryIdeaMonitor({
  dossier,
  chain,
  chainsError,
  loadState,
  error,
  routeScope,
}: {
  dossier: QuorumIdeaDossier | null;
  chain: LinkedShellChainRecord | null;
  chainsError: string | null;
  loadState: LoadState;
  error: string | null;
  routeScope: DiscoveryIdeasRouteScope;
}) {
  if (loadState === "loading" && !dossier) {
    return <ShellLoadingState description="Loading discovery dossier..." className="py-10" />;
  }

  if (error) {
    return <ShellStatusBanner tone="danger">{error}</ShellStatusBanner>;
  }

  if (!dossier) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center text-[13px] text-muted-foreground">
          Select an idea to view its dossier.
        </div>
      </div>
    );
  }

  const { idea } = dossier;
  const chainRouteScope = chain ? shellChainRouteScope(chain, routeScope) : routeScope;
  const simReport = dossier.simulation_report;
  const marketReport = dossier.market_simulation_report;
  const explainability = dossier.explainability_context;
  const evidenceItems = dossier.evidence_bundle?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{idea.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              stageDotColor(idea.latest_stage)
            )}
          />
          <Badge tone={stageTone(idea.latest_stage)}>{idea.latest_stage}</Badge>
          <span className="text-[13px] tabular-nums text-muted-foreground">
            rank {Math.round(idea.rank_score)}
          </span>
          <span className="text-[13px] tabular-nums text-muted-foreground">
            belief {idea.belief_score.toFixed(2)}
          </span>
          {idea.topic_tags.slice(0, 4).map((tag) => (
            <Badge key={tag} tone="neutral">{tag}</Badge>
          ))}
          <span className="text-[12px] text-muted-foreground/60">
            {formatRelativeTime(idea.updated_at)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ShellActionLink
            href={buildDiscoveryIdeaAuthoringScopeHref(idea.idea_id, chainRouteScope)}
            label="Authoring"
          />
          <ShellActionLink
            href={buildDiscoveryBoardSimulationIdeaScopeHref(idea.idea_id, chainRouteScope)}
            label="Simulation"
          />
          {chain?.project ? (
            <ShellActionLink
              href={buildExecutionProjectScopeHref(chain.project.id, chainRouteScope)}
              label="Execution"
            />
          ) : null}
        </div>
      </div>

      {chainsError ? <ShellStatusBanner tone="warning">{chainsError}</ShellStatusBanner> : null}

      {/* Thesis */}
      <DossierSection title="Thesis">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {idea.thesis || idea.summary || "No thesis recorded."}
        </p>
        {idea.summary && idea.thesis && idea.summary !== idea.thesis ? (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/70">
            {idea.summary}
          </p>
        ) : null}
      </DossierSection>

      {/* Evidence */}
      {(dossier.observations.length > 0 || dossier.validation_reports.length > 0 || evidenceItems.length > 0) ? (
        <DossierSection title="Evidence">
          {dossier.observations.length > 0 ? (
            <div className="space-y-2">
              {dossier.observations.slice(0, 5).map((item) => (
                <div
                  key={item.observation_id}
                  className="rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-foreground">{item.source}</span>
                    {item.evidence_confidence ? (
                      <span className="text-[11px] text-muted-foreground/60">{item.evidence_confidence}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {truncate(item.raw_text, 200)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {dossier.validation_reports.length > 0 ? (
            <div className="mt-3 space-y-2">
              {dossier.validation_reports.slice(0, 3).map((item) => (
                <div key={item.report_id} className="flex items-start gap-2">
                  <Badge
                    tone={
                      item.verdict === "pass" ? "success" : item.verdict === "fail" ? "danger" : "warning"
                    }
                  >
                    {item.verdict}
                  </Badge>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">{item.summary}</p>
                </div>
              ))}
            </div>
          ) : null}

          {evidenceItems.length > 0 ? (
            <div className="mt-3 space-y-1">
              {evidenceItems.slice(0, 4).map((item) => (
                <p key={item.evidence_id} className="text-[12px] leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              ))}
            </div>
          ) : null}
        </DossierSection>
      ) : null}

      {/* Risk analysis */}
      {explainability && explainability.ranking_risks.length > 0 ? (
        <DossierSection title="Risk analysis">
          <ul className="space-y-1">
            {explainability.ranking_risks.map((risk) => (
              <li key={risk} className="text-[12px] leading-relaxed text-muted-foreground">
                {risk}
              </li>
            ))}
          </ul>
        </DossierSection>
      ) : null}

      {/* Simulation results */}
      {simReport || marketReport ? (
        <DossierSection title="Simulation results">
          {simReport ? (
            <div className="rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge tone={simReport.verdict === "pass" ? "success" : simReport.verdict === "fail" ? "danger" : "warning"}>
                  {simReport.verdict}
                </Badge>
                <span className="text-[12px] text-muted-foreground">Focus group</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {simReport.summary_headline}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] tabular-nums text-muted-foreground">
                <span>support {(simReport.support_ratio * 100).toFixed(0)}%</span>
                <span>resonance {simReport.average_resonance.toFixed(2)}</span>
                <span>purchase intent {simReport.average_purchase_intent.toFixed(2)}</span>
              </div>
            </div>
          ) : null}
          {marketReport ? (
            <div className="mt-2 rounded-md border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge tone={marketReport.verdict === "pass" ? "success" : marketReport.verdict === "fail" ? "danger" : "warning"}>
                  {marketReport.verdict}
                </Badge>
                <span className="text-[12px] text-muted-foreground">Market simulation</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {marketReport.executive_summary}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] tabular-nums text-muted-foreground">
                <span>adoption {(marketReport.adoption_rate * 100).toFixed(0)}%</span>
                <span>retention {(marketReport.retention_rate * 100).toFixed(0)}%</span>
                <span>market fit {marketReport.market_fit_score.toFixed(2)}</span>
              </div>
            </div>
          ) : null}
        </DossierSection>
      ) : null}

      {/* Explainability */}
      {explainability ? (
        <DossierSection title="Ranking explainability">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {explainability.ranking_summary}
          </p>
          {explainability.ranking_drivers.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {explainability.ranking_drivers.slice(0, 6).map((driver) => (
                <Badge key={driver} tone="neutral">{driver}</Badge>
              ))}
            </div>
          ) : null}
        </DossierSection>
      ) : null}

      {/* Timeline */}
      {dossier.timeline.length > 0 ? (
        <DossierSection title="Timeline">
          <div className="space-y-1">
            {[...dossier.timeline]
              .sort((a, b) => {
                const aTime = Date.parse(a.created_at || "") || 0;
                const bTime = Date.parse(b.created_at || "") || 0;
                return bTime - aTime;
              })
              .slice(0, 10)
              .map((event) => (
                <div
                  key={event.event_id}
                  className="flex items-baseline gap-2 py-1"
                >
                  <span
                    className={cn(
                      "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                      stageDotColor(event.stage)
                    )}
                  />
                  <span className="min-w-[64px] shrink-0 text-[11px] text-muted-foreground/60">
                    {formatRelativeTime(event.created_at)}
                  </span>
                  <span className="text-[12px] text-foreground">{event.title}</span>
                  {event.detail ? (
                    <span className="text-[11px] text-muted-foreground">
                      {truncate(event.detail, 80)}
                    </span>
                  ) : null}
                </div>
              ))}
          </div>
        </DossierSection>
      ) : null}

      {/* Execution outcomes */}
      {dossier.execution_outcomes.length > 0 ? (
        <DossierSection title="Execution outcomes">
          <div className="space-y-2">
            {dossier.execution_outcomes.map((outcome) => (
              <div
                key={outcome.outcome_id}
                className="rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge tone={outcomeTone(outcome.status)}>{outcome.status}</Badge>
                  <Badge tone="neutral">{outcome.verdict}</Badge>
                  <span className="text-[12px] text-muted-foreground">
                    {outcome.autopilot_project_name || outcome.outcome_id}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[12px] tabular-nums text-muted-foreground">
                  <span>{outcome.stories_passed}/{outcome.stories_attempted} stories</span>
                  <span>${outcome.total_cost_usd.toFixed(2)}</span>
                  <span>{Math.round(outcome.total_duration_seconds / 60)}m</span>
                </div>
                {outcome.autopilot_project_id ? (
                  <div className="mt-2">
                    <ShellActionLink
                      href={buildExecutionProjectScopeHref(
                        outcome.autopilot_project_id,
                        scopeForOutcomeProject(outcome.autopilot_project_id, routeScope)
                      )}
                      label="Open project"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </DossierSection>
      ) : null}

      {/* Chain link info */}
      {chain ? (
        <DossierSection title="Linked chain">
          <div className="flex flex-wrap gap-2 text-[12px] text-muted-foreground">
            <Badge tone="info">chain-linked</Badge>
            {chain.project ? (
              <Badge tone={projectStatusTone(chain.project.status)}>
                {chain.project.status}
              </Badge>
            ) : null}
            {chain.project?.task_source ? (
              <Badge tone={executionSourceTone(chain.project.task_source.source_kind)}>
                {executionSourceLabel(chain.project.task_source.source_kind)}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {chain.intakeSessionId ? (
              <ShellActionLink
                href={buildExecutionIntakeScopeHref(chain.intakeSessionId, chainRouteScope)}
                label="Intake"
              />
            ) : null}
            <ShellActionLink href={buildInboxScopeHref(chainRouteScope)} label="Inbox" />
            <ShellActionLink href={buildDashboardScopeHref(chainRouteScope)} label="Dashboard" />
          </div>
        </DossierSection>
      ) : null}
    </div>
  );
}

export function DiscoveryIdeasWorkspace({
  activeIdeaId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  activeIdeaId: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryIdeasSnapshot | null;
  routeScope?: DiscoveryIdeasRouteScope;
}) {
  const router = useRouter();
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
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    invalidation: {
      planes: ["discovery", "execution"],
      resource: {
        discoveryIdeaId: activeIdeaId || "",
      },
      scope: routeScope,
    },
    invalidationOptions: {
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval("discovery_ideas", preferences.refreshProfile);
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryIdeasSnapshot(activeIdeaId),
    [activeIdeaId]
  );
  const selectLoadState = useCallback(
    (snapshot: ShellDiscoveryIdeasSnapshot) =>
      activeIdeaId
        ? snapshot.dossierLoadState === "ready"
          ? "ready"
          : snapshot.dossierLoadState === "idle"
            ? "ready"
            : "error"
        : snapshot.ideasLoadState,
    [activeIdeaId]
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_IDEAS_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });
  const ideas = snapshot.ideas;
  const chains = snapshot.chains;
  const ideasState: LoadState =
    snapshot.ideasLoadState === "ready" ? "ready" : "error";
  const ideasError = snapshot.ideasError;
  const chainsError = snapshot.chainsError;
  const dossier =
    snapshot.dossier?.idea.idea_id === activeIdeaId ? snapshot.dossier : null;
  const chainsByIdeaId = useMemo(
    () => new Map(chains.map((record) => [record.idea.idea_id, record])),
    [chains]
  );
  const activeChain = activeIdeaId ? chainsByIdeaId.get(activeIdeaId) ?? null : null;
  const dossierState: LoadState = activeIdeaId
    ? snapshot.dossierLoadState
    : "idle";
  const dossierError = activeIdeaId ? snapshot.dossierError : null;

  useEffect(() => {
    const nextHref = resolveDiscoveryIdeaAutoOpenHref({
      activeIdeaId,
      ideas,
      routeScope,
    });
    if (!nextHref) {
      return;
    }
    router.replace(nextHref);
  }, [activeIdeaId, ideas, routeScope, router]);

  return (
    <ShellPage className="max-w-[1600px]">
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="tabular-nums">{ideas.length} ideas</span>
          <span className="tabular-nums">{chains.length} linked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShellFilterChipLink
            href={buildDiscoveryAuthoringScopeHref(routeScope)}
            label="Authoring"
          />
          <ShellFilterChipLink href={reviewHref} label="Review" />
          <ShellFilterChipLink
            href={buildDiscoveryBoardScopeHref(routeScope)}
            label="Board"
          />
        </div>
      </div>

      {ideasError && ideas.length === 0 ? (
        <ShellStatusBanner tone="warning">{ideasError}</ShellStatusBanner>
      ) : null}

      <section className="grid min-h-[calc(100vh-245px)] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 xl:block">
          <DiscoveryIdeasList
            ideas={ideas}
            chainsByIdeaId={chainsByIdeaId}
            activeIdeaId={activeIdeaId}
            loadState={ideasState}
            error={ideasError}
            chainsError={chainsError}
            reviewHref={reviewHref}
            routeScope={routeScope}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="xl:hidden">
            <DiscoveryIdeasList
              ideas={ideas}
              chainsByIdeaId={chainsByIdeaId}
              activeIdeaId={activeIdeaId}
              loadState={ideasState}
              error={ideasError}
              chainsError={chainsError}
              reviewHref={reviewHref}
              routeScope={routeScope}
            />
          </div>

          <DiscoveryIdeaMonitor
            dossier={dossier}
            chain={activeChain}
            chainsError={chainsError}
            loadState={dossierState}
            error={dossierError}
            routeScope={routeScope}
          />
        </div>
      </section>
    </ShellPage>
  );
}

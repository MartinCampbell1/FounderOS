"use client";

import {
  addDiscoveryDecisionRecord,
  addDiscoveryObservationRecord,
  addDiscoveryTimelineEventRecord,
  addDiscoveryValidationReportRecord,
  upsertDiscoveryEvidenceBundleRecord,
  type DiscoveryMutationEffect,
} from "@/lib/discovery-mutations";
import type {
  QuorumDiscoveryIdea,
  QuorumEvidenceBundleItemInput,
  QuorumIdeaDossier,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  FileSearch,
  FolderKanban,
  GitBranch,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionStateLabel,
  ShellComposerTextarea,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellInputField,
  ShellListLink,
  ShellPage,
  ShellPillButton,
  ShellRefreshButton,
  ShellSearchSectionCard,
  ShellSectionCard,
  ShellSelectField,
  ShellStatusBanner,
  ShellSubtlePanel,
} from "@/components/shell/shell-screen-primitives";
import {
  shellChainRouteScope,
  type LinkedShellChainRecord,
} from "@/lib/chain-graph";
import type { ShellDiscoveryIdeasSnapshot } from "@/lib/discovery";
import {
  buildRememberedDiscoveryReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import { fetchShellDiscoveryIdeasSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import {
  buildDashboardScopeHref,
  buildDiscoveryAuthoringScopeHref,
  buildDiscoveryBoardScopeHref,
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryIdeasScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildInboxScopeHref,
  buildPortfolioScopeHref,
  buildSettingsScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";

type DiscoveryAuthoringRouteScope = ShellRouteScope;
type DraftEvidenceItem = {
  draftId: string;
  kind: string;
  summary: string;
  rawContent: string;
  artifactPath: string;
  source: string;
  confidence: string;
  tags: string;
};

const EMPTY_DISCOVERY_AUTHORING_SNAPSHOT: ShellDiscoveryIdeasSnapshot = {
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

const CONFIDENCE_OPTIONS = ["high", "medium", "low", "unknown"];
const VERDICT_OPTIONS = ["pass", "partial", "fail", "skip"];
const DECISION_TYPES = [
  "advance",
  "watch",
  "park",
  "reject",
  "handoff",
  "investigate",
];
const DOSSIER_STAGES = [
  "sourced",
  "ranked",
  "debated",
  "simulated",
  "swiped",
  "handed_off",
  "executed",
];

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function truncate(value: string, limit: number = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1).trimEnd()}...`;
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createDraftEvidenceItemId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stageTone(stage: string) {
  if (stage === "executed") return "success" as const;
  if (stage === "handed_off") return "info" as const;
  if (stage === "simulated" || stage === "debated") return "warning" as const;
  if (stage === "swiped") return "neutral" as const;
  return "neutral" as const;
}

function IdeaRail({
  ideas,
  activeIdeaId,
  routeScope,
}: {
  ideas: QuorumDiscoveryIdea[];
  activeIdeaId: string;
  routeScope: DiscoveryAuthoringRouteScope;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredIdeas = normalizedQuery
    ? ideas.filter((idea) => {
        return (
          idea.title.toLowerCase().includes(normalizedQuery) ||
          idea.idea_id.toLowerCase().includes(normalizedQuery) ||
          idea.latest_stage.toLowerCase().includes(normalizedQuery) ||
          idea.topic_tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
        );
      })
    : ideas;

  return (
    <ShellSearchSectionCard
      title="Discovery ideas"
      actions={<Badge tone="info">{ideas.length} total</Badge>}
      searchValue={query}
      onSearchChange={(event) => setQuery(event.target.value)}
      searchPlaceholder="Filter ideas"
      contentClassName="space-y-3"
    >
        {filteredIdeas.length ? (
          filteredIdeas.slice(0, 18).map((idea) => {
            const active = idea.idea_id === activeIdeaId;
            return (
              <ShellListLink
                key={idea.idea_id}
                href={buildDiscoveryIdeaAuthoringScopeHref(idea.idea_id, routeScope)}
                className={active ? "border-primary/35 bg-[color:var(--shell-nav-active)]" : undefined}
              >
                <div className="text-sm font-semibold text-foreground">{idea.title}</div>
                <div className="mt-1 text-xs leading-6 text-muted-foreground">
                  {idea.idea_id} · {idea.latest_stage} · {formatDate(idea.updated_at)}
                </div>
              </ShellListLink>
            );
          })
        ) : (
          <ShellEmptyState description="No discovery ideas match the current filter." />
        )}
    </ShellSearchSectionCard>
  );
}

function LinkedChainPanel({
  chain,
  routeScope,
}: {
  chain: LinkedShellChainRecord | null;
  routeScope: DiscoveryAuthoringRouteScope;
}) {
  if (!chain) {
    return (
      <ShellSectionCard
        title="Cross-plane context"
        contentClassName="pt-0"
      >
        <ShellEmptyState
          description="Link this idea to an execution project."
          className="min-h-[160px]"
          centered
        />
      </ShellSectionCard>
    );
  }

  const scopedRoute = shellChainRouteScope(chain, routeScope);

  return (
    <ShellSectionCard
      title="Cross-plane context"
      contentClassName="space-y-3"
    >
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{chain.briefId}</Badge>
          {chain.project ? (
            <Badge tone="success">{chain.project.status}</Badge>
          ) : (
            <Badge tone="warning">No project yet</Badge>
          )}
          {chain.outcome ? (
            <Badge tone="neutral">{chain.outcome.status}</Badge>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ShellListLink href={buildPortfolioScopeHref(scopedRoute)}>
            <div className="text-sm font-medium text-foreground">Open scoped portfolio</div>
          </ShellListLink>
          <ShellListLink href={buildInboxScopeHref(scopedRoute)}>
            <div className="text-sm font-medium text-foreground">Open scoped inbox</div>
          </ShellListLink>
          {chain.project ? (
            <ShellListLink href={buildExecutionProjectScopeHref(chain.project.id, scopedRoute)}>
              <div className="text-sm font-medium text-foreground">Open execution project</div>
            </ShellListLink>
          ) : null}
          {chain.intakeSession ? (
            <ShellListLink href={buildExecutionIntakeScopeHref(chain.intakeSession.id, scopedRoute)}>
              <div className="text-sm font-medium text-foreground">Open intake session</div>
            </ShellListLink>
          ) : null}
          <ShellListLink
            href={buildSettingsScopeHref(scopedRoute, {
              discoveryIdeaId: chain.idea.idea_id,
            })}
          >
            <div className="text-sm font-medium text-foreground">Open scoped settings</div>
          </ShellListLink>
        </div>
    </ShellSectionCard>
  );
}

function CurrentDossierPanel({
  dossier,
}: {
  dossier: QuorumIdeaDossier;
}) {
  return (
    <ShellSectionCard
      title="Current dossier state"
      contentClassName="space-y-3 text-sm leading-7 text-muted-foreground"
    >
        <ShellSubtlePanel className="p-4">
          <div className="font-medium text-foreground">{dossier.idea.title}</div>
          <div className="mt-2">{truncate(dossier.idea.summary || dossier.idea.thesis || dossier.idea.description)}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={stageTone(dossier.idea.latest_stage)}>{dossier.idea.latest_stage}</Badge>
            <Badge tone="neutral">{percent(dossier.idea.rank_score)} rank</Badge>
            <Badge tone="neutral">{percent(dossier.idea.belief_score)} belief</Badge>
          </div>
        </ShellSubtlePanel>
        {dossier.decisions.length ? (
          <ShellSubtlePanel className="p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Latest decision
            </div>
            <div className="mt-2 font-medium text-foreground">
              {dossier.decisions[0]?.decision_type}
            </div>
            <div className="mt-1">{truncate(dossier.decisions[0]?.rationale || "")}</div>
          </ShellSubtlePanel>
        ) : null}
    </ShellSectionCard>
  );
}

export function DiscoveryIdeaAuthoringWorkspace({
  activeIdeaId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  activeIdeaId: string;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryIdeasSnapshot | null;
  routeScope?: DiscoveryAuthoringRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
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
    resource: activeIdeaId ? { discoveryIdeaId: activeIdeaId } : undefined,
    source: "discovery-authoring",
    reason: "discovery-authoring-mutation",
  }, {
    fallbackErrorMessage: "Discovery authoring action failed.",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery"],
      scope: routeScope,
      resource: activeIdeaId ? { discoveryIdeaId: activeIdeaId } : undefined,
    },
    invalidationOptions: {
      ignoreSources: ["discovery-authoring"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "discovery_authoring",
    preferences.refreshProfile
  );
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryIdeasSnapshot(activeIdeaId),
    [activeIdeaId]
  );
  const selectLoadState = useCallback(
    (nextSnapshot: ShellDiscoveryIdeasSnapshot) =>
      nextSnapshot.dossierLoadState === "idle"
        ? "ready"
        : nextSnapshot.dossierLoadState,
    []
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_DISCOVERY_AUTHORING_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });

  const [observationSource, setObservationSource] = useState("manual");
  const [observationEntity, setObservationEntity] = useState("");
  const [observationUrl, setObservationUrl] = useState("");
  const [observationText, setObservationText] = useState("");
  const [observationTags, setObservationTags] = useState("");
  const [observationPain, setObservationPain] = useState("0.4");
  const [observationTrend, setObservationTrend] = useState("0.4");
  const [observationConfidence, setObservationConfidence] = useState("medium");

  const [validationSummary, setValidationSummary] = useState("");
  const [validationVerdict, setValidationVerdict] = useState("partial");
  const [validationFindings, setValidationFindings] = useState("");
  const [validationConfidence, setValidationConfidence] = useState("medium");

  const [decisionType, setDecisionType] = useState("advance");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [decisionActor, setDecisionActor] = useState("founder");

  const [timelineStage, setTimelineStage] = useState("sourced");
  const [timelineTitle, setTimelineTitle] = useState("");
  const [timelineDetail, setTimelineDetail] = useState("");

  const [evidenceOverallConfidence, setEvidenceOverallConfidence] = useState("");
  const [evidenceKind, setEvidenceKind] = useState("note");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceRawContent, setEvidenceRawContent] = useState("");
  const [evidenceArtifactPath, setEvidenceArtifactPath] = useState("");
  const [evidenceSource, setEvidenceSource] = useState("");
  const [evidenceConfidence, setEvidenceConfidence] = useState("medium");
  const [evidenceTags, setEvidenceTags] = useState("");
  const [addedEvidenceItems, setAddedEvidenceItems] = useState<DraftEvidenceItem[]>([]);
  const [removedEvidenceIds, setRemovedEvidenceIds] = useState<string[]>([]);

  const dossier = snapshot.dossier;
  const ideas = snapshot.ideas;
  const activeIdea =
    dossier?.idea ?? ideas.find((idea) => idea.idea_id === activeIdeaId) ?? null;
  const linkedChain =
    snapshot.chains.find((record) => record.idea.idea_id === activeIdeaId) ?? null;
  const chainRouteScope = linkedChain
    ? shellChainRouteScope(linkedChain as LinkedShellChainRecord, routeScope)
    : routeScope;
  const reviewHref = useMemo(
    () =>
      buildRememberedDiscoveryReviewScopeHref({
        scope: chainRouteScope,
        preferences,
        bucket: resolveReviewMemoryBucket({ scope: chainRouteScope }),
      }),
    [chainRouteScope, preferences]
  );

  const baseEvidenceItems = dossier?.evidence_bundle?.items ?? [];
  const effectiveEvidenceItems: Array<
    | {
        key: string;
        sourceType: "existing";
        kind: string;
        summary: string;
        rawContent: string;
        artifactPath: string;
        source: string;
        confidence: string;
        tags: string[];
      }
    | {
        key: string;
        sourceType: "draft";
        kind: string;
        summary: string;
        rawContent: string;
        artifactPath: string;
        source: string;
        confidence: string;
        tags: string[];
      }
  > = [
    ...baseEvidenceItems
      .filter((item) => !removedEvidenceIds.includes(item.evidence_id))
      .map((item) => ({
        key: item.evidence_id,
        sourceType: "existing" as const,
        kind: item.kind,
        summary: item.summary,
        rawContent: item.raw_content ?? "",
        artifactPath: item.artifact_path ?? "",
        source: item.source ?? "",
        confidence: item.confidence,
        tags: item.tags,
      })),
    ...addedEvidenceItems.map((item) => ({
      key: item.draftId,
      sourceType: "draft" as const,
      kind: item.kind,
      summary: item.summary,
      rawContent: item.rawContent,
      artifactPath: item.artifactPath,
      source: item.source,
      confidence: item.confidence,
      tags: parseCsv(item.tags),
    })),
  ];

  const effectiveEvidenceOverallConfidence =
    evidenceOverallConfidence || dossier?.evidence_bundle?.overall_confidence || "medium";
  const errors = [
    snapshot.ideasError ?? "",
    snapshot.chainsError ?? "",
    snapshot.dossierError ?? "",
    errorMessage ?? "",
  ].filter(Boolean);

  function resetObservationForm() {
    setObservationEntity("");
    setObservationUrl("");
    setObservationText("");
    setObservationTags("");
    setObservationPain("0.4");
    setObservationTrend("0.4");
    setObservationConfidence("medium");
  }

  function resetValidationForm() {
    setValidationSummary("");
    setValidationVerdict("partial");
    setValidationFindings("");
    setValidationConfidence("medium");
  }

  function resetDecisionForm() {
    setDecisionType("advance");
    setDecisionRationale("");
    setDecisionActor("founder");
  }

  function resetTimelineForm() {
    setTimelineStage(activeIdea?.latest_stage || "sourced");
    setTimelineTitle("");
    setTimelineDetail("");
  }

  function resetEvidenceDraftItemForm() {
    setEvidenceKind("note");
    setEvidenceSummary("");
    setEvidenceRawContent("");
    setEvidenceArtifactPath("");
    setEvidenceSource("");
    setEvidenceConfidence("medium");
    setEvidenceTags("");
  }

  function handleAddObservation() {
    if (!activeIdeaId || !observationEntity.trim() || !observationText.trim()) {
      return;
    }

    void runMutation(
      "authoring:observation",
      () =>
        addDiscoveryObservationRecord({
          ideaId: activeIdeaId,
          request: {
            source: observationSource.trim() || "manual",
            entity: observationEntity.trim(),
            url: observationUrl.trim(),
            raw_text: observationText.trim(),
            topic_tags: parseCsv(observationTags),
            pain_score: Number.parseFloat(observationPain) || 0,
            trend_score: Number.parseFloat(observationTrend) || 0,
            evidence_confidence: observationConfidence,
          },
          routeScope: chainRouteScope,
          source: "discovery-authoring",
        }),
      {
        onSuccess: () => {
          resetObservationForm();
        },
      }
    );
  }

  function handleAddValidationReport() {
    if (!activeIdeaId || !validationSummary.trim()) {
      return;
    }

    void runMutation(
      "authoring:validation",
      () =>
        addDiscoveryValidationReportRecord({
          ideaId: activeIdeaId,
          request: {
            summary: validationSummary.trim(),
            verdict: validationVerdict,
            findings: parseLines(validationFindings),
            confidence: validationConfidence,
            evidence_bundle_id: dossier?.evidence_bundle?.bundle_id ?? null,
          },
          routeScope: chainRouteScope,
          source: "discovery-authoring",
        }),
      {
        onSuccess: () => {
          resetValidationForm();
        },
      }
    );
  }

  function handleAddDecision() {
    if (!activeIdeaId || !decisionRationale.trim()) {
      return;
    }

    void runMutation(
      "authoring:decision",
      () =>
        addDiscoveryDecisionRecord({
          ideaId: activeIdeaId,
          request: {
            decision_type: decisionType,
            rationale: decisionRationale.trim(),
            actor: decisionActor.trim() || "founder",
          },
          routeScope: chainRouteScope,
          source: "discovery-authoring",
        }),
      {
        onSuccess: () => {
          resetDecisionForm();
        },
      }
    );
  }

  function handleAddTimelineEvent() {
    if (!activeIdeaId || !timelineTitle.trim()) {
      return;
    }

    void runMutation(
      "authoring:timeline",
      () =>
        addDiscoveryTimelineEventRecord({
          ideaId: activeIdeaId,
          request: {
            stage: timelineStage,
            title: timelineTitle.trim(),
            detail: timelineDetail.trim(),
          },
          routeScope: chainRouteScope,
          source: "discovery-authoring",
        }),
      {
        onSuccess: () => {
          resetTimelineForm();
        },
      }
    );
  }

  function handleStageEvidenceDraftItem() {
    if (!evidenceSummary.trim()) {
      return;
    }

    setAddedEvidenceItems((current) => [
      ...current,
      {
        draftId: createDraftEvidenceItemId(),
        kind: evidenceKind.trim() || "note",
        summary: evidenceSummary.trim(),
        rawContent: evidenceRawContent.trim(),
        artifactPath: evidenceArtifactPath.trim(),
        source: evidenceSource.trim(),
        confidence: evidenceConfidence,
        tags: evidenceTags,
      },
    ]);
    resetEvidenceDraftItemForm();
  }

  function handleRemoveEvidenceItem(key: string, sourceType: "existing" | "draft") {
    if (sourceType === "existing") {
      setRemovedEvidenceIds((current) =>
        current.includes(key) ? current : [...current, key]
      );
      return;
    }

    setAddedEvidenceItems((current) =>
      current.filter((item) => item.draftId !== key)
    );
  }

  function handleSaveEvidenceBundle() {
    if (!activeIdeaId) {
      return;
    }

    const items: QuorumEvidenceBundleItemInput[] = effectiveEvidenceItems.map((item) => ({
      kind: item.kind,
      summary: item.summary,
      raw_content: item.rawContent || null,
      artifact_path: item.artifactPath || null,
      source: item.source || null,
      confidence: item.confidence,
      tags: item.tags,
    }));

    void runMutation(
      "authoring:evidence",
      () =>
        upsertDiscoveryEvidenceBundleRecord({
          ideaId: activeIdeaId,
          request: {
            items,
            overall_confidence: effectiveEvidenceOverallConfidence,
          },
          routeScope: chainRouteScope,
          source: "discovery-authoring",
        }),
      {
        onSuccess: () => {
          setAddedEvidenceItems([]);
          setRemovedEvidenceIds([]);
          setEvidenceOverallConfidence("");
        },
      }
    );
  }

  return (
    <ShellPage>
      <div className="flex items-center justify-end gap-2">
        <ShellRefreshButton
          type="button"
          onClick={() => refreshClient()}
          icon={<TimerReset className="h-4 w-4" />}
        />
        <ShellFilterChipLink
          href={buildDiscoveryIdeaScopeHref(activeIdeaId, chainRouteScope)}
          label="Dossier"
        />
        <ShellFilterChipLink
          href={buildDiscoveryBoardScopeHref(chainRouteScope)}
          label="Board"
        />
        <ShellFilterChipLink
          href={buildDiscoveryAuthoringScopeHref(chainRouteScope)}
          label="Queue"
        />
        <ShellFilterChipLink href={reviewHref} label="Review" />
        <ShellFilterChipLink
          href={buildDiscoveryIdeasScopeHref(chainRouteScope)}
          label="Ideas"
        />
      </div>

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}

      {errors.length > 0 ? (
        <ShellStatusBanner tone="warning">{errors.join(" ")}</ShellStatusBanner>
      ) : null}


      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <IdeaRail
          ideas={ideas}
          activeIdeaId={activeIdeaId}
          routeScope={chainRouteScope}
        />

        <div className="grid gap-4">
          {dossier ? (
            <>
              <LinkedChainPanel chain={linkedChain} routeScope={chainRouteScope} />
              <CurrentDossierPanel dossier={dossier} />

              <section className="grid gap-4 xl:grid-cols-2">
                <ShellSectionCard
                  title="Add observation"
                  contentClassName="space-y-3"
                >
                    <div className="grid gap-3 md:grid-cols-2">
                      <ShellInputField
                        value={observationSource}
                        onChange={(event) => setObservationSource(event.target.value)}
                        placeholder="Source"
                      />
                      <ShellInputField
                        value={observationEntity}
                        onChange={(event) => setObservationEntity(event.target.value)}
                        placeholder="Entity"
                      />
                    </div>
                    <ShellInputField
                      value={observationUrl}
                      onChange={(event) => setObservationUrl(event.target.value)}
                      placeholder="URL"
                    />
                    <ShellComposerTextarea
                      value={observationText}
                      onChange={(event) => setObservationText(event.target.value)}
                      placeholder="Raw observation text"
                      className="min-h-[120px]"
                    />
                    <ShellInputField
                      value={observationTags}
                      onChange={(event) => setObservationTags(event.target.value)}
                      placeholder="Tags, comma separated"
                    />
                    <div className="grid gap-3 md:grid-cols-3">
                      <ShellInputField
                        value={observationPain}
                        onChange={(event) => setObservationPain(event.target.value)}
                        placeholder="Pain score"
                      />
                      <ShellInputField
                        value={observationTrend}
                        onChange={(event) => setObservationTrend(event.target.value)}
                        placeholder="Trend score"
                      />
                      <ShellSelectField
                        value={observationConfidence}
                        onChange={(event) => setObservationConfidence(event.target.value)}
                      >
                        {CONFIDENCE_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </ShellSelectField>
                    </div>
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      disabled={Boolean(busyActionKey)}
                      onClick={handleAddObservation}
                    >
                      <ShellActionStateLabel
                        busy={busyActionKey === "authoring:observation"}
                        idleLabel="Add observation"
                        busyLabel="Add observation"
                      />
                    </ShellPillButton>
                </ShellSectionCard>

                <ShellSectionCard
                  title="Add validation report"
                  contentClassName="space-y-3"
                >
                    <ShellComposerTextarea
                      value={validationSummary}
                      onChange={(event) => setValidationSummary(event.target.value)}
                      placeholder="Validation summary"
                      className="min-h-[120px]"
                    />
                    <ShellComposerTextarea
                      value={validationFindings}
                      onChange={(event) => setValidationFindings(event.target.value)}
                      placeholder="Findings, one per line"
                      className="min-h-[112px]"
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <ShellSelectField
                        value={validationVerdict}
                        onChange={(event) => setValidationVerdict(event.target.value)}
                      >
                        {VERDICT_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </ShellSelectField>
                      <ShellSelectField
                        value={validationConfidence}
                        onChange={(event) => setValidationConfidence(event.target.value)}
                      >
                        {CONFIDENCE_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </ShellSelectField>
                    </div>
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      disabled={Boolean(busyActionKey)}
                      onClick={handleAddValidationReport}
                    >
                      <ShellActionStateLabel
                        busy={busyActionKey === "authoring:validation"}
                        idleLabel="Add validation report"
                        busyLabel="Add validation report"
                      />
                    </ShellPillButton>
                </ShellSectionCard>

                <ShellSectionCard
                  title="Add decision"
                  contentClassName="space-y-3"
                >
                    <div className="grid gap-3 md:grid-cols-2">
                      <ShellSelectField
                        value={decisionType}
                        onChange={(event) => setDecisionType(event.target.value)}
                      >
                        {DECISION_TYPES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </ShellSelectField>
                      <ShellInputField
                        value={decisionActor}
                        onChange={(event) => setDecisionActor(event.target.value)}
                        placeholder="Actor"
                      />
                    </div>
                    <ShellComposerTextarea
                      value={decisionRationale}
                      onChange={(event) => setDecisionRationale(event.target.value)}
                      placeholder="Decision rationale"
                      className="min-h-[150px]"
                    />
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      disabled={Boolean(busyActionKey)}
                      onClick={handleAddDecision}
                    >
                      <ShellActionStateLabel
                        busy={busyActionKey === "authoring:decision"}
                        idleLabel="Add decision"
                        busyLabel="Add decision"
                      />
                    </ShellPillButton>
                </ShellSectionCard>

                <ShellSectionCard
                  title="Add timeline event"
                  contentClassName="space-y-3"
                >
                    <div className="grid gap-3 md:grid-cols-2">
                      <ShellSelectField
                        value={timelineStage}
                        onChange={(event) => setTimelineStage(event.target.value)}
                      >
                        {DOSSIER_STAGES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </ShellSelectField>
                      <ShellInputField
                        value={timelineTitle}
                        onChange={(event) => setTimelineTitle(event.target.value)}
                        placeholder="Timeline title"
                      />
                    </div>
                    <ShellComposerTextarea
                      value={timelineDetail}
                      onChange={(event) => setTimelineDetail(event.target.value)}
                      placeholder="Timeline detail"
                      className="min-h-[150px]"
                    />
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      disabled={Boolean(busyActionKey)}
                      onClick={handleAddTimelineEvent}
                    >
                      <ShellActionStateLabel
                        busy={busyActionKey === "authoring:timeline"}
                        idleLabel="Add timeline event"
                        busyLabel="Add timeline event"
                      />
                    </ShellPillButton>
                </ShellSectionCard>
              </section>

              <ShellSectionCard
                title="Evidence bundle editor"
                contentClassName="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]"
              >
                  <div className="space-y-3">
                    {effectiveEvidenceItems.length ? (
                      effectiveEvidenceItems.map((item) => (
                        <ShellSubtlePanel key={item.key} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {item.kind}
                              </div>
                              <div className="mt-1 text-sm leading-7 text-muted-foreground">
                                {truncate(item.summary)}
                              </div>
                            </div>
                            <Badge tone={item.sourceType === "draft" ? "warning" : "neutral"}>
                              {item.sourceType}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone="neutral">{item.confidence}</Badge>
                            {item.source ? <Badge tone="neutral">{item.source}</Badge> : null}
                            {item.tags.slice(0, 3).map((tag) => (
                              <Badge key={`${item.key}:${tag}`} tone="info">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="mt-3">
                            <ShellPillButton
                              type="button"
                              tone="outline"
                              compact
                              onClick={() =>
                                handleRemoveEvidenceItem(item.key, item.sourceType)
                              }
                            >
                              Remove
                            </ShellPillButton>
                          </div>
                        </ShellSubtlePanel>
                      ))
                    ) : (
                      <ShellEmptyState description="No effective evidence items are staged yet." />
                    )}
                  </div>

                  <div className="space-y-3">
                    <ShellSelectField
                      value={effectiveEvidenceOverallConfidence}
                      onChange={(event) => setEvidenceOverallConfidence(event.target.value)}
                    >
                      {CONFIDENCE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </ShellSelectField>
                    <ShellInputField
                      value={evidenceKind}
                      onChange={(event) => setEvidenceKind(event.target.value)}
                      placeholder="Evidence kind"
                    />
                    <ShellComposerTextarea
                      value={evidenceSummary}
                      onChange={(event) => setEvidenceSummary(event.target.value)}
                      placeholder="Evidence summary"
                      className="min-h-[104px]"
                    />
                    <ShellComposerTextarea
                      value={evidenceRawContent}
                      onChange={(event) => setEvidenceRawContent(event.target.value)}
                      placeholder="Optional raw content"
                      className="min-h-[104px]"
                    />
                    <ShellInputField
                      value={evidenceArtifactPath}
                      onChange={(event) => setEvidenceArtifactPath(event.target.value)}
                      placeholder="Artifact path"
                    />
                    <ShellInputField
                      value={evidenceSource}
                      onChange={(event) => setEvidenceSource(event.target.value)}
                      placeholder="Evidence source"
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      <ShellSelectField
                        value={evidenceConfidence}
                        onChange={(event) => setEvidenceConfidence(event.target.value)}
                      >
                        {CONFIDENCE_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </ShellSelectField>
                      <ShellInputField
                        value={evidenceTags}
                        onChange={(event) => setEvidenceTags(event.target.value)}
                        placeholder="Tags, comma separated"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ShellPillButton
                        type="button"
                        tone="outline"
                        compact
                        onClick={handleStageEvidenceDraftItem}
                      >
                        Stage bundle item
                      </ShellPillButton>
                      <ShellPillButton
                        type="button"
                        tone="primary"
                        disabled={Boolean(busyActionKey)}
                        onClick={handleSaveEvidenceBundle}
                      >
                        <ShellActionStateLabel
                          busy={busyActionKey === "authoring:evidence"}
                          idleLabel="Save evidence bundle"
                          busyLabel="Save evidence bundle"
                        />
                      </ShellPillButton>
                    </div>
                  </div>
              </ShellSectionCard>
            </>
          ) : (
            <ShellSectionCard
              title="Discovery authoring unavailable"
              contentClassName="pt-0"
            >
              <ShellEmptyState description="Try another idea in the authoring rail or refresh the current route." />
            </ShellSectionCard>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ShellListLink href={buildDiscoveryIdeaScopeHref(activeIdeaId, chainRouteScope)}>
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-accent" />
            Open dossier detail
          </div>
        </ShellListLink>
        <ShellListLink href={buildDashboardScopeHref(chainRouteScope)}>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-accent" />
            Open scoped dashboard
          </div>
        </ShellListLink>
        <ShellListLink href={buildPortfolioScopeHref(chainRouteScope)}>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-accent" />
            Open scoped portfolio
          </div>
        </ShellListLink>
        <ShellListLink href={buildInboxScopeHref(chainRouteScope)}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Open scoped inbox
          </div>
        </ShellListLink>
      </section>
    </ShellPage>
  );
}

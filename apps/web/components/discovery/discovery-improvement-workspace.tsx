"use client";

import type {
  QuorumPromptEvolutionProfile,
  QuorumPromptSelfPlayMatch,
  QuorumReflectiveEvalReport,
  ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import {
  AlertTriangle,
  Brain,
  Sparkles,
  Swords,
  TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  ShellActionLink,
  ShellActionStateLabel,
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
  activateDiscoveryImprovementProfile,
  runDiscoveryImprovementEvolution,
  runDiscoveryImprovementReflection,
  runDiscoveryImprovementSelfPlay,
} from "@/lib/discovery-improvement-mutations";
import {
  emptyShellDiscoveryImprovementSnapshot,
  type ShellDiscoveryImprovementSnapshot,
} from "@/lib/discovery-improvement-model";
import { safeFormatDate, safeFormatRelativeTime } from "@/lib/format-utils";
import {
  buildDiscoveryImprovementProfileScopeHref,
  buildDiscoveryImprovementScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellDiscoveryImprovementSnapshot } from "@/lib/shell-snapshot-client";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";

const EMPTY_IMPROVEMENT_SNAPSHOT = emptyShellDiscoveryImprovementSnapshot();
const PANEL_SURFACE_CLASS =
  "border-border/60 bg-card/70 shadow-sm";
const CHIP_CLASS =
  "inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2.5 py-1 text-[11px] leading-4 text-muted-foreground";

function sanitizeError(error: string | null) {
  if (!error) return null;

  const normalized = error.toLowerCase();
  if (
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("network")
  ) {
    return "Quorum improvement lab is unavailable right now. Check the upstream connection in Settings, then refresh this route.";
  }

  return error;
}

function parseDelimitedList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRoleFocus(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is "generator" | "judge" | "critic" =>
      item === "generator" || item === "judge" || item === "critic"
    );
}

function isActiveProfile(profile: QuorumPromptEvolutionProfile | null | undefined) {
  return Boolean(profile?.metadata?.active);
}

function metadataString(
  profile: QuorumPromptEvolutionProfile | null | undefined,
  key: string
) {
  const value = profile?.metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function metadataStrings(
  profile: QuorumPromptEvolutionProfile | null | undefined,
  key: string
) {
  const value = profile?.metadata?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function matchesQuery(profile: QuorumPromptEvolutionProfile, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    profile.profile_id,
    profile.label,
    profile.operator_kind,
    profile.instruction,
    metadataString(profile, "parent_profile_id"),
    metadataStrings(profile, "tactics").join(" "),
    metadataStrings(profile, "failure_tags_covered").join(" "),
  ].some((field) => field.toLowerCase().includes(normalized));
}

function profileTone(profile: QuorumPromptEvolutionProfile) {
  if (isActiveProfile(profile)) return "success" as const;
  if (profile.operator_kind === "self_improve") return "warning" as const;
  if (profile.operator_kind === "baseline") return "info" as const;
  return "neutral" as const;
}

function matchWinnerTone(match: QuorumPromptSelfPlayMatch, profileId: string) {
  if (!match.winner_profile_id) return "neutral" as const;
  return match.winner_profile_id === profileId ? "success" as const : "warning" as const;
}

function relatedReflections(
  profile: QuorumPromptEvolutionProfile,
  reflections: QuorumReflectiveEvalReport[]
) {
  const reflectionId = metadataString(profile, "reflection_id");
  const coveredTags = new Set(metadataStrings(profile, "failure_tags_covered"));

  return reflections.filter((reflection) => {
    if (reflectionId && reflection.reflection_id === reflectionId) {
      return true;
    }

    return reflection.failure_tags.some((tag) => coveredTags.has(tag));
  });
}

function relatedMatches(
  profile: QuorumPromptEvolutionProfile,
  matches: QuorumPromptSelfPlayMatch[]
) {
  return matches.filter(
    (match) =>
      match.left_profile_id === profile.profile_id ||
      match.right_profile_id === profile.profile_id
  );
}

function ProfileCard({
  profile,
  selected,
  routeScope,
}: {
  profile: QuorumPromptEvolutionProfile;
  selected: boolean;
  routeScope: ShellRouteScope;
}) {
  return (
    <ShellListLink
      href={buildDiscoveryImprovementProfileScopeHref(profile.profile_id, routeScope)}
      className={selected ? "border-primary/30 bg-primary/[0.06]" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[14px] font-medium text-foreground">
            {profile.label}
          </div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            {profile.profile_id}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={profileTone(profile)}>{profile.operator_kind}</Badge>
          {isActiveProfile(profile) ? <Badge tone="success">active</Badge> : null}
        </div>
      </div>

      <div className="mt-3 text-[12px] leading-5 text-muted-foreground">
        {profile.instruction}
      </div>

      <div className="mt-3 grid gap-1.5 text-[12px] text-muted-foreground md:grid-cols-2">
        <span>ELO {Math.round(profile.elo_rating)}</span>
        <span>
          {profile.wins}W · {profile.losses}L · {profile.ties}T
        </span>
        <span>
          Updated {safeFormatRelativeTime(profile.last_updated, safeFormatDate(profile.last_updated))}
        </span>
        <span>{metadataStrings(profile, "tactics").length} tactics</span>
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
    <ShellDetailCard className={PANEL_SURFACE_CLASS}>
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {items.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className={CHIP_CLASS}
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

export function DiscoveryImprovementWorkspace({
  profileId = null,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  profileId?: string | null;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellDiscoveryImprovementSnapshot | null;
  routeScope?: ShellRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const pollIntervalMs = getShellPollInterval(
    "discovery_review",
    preferences.refreshProfile
  );
  const { isRefreshing, refresh, refreshNonce: manualRefreshNonce } =
    useShellManualRefresh();
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
      source: "discovery-improvement",
      reason: "improvement-lab",
    },
    {
      fallbackErrorMessage: "Improvement lab action failed.",
    }
  );
  const [query, setQuery] = useState("");
  const [reflectTask, setReflectTask] = useState("");
  const [reflectSessionId, setReflectSessionId] = useState("");
  const [reflectSourceKind, setReflectSourceKind] = useState("manual");
  const [reflectRoleFocus, setReflectRoleFocus] = useState("generator,judge,critic");
  const [reflectFailureTags, setReflectFailureTags] = useState("");
  const [reflectNotes, setReflectNotes] = useState("");
  const [selfPlayLeftProfileId, setSelfPlayLeftProfileId] = useState(
    initialSnapshot?.selectedProfile?.profile_id ||
      initialSnapshot?.profiles[0]?.profile_id ||
      ""
  );
  const [selfPlayRightProfileId, setSelfPlayRightProfileId] = useState(
    initialSnapshot?.profiles[1]?.profile_id ||
      initialSnapshot?.profiles[0]?.profile_id ||
      ""
  );
  const [selfPlayTask, setSelfPlayTask] = useState("");
  const [selfPlayReflectionIds, setSelfPlayReflectionIds] = useState("");
  const [selfPlayRoleFocus, setSelfPlayRoleFocus] = useState("generator,judge,critic");
  const [selfPlayChallengeCount, setSelfPlayChallengeCount] = useState("3");
  const [selfPlayActivateWinner, setSelfPlayActivateWinner] = useState("no");
  const [evolveSeedProfileId, setEvolveSeedProfileId] = useState(
    initialSnapshot?.selectedProfile?.profile_id ||
      initialSnapshot?.profiles[0]?.profile_id ||
      ""
  );
  const [evolveTask, setEvolveTask] = useState("");
  const [evolveReflectionIds, setEvolveReflectionIds] = useState("");
  const [evolveMutationBudget, setEvolveMutationBudget] = useState("3");
  const [evolveChallengeCount, setEvolveChallengeCount] = useState("3");
  const [evolveActivateBest, setEvolveActivateBest] = useState("yes");
  const loadSnapshot = useCallback(
    () => fetchShellDiscoveryImprovementSnapshot(profileId),
    [profileId]
  );
  const selectLoadState = useCallback(
    (snapshot: ShellDiscoveryImprovementSnapshot) =>
      profileId
        ? snapshot.selectedProfileLoadState === "ready" ||
          snapshot.selectedProfileLoadState === "idle"
          ? "ready"
          : "error"
        : snapshot.profilesLoadState,
    [profileId]
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_IMPROVEMENT_SNAPSHOT,
    initialSnapshot,
    refreshNonce: manualRefreshNonce + mutationRefreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const filteredProfiles = useMemo(
    () => snapshot.profiles.filter((profile) => matchesQuery(profile, query)),
    [query, snapshot.profiles]
  );
  const selectedProfile = snapshot.selectedProfile;
  const selectedReflections = useMemo(
    () =>
      selectedProfile ? relatedReflections(selectedProfile, snapshot.reflections) : [],
    [selectedProfile, snapshot.reflections]
  );
  const selectedMatches = useMemo(
    () => (selectedProfile ? relatedMatches(selectedProfile, snapshot.matches) : []),
    [selectedProfile, snapshot.matches]
  );
  const error = sanitizeError(
    errorMessage ||
      snapshot.profilesError ||
      snapshot.selectedProfileError ||
      snapshot.reflectionsError ||
      snapshot.matchesError
  );
  const improvementHref = buildDiscoveryImprovementScopeHref(routeScope);
  const parsedReflectFailureTags = parseDelimitedList(reflectFailureTags);
  const parsedReflectNotes = parseDelimitedList(reflectNotes);
  const parsedSelfPlayReflectionIds = parseDelimitedList(selfPlayReflectionIds);
  const parsedEvolveReflectionIds = parseDelimitedList(evolveReflectionIds);
  const canRunSelfPlay =
    selfPlayLeftProfileId.trim().length > 0 &&
    selfPlayRightProfileId.trim().length > 0 &&
    selfPlayLeftProfileId !== selfPlayRightProfileId;
  const canRunEvolution = evolveSeedProfileId.trim().length > 0;

  return (
    <ShellPage>
      <ShellHero
        title="Improvement Lab"
        description="Prompt profiles, reflection reports, and self-play pressure now live on a shell-native discovery route."
        meta={
          <div className="flex flex-wrap gap-1.5">
            <span className={CHIP_CLASS}>{snapshot.profiles.length} prompt profiles</span>
            <span className={CHIP_CLASS}>{snapshot.reflections.length} recent reflections</span>
            <span className={CHIP_CLASS}>{snapshot.matches.length} self-play matches</span>
          </div>
        }
        actions={
          <>
            {profileId ? (
              <ShellActionLink href={improvementHref} label="All profiles" />
            ) : null}
            <ShellRefreshButton busy={isRefreshing} onClick={refresh} />
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <ShellMetricCard
          label="Profiles"
          value={String(snapshot.profiles.length)}
          detail="Baseline, mutant, and self-improved prompt families."
        />
        <ShellMetricCard
          label="Reflections"
          value={String(snapshot.reflections.length)}
          detail="Recent eval reports that explain current failure pressure."
        />
        <ShellMetricCard
          label="Self-Play Matches"
          value={String(snapshot.matches.length)}
          detail="Latest deterministic profile-vs-profile evaluations."
        />
      </div>

      {statusMessage ? (
        <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
      ) : null}
      {error ? (
        <ShellStatusBanner tone="warning">{error}</ShellStatusBanner>
      ) : null}

      <ShellSectionCard
        title="Run Lab Actions"
        description="Launch reflections, self-play matches, and evolution runs through shell-owned discovery actions."
        contentClassName="grid gap-3 xl:grid-cols-3"
      >
        <ShellDetailCard className={PANEL_SURFACE_CLASS}>
          <div className="text-[13px] font-medium text-foreground">Reflect</div>
          <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
            Create a new reflective eval report from a session or manual notes.
          </div>
          <div className="mt-3 space-y-2.5">
            <ShellInputField
              value={reflectTask}
              onChange={(event) => setReflectTask(event.target.value)}
              placeholder="Task or failure theme"
            />
            <ShellInputField
              value={reflectSessionId}
              onChange={(event) => setReflectSessionId(event.target.value)}
              placeholder="Session id (optional)"
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <ShellSelectField
                value={reflectSourceKind}
                onChange={(event) => setReflectSourceKind(event.target.value)}
              >
                <option value="manual">Source kind: manual</option>
                <option value="session">Source kind: session</option>
              </ShellSelectField>
              <ShellSelectField
                value={reflectRoleFocus}
                onChange={(event) => setReflectRoleFocus(event.target.value)}
              >
                <option value="generator,judge,critic">Role focus: all</option>
                <option value="generator">Role focus: generator</option>
                <option value="judge">Role focus: judge</option>
                <option value="critic">Role focus: critic</option>
                <option value="generator,critic">Role focus: generator + critic</option>
              </ShellSelectField>
            </div>
            <ShellComposerTextarea
              value={reflectFailureTags}
              onChange={(event) => setReflectFailureTags(event.target.value)}
              placeholder="Failure tags, one per line or comma-separated"
              className="min-h-[96px]"
            />
            <ShellComposerTextarea
              value={reflectNotes}
              onChange={(event) => setReflectNotes(event.target.value)}
              placeholder="Notes, evidence, or observed failures"
              className="min-h-[96px]"
            />
            <ShellPillButton
              type="button"
              tone="primary"
              disabled={Boolean(busyActionKey)}
              onClick={() =>
                runMutation("reflect", () =>
                  runDiscoveryImprovementReflection({
                    request: {
                      session_id: reflectSessionId.trim() || null,
                      task: reflectTask.trim(),
                      source_kind: reflectSourceKind,
                      role_focus: parseRoleFocus(reflectRoleFocus),
                      failure_tags: parsedReflectFailureTags,
                      notes: parsedReflectNotes,
                    },
                    routeScope,
                  })
                )
              }
            >
              <ShellActionStateLabel
                busy={busyActionKey === "reflect"}
                idleLabel="Run Reflection"
                busyLabel="Reflecting..."
                icon={<Brain className="h-4 w-4" />}
              />
            </ShellPillButton>
          </div>
        </ShellDetailCard>

        <ShellDetailCard className={PANEL_SURFACE_CLASS}>
          <div className="text-[13px] font-medium text-foreground">Self-Play</div>
          <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
            Match two profiles against the current failure pressure and optionally activate the winner.
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <ShellSelectField
                value={selfPlayLeftProfileId}
                onChange={(event) => setSelfPlayLeftProfileId(event.target.value)}
              >
                <option value="">Left profile</option>
                {snapshot.profiles.map((profile) => (
                  <option key={`left:${profile.profile_id}`} value={profile.profile_id}>
                    {profile.label}
                  </option>
                ))}
              </ShellSelectField>
              <ShellSelectField
                value={selfPlayRightProfileId}
                onChange={(event) => setSelfPlayRightProfileId(event.target.value)}
              >
                <option value="">Right profile</option>
                {snapshot.profiles.map((profile) => (
                  <option key={`right:${profile.profile_id}`} value={profile.profile_id}>
                    {profile.label}
                  </option>
                ))}
              </ShellSelectField>
            </div>
            <ShellInputField
              value={selfPlayTask}
              onChange={(event) => setSelfPlayTask(event.target.value)}
              placeholder="Evaluation task"
            />
            <ShellComposerTextarea
              value={selfPlayReflectionIds}
              onChange={(event) => setSelfPlayReflectionIds(event.target.value)}
              placeholder="Reflection ids to apply, one per line or comma-separated"
              className="min-h-[96px]"
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <ShellSelectField
                value={selfPlayRoleFocus}
                onChange={(event) => setSelfPlayRoleFocus(event.target.value)}
              >
                <option value="generator,judge,critic">Role focus: all</option>
                <option value="generator">Role focus: generator</option>
                <option value="judge">Role focus: judge</option>
                <option value="critic">Role focus: critic</option>
              </ShellSelectField>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                <ShellSelectField
                  value={selfPlayChallengeCount}
                  onChange={(event) => setSelfPlayChallengeCount(event.target.value)}
                >
                  <option value="1">1 challenge</option>
                  <option value="2">2 challenges</option>
                  <option value="3">3 challenges</option>
                  <option value="4">4 challenges</option>
                </ShellSelectField>
                <ShellSelectField
                  value={selfPlayActivateWinner}
                  onChange={(event) => setSelfPlayActivateWinner(event.target.value)}
                >
                  <option value="no">Do not activate winner</option>
                  <option value="yes">Activate winner</option>
                </ShellSelectField>
              </div>
            </div>
            <ShellPillButton
              type="button"
              tone="outline"
              disabled={!canRunSelfPlay || Boolean(busyActionKey)}
              onClick={() =>
                runMutation("self-play", () =>
                  runDiscoveryImprovementSelfPlay({
                    request: {
                      left_profile_id: selfPlayLeftProfileId,
                      right_profile_id: selfPlayRightProfileId,
                      reflection_ids: parsedSelfPlayReflectionIds,
                      task: selfPlayTask.trim(),
                      role_focus: parseRoleFocus(selfPlayRoleFocus),
                      challenge_count:
                        Math.max(
                          1,
                          Number.parseInt(selfPlayChallengeCount, 10) || 3
                        ),
                      activate_winner: selfPlayActivateWinner === "yes",
                    },
                    routeScope,
                  })
                )
              }
            >
              <ShellActionStateLabel
                busy={busyActionKey === "self-play"}
                idleLabel="Run Self-Play"
                busyLabel="Running self-play..."
                icon={<Swords className="h-4 w-4" />}
              />
            </ShellPillButton>
          </div>
        </ShellDetailCard>

        <ShellDetailCard className={PANEL_SURFACE_CLASS}>
          <div className="text-[13px] font-medium text-foreground">Evolve</div>
          <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
            Generate new profile variants from a seed profile and optionally activate the best result.
          </div>
          <div className="mt-3 space-y-2.5">
            <ShellSelectField
              value={evolveSeedProfileId}
              onChange={(event) => setEvolveSeedProfileId(event.target.value)}
            >
              <option value="">Seed profile</option>
              {snapshot.profiles.map((profile) => (
                <option key={`seed:${profile.profile_id}`} value={profile.profile_id}>
                  {profile.label}
                </option>
              ))}
            </ShellSelectField>
            <ShellInputField
              value={evolveTask}
              onChange={(event) => setEvolveTask(event.target.value)}
              placeholder="Evolution goal"
            />
            <ShellComposerTextarea
              value={evolveReflectionIds}
              onChange={(event) => setEvolveReflectionIds(event.target.value)}
              placeholder="Reflection ids to apply, one per line or comma-separated"
              className="min-h-[96px]"
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                <ShellSelectField
                  value={evolveMutationBudget}
                  onChange={(event) => setEvolveMutationBudget(event.target.value)}
                >
                  <option value="1">1 variant</option>
                  <option value="2">2 variants</option>
                  <option value="3">3 variants</option>
                  <option value="4">4 variants</option>
                </ShellSelectField>
                <ShellSelectField
                  value={evolveChallengeCount}
                  onChange={(event) => setEvolveChallengeCount(event.target.value)}
                >
                  <option value="1">1 challenge</option>
                  <option value="2">2 challenges</option>
                  <option value="3">3 challenges</option>
                  <option value="4">4 challenges</option>
                </ShellSelectField>
              </div>
              <ShellSelectField
                value={evolveActivateBest}
                onChange={(event) => setEvolveActivateBest(event.target.value)}
              >
                <option value="yes">Activate best profile</option>
                <option value="no">Do not activate best</option>
              </ShellSelectField>
            </div>
            <ShellPillButton
              type="button"
              tone="outline"
              disabled={!canRunEvolution || Boolean(busyActionKey)}
              onClick={() =>
                runMutation("evolve", () =>
                  runDiscoveryImprovementEvolution({
                    request: {
                      seed_profile_id: evolveSeedProfileId,
                      reflection_ids: parsedEvolveReflectionIds,
                      task: evolveTask.trim(),
                      mutation_budget:
                        Math.max(
                          1,
                          Number.parseInt(evolveMutationBudget, 10) || 3
                        ),
                      challenge_count:
                        Math.max(
                          1,
                          Number.parseInt(evolveChallengeCount, 10) || 3
                        ),
                      activate_best: evolveActivateBest === "yes",
                    },
                    routeScope,
                  })
                )
              }
            >
              <ShellActionStateLabel
                busy={busyActionKey === "evolve"}
                idleLabel="Run Evolution"
                busyLabel="Evolving..."
                icon={<Sparkles className="h-4 w-4" />}
              />
            </ShellPillButton>
          </div>
        </ShellDetailCard>
      </ShellSectionCard>

      {loadState === "loading" && snapshot.profiles.length === 0 ? (
        <ShellLoadingState
          title="Loading improvement lab"
          description="Pulling prompt profiles, reflections, and self-play matches from Quorum."
        />
      ) : null}

      {loadState !== "loading" && snapshot.profiles.length === 0 ? (
        <ShellEmptyState
          centered
          icon={<Brain className="h-5 w-5" />}
          title="No prompt profiles yet"
          description="Quorum has not materialized any improvement-lab profiles yet."
          className="py-10"
        />
      ) : null}

      {snapshot.profiles.length > 0 ? (
        <>
          <ShellSectionCard
            title={selectedProfile?.label || "Selected profile"}
            description="Active prompt profile, mutation lineage, and the reflection pressure behind the current loop."
            actions={
              selectedProfile ? (
                <div className="flex items-center gap-2">
                  {isActiveProfile(selectedProfile) ? (
                    <ShellInlineStatus
                      icon={<TrendingUp className="h-4 w-4" />}
                      label="Active runtime profile"
                    />
                  ) : (
                    <ShellPillButton
                      type="button"
                      tone="primary"
                      onClick={() =>
                        runMutation("activate-profile", () =>
                          activateDiscoveryImprovementProfile({
                            profile: selectedProfile,
                            routeScope,
                          })
                        )
                      }
                      disabled={busyActionKey === "activate-profile"}
                    >
                      <ShellActionStateLabel
                        busy={busyActionKey === "activate-profile"}
                        idleLabel="Set Active"
                        busyLabel="Activating..."
                        icon={<Sparkles className="h-4 w-4" />}
                      />
                    </ShellPillButton>
                  )}
                </div>
              ) : undefined
            }
            contentClassName="space-y-3"
          >
            {selectedProfile ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-3">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Status",
                          value: <Badge tone={profileTone(selectedProfile)}>{isActiveProfile(selectedProfile) ? "active" : selectedProfile.operator_kind}</Badge>,
                          detail: metadataString(selectedProfile, "parent_profile_id") || "No parent lineage recorded.",
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-3">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Rating",
                          value: String(Math.round(selectedProfile.elo_rating)),
                          detail: `${selectedProfile.wins}W · ${selectedProfile.losses}L · ${selectedProfile.ties}T`,
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-3">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Updated",
                          value: safeFormatRelativeTime(selectedProfile.last_updated, safeFormatDate(selectedProfile.last_updated)),
                          detail: safeFormatDate(selectedProfile.last_updated),
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3.5 py-3">
                    <ShellFactTileGrid
                      items={[
                        {
                          label: "Usage",
                          value: String(selectedProfile.usage_count),
                          detail: `${metadataStrings(selectedProfile, "tactics").length} tactics attached`,
                        },
                      ]}
                      columnsClassName="grid-cols-1"
                    />
                  </div>
                </div>

                <ShellDetailCard className={PANEL_SURFACE_CLASS}>
                  <div className="text-[13px] font-medium text-foreground">Instruction</div>
                  <div className="mt-2.5 text-[12px] leading-6 text-muted-foreground">
                    {selectedProfile.instruction}
                  </div>
                </ShellDetailCard>

                <div className="grid gap-3 xl:grid-cols-2">
                  <TokenList
                    title="Tactics"
                    items={metadataStrings(selectedProfile, "tactics")}
                    emptyLabel="No tactics were stored on this profile."
                  />
                  <TokenList
                    title="Failure Tags Covered"
                    items={metadataStrings(selectedProfile, "failure_tags_covered")}
                    emptyLabel="No failure-tag coverage was recorded."
                  />
                </div>

                <div className="grid gap-3 xl:grid-cols-3">
                  <ShellDetailCard className={PANEL_SURFACE_CLASS}>
                    <div className="text-[13px] font-medium text-foreground">Generator Prefix</div>
                    <div className="mt-2.5 text-[12px] leading-6 text-muted-foreground">
                      {metadataString(selectedProfile, "generator_prefix") || "No generator prefix stored."}
                    </div>
                  </ShellDetailCard>
                  <ShellDetailCard className={PANEL_SURFACE_CLASS}>
                    <div className="text-[13px] font-medium text-foreground">Judge Prefix</div>
                    <div className="mt-2.5 text-[12px] leading-6 text-muted-foreground">
                      {metadataString(selectedProfile, "judge_prefix") || "No judge prefix stored."}
                    </div>
                  </ShellDetailCard>
                  <ShellDetailCard className={PANEL_SURFACE_CLASS}>
                    <div className="text-[13px] font-medium text-foreground">Critic Prefix</div>
                    <div className="mt-2.5 text-[12px] leading-6 text-muted-foreground">
                      {metadataString(selectedProfile, "critic_prefix") || "No critic prefix stored."}
                    </div>
                  </ShellDetailCard>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <ShellDetailCard className={PANEL_SURFACE_CLASS}>
                    <div className="text-[13px] font-medium text-foreground">Related Reflections</div>
                    {selectedReflections.length > 0 ? (
                      <div className="mt-3 space-y-2.5">
                        {selectedReflections.slice(0, 6).map((reflection) => (
                          <div
                            key={reflection.reflection_id}
                            className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              {reflection.failure_tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} tone="warning">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <div className="mt-1.5 text-[12px] font-medium text-foreground">
                              {reflection.task || reflection.source_kind}
                            </div>
                            <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
                              {reflection.recommendations[0] || reflection.strengths[0] || "No recommendation recorded."}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-[12px] leading-6 text-muted-foreground">
                        No related reflections were found for this profile.
                      </div>
                    )}
                  </ShellDetailCard>

                  <ShellDetailCard className={PANEL_SURFACE_CLASS}>
                    <div className="text-[13px] font-medium text-foreground">Recent Matches</div>
                    {selectedMatches.length > 0 ? (
                      <div className="mt-3 space-y-2.5">
                        {selectedMatches.slice(0, 6).map((match) => (
                          <div
                            key={match.match_id}
                            className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="text-[12px] font-medium text-foreground">
                                {match.match_id}
                              </div>
                              <Badge tone={matchWinnerTone(match, selectedProfile.profile_id)}>
                                {match.winner_profile_id === selectedProfile.profile_id
                                  ? "won"
                                  : match.winner_profile_id
                                    ? "lost"
                                    : "tie"}
                              </Badge>
                            </div>
                            <div className="mt-1 text-[12px] leading-5 text-muted-foreground">
                              {match.winner_reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-[12px] leading-6 text-muted-foreground">
                        No self-play matches have been recorded for this profile yet.
                      </div>
                    )}
                  </ShellDetailCard>
                </div>
              </>
            ) : (
        <ShellEmptyState
          centered
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Prompt profile unavailable"
          description="The selected prompt profile could not be recovered from Quorum."
          className="py-10"
        />
      )}
          </ShellSectionCard>

          <ShellSectionCard
            title="Prompt Profiles"
            description="Baseline, mutated, and self-improved profiles that drive discovery behavior."
            contentClassName="space-y-3"
          >
            <ShellHeroSearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter profiles by label, kind, tactic, or failure tag..."
            />

            {filteredProfiles.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.profile_id}
                    profile={profile}
                    selected={profile.profile_id === snapshot.selectedProfileId}
                    routeScope={routeScope}
                  />
                ))}
              </div>
            ) : (
              <ShellEmptyState
                centered
                icon={<Swords className="h-5 w-5" />}
                title="No matching profiles"
                description="Adjust the query to see the tracked improvement profiles again."
                className="py-10"
              />
            )}
          </ShellSectionCard>
        </>
      ) : null}
    </ShellPage>
  );
}

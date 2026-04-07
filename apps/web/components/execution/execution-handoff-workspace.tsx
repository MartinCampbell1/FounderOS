"use client";

import {
  type AutopilotLaunchPreset,
  type QuorumExecutionBrief,
  type ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { Rocket, FolderKanban } from "lucide-react";
import { useMemo, useState } from "react";

import { ShellRecordSection } from "@/components/shell/shell-record-primitives";
import { ShellRouteScopeBanner } from "@/components/shell/shell-route-scope-banner";
import {
  ShellActionStateLabel,
  ShellActionLink,
  ShellFilterChipLink,
  ShellHero,
  ShellInputField,
  ShellLoadingState,
  ShellPage,
  ShellPillButton,
  ShellSectionCard,
  ShellSelectField,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";
import type { ShellExecutionHandoffSnapshot } from "@/lib/execution";
import {
  createExecutionProjectFromHandoff,
} from "@/lib/execution-mutations";
import {
  buildRememberedExecutionReviewScopeHref,
  buildRememberedReviewScopeHref,
  resolveReviewMemoryBucket,
} from "@/lib/review-memory";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionHandoffSnapshot } from "@/lib/shell-snapshot-client";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";
import {
  resolveExecutionDraftValue,
  resolveExecutionLaunchPresetId,
} from "@/lib/execution-ui-state";
import {
  buildDiscoverySessionScopeHref,
  buildExecutionScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";

type LoadState = "loading" | "ready" | "error";
type ExecutionHandoffRouteScope = ShellRouteScope;

const EMPTY_EXECUTION_HANDOFF_SNAPSHOT: ShellExecutionHandoffSnapshot = {
  generatedAt: "",
  launchPresets: [],
  launchPresetsError: null,
  launchPresetsLoadState: "ready",
  intakeSessions: [],
  intakeSessionsError: null,
  intakeSessionsLoadState: "idle",
  intakeSession: null,
  intakeSessionError: null,
  intakeSessionLoadState: "idle",
  handoff: null,
  handoffError: null,
  handoffLoadState: "error",
};

function resolveLaunchPresetId(
  launchPresets: AutopilotLaunchPreset[],
  preferredPresetId: string
) {
  return launchPresets.some((preset) => preset.id === preferredPresetId)
    ? preferredPresetId
    : launchPresets[0]?.id ?? preferredPresetId;
}

function briefOrNull(value: Record<string, unknown>): QuorumExecutionBrief | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as unknown as QuorumExecutionBrief;
}

function stringList(items?: string[]) {
  return items && items.length > 0 ? items : [];
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Unknown";

  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatExpiry(value?: string | null) {
  if (!value) return "No expiry";

  const diffMs = new Date(value).getTime() - Date.now();
  if (diffMs <= 0) return "Expired";

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) return `Expires in ${Math.max(1, diffMinutes)}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Expires in ${diffHours}h`;

  return `Expires in ${Math.floor(diffHours / 24)}d`;
}

function launchIntentTone(intent: string | null | undefined) {
  if (intent === "launch") return "success" as const;
  if (intent === "create") return "info" as const;
  return "neutral" as const;
}

function launchIntentLabel(intent: string | null | undefined) {
  if (intent === "launch") return "Launch";
  if (intent === "create") return "Create";
  return "Draft";
}

function HandoffListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <ShellRecordSection title={title}>
      <div className="mt-3 space-y-2 text-sm leading-7 text-foreground/84">
        {items.length > 0 ? (
          items.map((item) => <p key={item}>{item}</p>)
        ) : (
          <p className="text-muted-foreground">No entries recorded.</p>
        )}
      </div>
    </ShellRecordSection>
  );
}

export function ExecutionHandoffWorkspace({
  handoffId,
  initialPreferences,
  initialSnapshot,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  handoffId: string;
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionHandoffSnapshot | null;
  routeScope?: ExecutionHandoffRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const reviewMemoryBucket = useMemo(
    () => resolveReviewMemoryBucket({ scope: routeScope }),
    [routeScope]
  );
  const executionReviewHref = useMemo(
    () =>
      buildRememberedExecutionReviewScopeHref({
        scope: routeScope,
        preferences,
        bucket: reviewMemoryBucket,
      }),
    [preferences, reviewMemoryBucket, routeScope]
  );
  const unifiedReviewHref = useMemo(
    () =>
      buildRememberedReviewScopeHref({
        scope: routeScope,
        preferences,
        bucket: reviewMemoryBucket,
    }),
    [preferences, reviewMemoryBucket, routeScope]
  );
  const handoffsHref = useMemo(() => {
    const params = new URLSearchParams();
    if (routeScope.projectId) {
      params.set("project_id", routeScope.projectId);
    }
    if (routeScope.intakeSessionId) {
      params.set("intake_session_id", routeScope.intakeSessionId);
    }
    const query = params.toString();
    return query ? `/execution/handoffs?${query}` : "/execution/handoffs";
  }, [routeScope.intakeSessionId, routeScope.projectId]);
  const {
    busyActionKey: busyAction,
    errorMessage,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner({
    planes: ["execution"],
    scope: routeScope,
    source: "execution-handoff",
    reason: "handoff-project-create",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    invalidation: {
      planes: ["discovery", "execution"],
      scope: routeScope,
    },
    invalidationOptions: {
      ignoreSources: ["execution-handoff"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "execution_project_detail",
    preferences.refreshProfile
  );
  const loadSnapshot = useMemo(
    () => () => fetchShellExecutionHandoffSnapshot(handoffId),
    [handoffId]
  );
  const selectLoadState = useMemo(
    () =>
      (snapshot: ShellExecutionHandoffSnapshot) =>
        snapshot.handoffLoadState === "ready" ? "ready" : "error",
    []
  );
  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_EXECUTION_HANDOFF_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });
  const handoff = snapshot.handoff;
  const handoffLoadState: LoadState = loadState;
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const launchPresets = snapshot.launchPresets;
  const launchPresetsError = snapshot.launchPresetsError;
  const [selectedLaunchPresetId, setSelectedLaunchPresetId] = useState(() =>
    resolveLaunchPresetId(
      initialSnapshot?.launchPresets ?? [],
      initialSnapshot?.handoff?.recommended_launch_preset_id ?? "team"
    )
  );
  const error = errorMessage ?? snapshot.handoffError;

  const brief = useMemo(
    () => (handoff ? briefOrNull(handoff.brief) : null),
    [handoff]
  );
  const effectiveSelectedLaunchPresetId = useMemo(
    () =>
      resolveExecutionLaunchPresetId(
        launchPresets,
        selectedLaunchPresetId,
        handoff?.recommended_launch_preset_id ?? "team"
      ),
    [
      handoff?.recommended_launch_preset_id,
      launchPresets,
      selectedLaunchPresetId,
    ]
  );
  const displayedProjectName = useMemo(
    () =>
      resolveExecutionDraftValue(
        projectName,
        handoff?.default_project_name || brief?.title
      ),
    [brief?.title, handoff?.default_project_name, projectName]
  );

  const selectedLaunchPreset = useMemo(
    () =>
      launchPresets.find(
        (preset) => preset.id === effectiveSelectedLaunchPresetId
      ) ?? null,
    [effectiveSelectedLaunchPresetId, launchPresets]
  );

  async function handleCreateProject(launch: boolean) {
    if (!brief || busyAction.length > 0) {
      return;
    }

    await runMutation(
      launch ? "launch" : "create",
      () =>
        createExecutionProjectFromHandoff({
          brief: brief as unknown as Record<string, unknown>,
          projectName:
            projectName.trim() || handoff?.default_project_name || brief.title,
          projectPath: projectPath.trim() || undefined,
          priority: handoff?.launch_intent === "launch" ? "high" : "normal",
          launch,
          launchProfile: launch
            ? selectedLaunchPreset?.launch_profile ?? {
                preset: effectiveSelectedLaunchPresetId,
              }
            : null,
          intakeSessionId: routeScope.intakeSessionId,
          routeScope,
        }),
      {
        fallbackErrorMessage:
          "Failed to create project from discovery handoff.",
      }
    );
  }

  if (handoffLoadState === "loading") {
    return (
      <ShellPage className="max-w-[1240px]">
        <div className="flex min-h-[calc(100vh-245px)] items-center justify-center">
          <ShellLoadingState description="Loading discovery handoff..." className="py-10" />
        </div>
      </ShellPage>
    );
  }

  if (handoffLoadState === "error" || !handoff || !brief) {
    return (
      <ShellPage className="max-w-[1240px]">
        <div className="flex min-h-[calc(100vh-245px)] items-center justify-center">
          <ShellStatusBanner tone="danger" className="w-full max-w-2xl space-y-4 py-10">
            <p>{error || "Cross-plane handoff is unavailable."}</p>
            <ShellActionLink
              href={buildExecutionScopeHref(routeScope)}
              label="Back to execution"
            />
          </ShellStatusBanner>
        </div>
      </ShellPage>
    );
  }

  return (
    <ShellPage className="max-w-[1480px]">
      <ShellHero
        title={brief.title}
        description={brief.thesis}
        meta={
          <>
            <Badge tone={launchIntentTone(handoff.launch_intent)}>
              {launchIntentLabel(handoff.launch_intent)}
            </Badge>
            <span>Source: {handoff.source_session_id ?? handoff.source_plane}</span>
            <span>Created {formatRelativeTime(handoff.created_at)}</span>
            <span>{formatExpiry(handoff.expires_at)}</span>
          </>
        }
        actions={
          <>
            <ShellFilterChipLink
              href={handoffsHref}
              label="Queue"
            />
            <ShellFilterChipLink
              href={buildExecutionScopeHref(routeScope)}
              label="Execution"
            />
            <ShellFilterChipLink href={executionReviewHref} label="Execution review" />
            <ShellFilterChipLink href={unifiedReviewHref} label="Unified review" />
          </>
        }
      />
      <ShellRouteScopeBanner
        scope={routeScope}
        description="This execution brief inherits the active project and intake scope so operators can stay on the same linked chain while moving between discovery, handoff, and execution review surfaces."
        clearHref="/execution/handoffs"
      />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_390px]">
      <div className="space-y-4">
        {handoff.source_session_id ? (
          <ShellSectionCard title="Source session" contentClassName="py-4">
              <ShellActionLink
                href={buildDiscoverySessionScopeHref(
                  handoff.source_session_id,
                  routeScope
                )}
                label="Back to source session"
              />
          </ShellSectionCard>
        ) : null}

        <ShellSectionCard
          title="Execution brief"
          contentClassName="space-y-4"
        >
            <ShellRecordSection title="Thesis">
              <p className="mt-3 text-sm leading-7 text-foreground/84">{brief.thesis}</p>
            </ShellRecordSection>

            {stringList(brief.tags).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {brief.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <HandoffListSection
                title="MVP scope"
                items={stringList(brief.execution?.mvp_scope)}
              />
              <HandoffListSection
                title="Success metrics"
                items={stringList(brief.evaluation?.success_metrics)}
              />
              <HandoffListSection
                title="Open questions"
                items={stringList(brief.evaluation?.open_questions)}
              />
              <HandoffListSection
                title="Existing repos"
                items={stringList(brief.execution?.existing_repos)}
              />
            </div>
        </ShellSectionCard>
      </div>

      <div className="space-y-4">
        <ShellSectionCard
          title="Create execution project"
          contentClassName="space-y-4"
        >
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Project name
              </span>
              <ShellInputField
                value={displayedProjectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder={handoff.default_project_name || brief.title}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Project path
              </span>
              <ShellInputField
                value={projectPath}
                onChange={(event) => setProjectPath(event.target.value)}
                placeholder="Optional custom workspace path"
              />
            </label>

            {launchPresets.length > 0 ? (
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Launch preset
                </span>
                <ShellSelectField
                  value={effectiveSelectedLaunchPresetId}
                  onChange={(event) => setSelectedLaunchPresetId(event.target.value)}
                >
                  {launchPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </ShellSelectField>
                {selectedLaunchPreset ? (
                  <p className="text-sm leading-7 text-muted-foreground">
                    {selectedLaunchPreset.description}
                  </p>
                ) : null}
              </label>
            ) : (
              <ShellStatusBanner tone="info">
                {launchPresetsError
                  ? "Autopilot launch presets are unavailable right now. Create-and-launch will recover once the upstream reconnects."
                  : "Autopilot launch presets are unavailable right now. Project creation still works, but create-and-launch will need attention once the upstream returns."}
              </ShellStatusBanner>
            )}

            <div className="flex flex-wrap gap-2">
              <ShellPillButton
                type="button"
                tone="outline"
                onClick={() => void handleCreateProject(false)}
                disabled={busyAction.length > 0}
              >
                <ShellActionStateLabel
                  busy={busyAction === "create"}
                  idleLabel="Create project"
                  busyLabel="Create project"
                  icon={<FolderKanban className="h-4 w-4" />}
                />
              </ShellPillButton>
              <ShellPillButton
                type="button"
                tone="primary"
                onClick={() => void handleCreateProject(true)}
                disabled={busyAction.length > 0}
              >
                <ShellActionStateLabel
                  busy={busyAction === "launch"}
                  idleLabel="Create and launch"
                  busyLabel="Create and launch"
                  icon={<Rocket className="h-4 w-4" />}
                />
              </ShellPillButton>
            </div>

            {statusMessage ? (
              <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
            ) : null}

            {error ? (
              <ShellStatusBanner tone="danger">{error}</ShellStatusBanner>
            ) : null}
        </ShellSectionCard>
      </div>
      </section>
    </ShellPage>
  );
}

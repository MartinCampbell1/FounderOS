"use client";

import {
  type AutopilotIntakeSessionSummary,
  type AutopilotLaunchPreset,
  type AutopilotPrd,
  type AutopilotSpecBootstrap,
  type ShellPreferences,
} from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { cn } from "@founderos/ui/lib/utils";
import {
  ArrowUp,
  Bot,
  FileText,
  FileUp,
  FolderKanban,
  MessageSquarePlus,
  Rocket,
  Share2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ShellRecordCard,
  ShellRecordHeader,
} from "@/components/shell/shell-record-primitives";
import {
  ShellInlineStatus,
  ShellActionStateLabel,
  ShellActionLink,
  ShellComposerTextarea,
  ShellEmptyState,
  ShellFilterChipLink,
  ShellPillButton,
  ShellSectionCard,
  ShellSelectField,
  ShellShortcutCombo,
  ShellStatusBanner,
  ShellInputField,
} from "@/components/shell/shell-screen-primitives";
import type { ShellExecutionIntakeSnapshot } from "@/lib/execution";
import {
  createExecutionProjectFromPrd,
  generateExecutionIntakePrd,
  sendExecutionIntakeConversationMessage,
} from "@/lib/execution-mutations";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { fetchShellExecutionIntakeSnapshot } from "@/lib/shell-snapshot-client";
import {
  normalizeExecutionIntakeMessages,
  reconcileExecutionCreatedProject,
  reconcileExecutionIntakeResponse,
  reconcileExecutionIntakeSessionDetail,
  resolveExecutionDraftValue,
  resolveExecutionLaunchPresetId,
} from "@/lib/execution-ui-state";
import {
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  buildExecutionScopeHref,
  routeScopeFromIntakeSessionRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import { useShellRouteMutationRunner } from "@/lib/use-shell-route-mutation-runner";
import { useShellSnapshotRefreshNonce } from "@/lib/use-shell-snapshot-refresh-nonce";

type IntakeMessage = {
  role: "user" | "assistant";
  content: string;
};
type ExecutionIntakeRouteScope = ShellRouteScope;

const EMPTY_EXECUTION_INTAKE_SNAPSHOT: ShellExecutionIntakeSnapshot = {
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
};

function resolveLaunchPresetId(
  launchPresets: AutopilotLaunchPreset[],
  preferredPresetId: string
) {
  return launchPresets.some((preset) => preset.id === preferredPresetId)
    ? preferredPresetId
    : launchPresets[0]?.id ?? preferredPresetId;
}

function formatSessionTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value || "just now";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function IntakeSessionsSidebar({
  sessions,
  activeSessionId,
  sessionsError,
  routeScope,
}: {
  sessions: AutopilotIntakeSessionSummary[];
  activeSessionId: string | null;
  sessionsError: string | null;
  routeScope: ExecutionIntakeRouteScope;
}) {
  return (
    <div className="flex h-full flex-col border-r border-border/60 bg-[color:var(--shell-panel-bg,theme(colors.muted/0.3))]">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sessions
        </span>
        <a
          href={buildExecutionIntakeScopeHref(undefined, routeScope)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </a>
      </div>

      {sessionsError ? (
        <div className="px-3 pt-3">
          <ShellStatusBanner tone="warning">{sessionsError}</ShellStatusBanner>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">
            No sessions yet. Start a conversation to create one.
          </p>
        ) : (
          <div className="space-y-0.5">
            {sessions.slice(0, 12).map((session) => {
              const isActive = session.id === activeSessionId;
              const sessionHref = buildExecutionIntakeScopeHref(
                session.id,
                routeScopeFromIntakeSessionRef(
                  session.id,
                  session.linked_project_id,
                  routeScope
                )
              );
              return (
                <a
                  key={session.id}
                  href={isActive ? undefined : sessionHref}
                  className={cn(
                    "group block rounded-lg px-3 py-2.5 transition-colors",
                    isActive
                      ? "bg-accent/12 text-foreground"
                      : "text-foreground/80 hover:bg-accent/8"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-[13px] font-medium leading-5">
                      {session.title || "Untitled session"}
                    </span>
                    {session.prd_ready ? (
                      <Badge tone="info" className="shrink-0 text-[10px]">PRD</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground">
                    {session.last_message || "No messages yet"}
                  </p>
                  <span className="mt-1 block text-[10px] leading-3 text-muted-foreground/60">
                    {formatSessionTimestamp(session.updated_at)}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IntakeBootstrapBanner({
  bootstrap,
  canGeneratePrd,
  loading,
  onGeneratePrd,
}: {
  bootstrap: AutopilotSpecBootstrap | null;
  canGeneratePrd: boolean;
  loading: boolean;
  onGeneratePrd: () => Promise<void>;
}) {
  if (!bootstrap) return null;

  return (
    <div className="mx-auto w-full max-w-[720px] rounded-xl border border-border/50 bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-accent" />
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Bootstrap
            </span>
          </div>
          <p className="mt-1 text-[13px] font-medium leading-5 text-foreground">
            {bootstrap.title}
          </p>
          {bootstrap.open_questions.length > 0 ? (
            <div className="mt-2 space-y-1">
              {bootstrap.open_questions.slice(0, 3).map((question) => (
                <p key={question} className="text-[12px] leading-4 text-muted-foreground">
                  {question}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[12px] leading-4 text-muted-foreground">
              Ready to generate PRD.
            </p>
          )}
        </div>
        <ShellPillButton
          type="button"
          tone="primary"
          onClick={() => void onGeneratePrd()}
          disabled={!canGeneratePrd || loading}
          className="shrink-0"
        >
          <ShellActionStateLabel
            busy={loading}
            idleLabel="Generate PRD"
            busyLabel="Generating..."
            icon={<FileText className="h-3.5 w-3.5" />}
          />
        </ShellPillButton>
      </div>
    </div>
  );
}

function PrdSummaryCard({
  prd,
  projectName,
  projectPath,
  launchPresets,
  selectedLaunchPresetId,
  launchPresetsError,
  createdProjectId,
  createdProjectHref,
  pendingAction,
  errorMessage,
  statusMessage,
  onProjectNameChange,
  onProjectPathChange,
  onLaunchPresetChange,
  onCreateProject,
}: {
  prd: AutopilotPrd | null;
  projectName: string;
  projectPath: string;
  launchPresets: AutopilotLaunchPreset[];
  selectedLaunchPresetId: string;
  launchPresetsError: string | null;
  createdProjectId: string | null;
  createdProjectHref: string | null;
  pendingAction: "" | "create" | "create-launch";
  errorMessage: string | null;
  statusMessage: string | null;
  onProjectNameChange: (value: string) => void;
  onProjectPathChange: (value: string) => void;
  onLaunchPresetChange: (value: string) => void;
  onCreateProject: (launch: boolean) => Promise<void>;
}) {
  const selectedLaunchPreset = useMemo(
    () => launchPresets.find((preset) => preset.id === selectedLaunchPresetId) ?? null,
    [launchPresets, selectedLaunchPresetId]
  );

  return (
    <ShellSectionCard
      title="Project draft"
      className="min-h-[640px]"
      contentClassName="space-y-4"
    >
        {launchPresetsError ? (
          <ShellStatusBanner tone="warning">{launchPresetsError}</ShellStatusBanner>
        ) : null}

        {!prd ? (
          <ShellEmptyState
            title="No PRD yet"
            description="Start the intake conversation, answer the clarifying questions, and then generate a PRD to create an execution project."
            icon={
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-muted">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
            }
            className="min-h-[420px]"
            centered
          />
        ) : (
          <>
            <ShellRecordCard>
              <ShellRecordHeader
                badges={
                  <>
                    <Badge tone="info">PRD ready</Badge>
                    <Badge tone="neutral">{prd.stories.length} stories</Badge>
                    <Badge tone="neutral">{prd.phases?.length ?? 0} phases</Badge>
                  </>
                }
                title={prd.title}
                description={prd.description}
              />
            </ShellRecordCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Project name
                </span>
                <ShellInputField
                  value={projectName}
                  onChange={(event) => onProjectNameChange(event.target.value)}
                  placeholder={prd.title}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Project path
                </span>
                <ShellInputField
                  value={projectPath}
                  onChange={(event) => onProjectPathChange(event.target.value)}
                  placeholder="Optional custom workspace path"
                />
              </label>
            </div>

            {launchPresets.length > 0 ? (
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Launch preset
                </span>
                <ShellSelectField
                  value={selectedLaunchPresetId}
                  onChange={(event) => onLaunchPresetChange(event.target.value)}
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
              <ShellStatusBanner tone="warning">
                {launchPresetsError ||
                  "Launch presets unavailable. You can still create projects manually."}
              </ShellStatusBanner>
            )}

            <div className="flex flex-wrap gap-2">
              <ShellPillButton
                type="button"
                tone="outline"
                onClick={() => void onCreateProject(false)}
                disabled={pendingAction.length > 0}
              >
                <ShellActionStateLabel
                  busy={pendingAction === "create"}
                  idleLabel="Create project"
                  busyLabel="Create project"
                  icon={<FolderKanban className="h-4 w-4" />}
                />
              </ShellPillButton>
              <ShellPillButton
                type="button"
                tone="primary"
                onClick={() => void onCreateProject(true)}
                disabled={pendingAction.length > 0}
              >
                <ShellActionStateLabel
                  busy={pendingAction === "create-launch"}
                  idleLabel="Create and launch"
                  busyLabel="Create and launch"
                  icon={<Rocket className="h-4 w-4" />}
                />
              </ShellPillButton>
            </div>

            {statusMessage ? (
              <ShellStatusBanner tone="success">{statusMessage}</ShellStatusBanner>
            ) : null}

            {errorMessage ? (
              <ShellStatusBanner tone="danger">{errorMessage}</ShellStatusBanner>
            ) : null}

            {createdProjectId ? (
              <ShellActionLink
                href={
                  createdProjectHref ||
                  buildExecutionProjectScopeHref(createdProjectId)
                }
                label="Open created project"
              />
            ) : null}

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Story outline
              </div>
              <div className="space-y-3">
                {prd.stories.slice(0, 6).map((story) => (
                  <ShellRecordCard key={story.id}>
                    <ShellRecordHeader
                      badges={
                        <Badge tone="neutral">
                          {story.phase_title || story.phase_id || `Story ${story.id}`}
                        </Badge>
                      }
                      title={story.title}
                      description={story.description}
                    />
                  </ShellRecordCard>
                ))}
              </div>
            </div>
          </>
        )}
    </ShellSectionCard>
  );
}

export function ExecutionIntakeWorkspace({
  initialPreferences,
  initialSnapshot,
  requestedSessionId,
  routeScope = { projectId: "", intakeSessionId: "" },
}: {
  initialPreferences?: ShellPreferences;
  initialSnapshot?: ShellExecutionIntakeSnapshot | null;
  requestedSessionId?: string | null;
  routeScope?: ExecutionIntakeRouteScope;
}) {
  const { preferences } = useShellPreferences(initialPreferences);
  const initialLaunchPresets = initialSnapshot?.launchPresets ?? [];
  const initialIntakeSession = initialSnapshot?.intakeSession ?? null;
  const [messages, setMessages] = useState<IntakeMessage[]>(
    initialIntakeSession
      ? normalizeExecutionIntakeMessages(initialIntakeSession.messages)
      : []
  );
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(
    initialIntakeSession?.session_id ?? requestedSessionId ?? null
  );
  const [bootstrap, setBootstrap] = useState<AutopilotSpecBootstrap | null>(
    initialIntakeSession?.spec_bootstrap ?? null
  );
  const [canGeneratePrd, setCanGeneratePrd] = useState(
    initialIntakeSession?.can_generate_prd ?? false
  );
  const [prd, setPrd] = useState<AutopilotPrd | null>(
    initialIntakeSession?.prd ?? null
  );
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(
    initialSnapshot?.intakeSessionError ?? null
  );
  const [linkedProjectId, setLinkedProjectId] = useState<string>(
    initialIntakeSession?.linked_project_id ?? ""
  );
  const [linkedProjectName, setLinkedProjectName] = useState<string>(
    initialIntakeSession?.linked_project_name ?? ""
  );
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [selectedLaunchPresetId, setSelectedLaunchPresetId] = useState(() =>
    resolveLaunchPresetId(initialLaunchPresets, "fast")
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const routeSessionId = requestedSessionId || sessionId || null;
  const initialRouteScope = routeScopeFromIntakeSessionRef(
    routeSessionId,
    linkedProjectId,
    routeScope
  );
  const {
    busyActionKey,
    errorMessage,
    refreshNonce,
    runMutation,
    statusMessage,
  } = useShellRouteMutationRunner({
    planes: ["execution"],
    scope: initialRouteScope,
    source: "execution-intake",
    reason: "intake-mutation",
  });
  const snapshotRefreshNonce = useShellSnapshotRefreshNonce({
    baseRefreshNonce: refreshNonce,
    invalidation: {
      planes: ["discovery", "execution"],
      scope: initialRouteScope,
    },
    invalidationOptions: {
      ignoreSources: ["execution-intake"],
      since: initialSnapshot?.generatedAt ?? null,
    },
  });
  const pollInterval = getShellPollInterval(
    "execution_project_detail",
    preferences.refreshProfile
  );
  const loadSnapshot = useMemo(
    () => () => fetchShellExecutionIntakeSnapshot(routeSessionId),
    [routeSessionId]
  );
  const selectLoadState = useMemo(
    () =>
      (snapshot: ShellExecutionIntakeSnapshot) =>
        routeSessionId
          ? snapshot.intakeSessionLoadState === "ready"
            ? "ready"
            : snapshot.intakeSessionLoadState === "idle"
              ? "ready"
              : "error"
          : snapshot.launchPresetsLoadState === "ready" ||
              snapshot.intakeSessionsLoadState === "ready"
            ? "ready"
            : "error",
    [routeSessionId]
  );
  const { snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_EXECUTION_INTAKE_SNAPSHOT,
    initialSnapshot,
    refreshNonce: snapshotRefreshNonce,
    pollIntervalMs: pollInterval,
    loadSnapshot,
    selectLoadState,
  });
  const launchPresets = snapshot.launchPresets;
  const launchPresetsError = snapshot.launchPresetsError;
  const intakeSessions = snapshot.intakeSessions;
  const intakeSessionsError = snapshot.intakeSessionsError;
  const resolvedSnapshotState = useMemo(
    () =>
      busyActionKey.length > 0
        ? null
        : snapshot.intakeSession
          ? reconcileExecutionIntakeSessionDetail(
              snapshot.intakeSession,
              snapshot.intakeSessionError
            )
          : {
              sessionId: routeSessionId,
              messages,
              bootstrap,
              canGeneratePrd,
              prd,
              linkedProjectId,
              linkedProjectName,
              sessionLoadError: routeSessionId
                ? snapshot.intakeSessionError
                : null,
            },
    [
      bootstrap,
      busyActionKey,
      canGeneratePrd,
      linkedProjectId,
      linkedProjectName,
      messages,
      prd,
      routeSessionId,
      snapshot.intakeSession,
      snapshot.intakeSessionError,
    ]
  );
  const effectiveSessionId = resolvedSnapshotState?.sessionId ?? routeSessionId;
  const effectiveMessages = resolvedSnapshotState?.messages ?? messages;
  const effectiveBootstrap = resolvedSnapshotState?.bootstrap ?? bootstrap;
  const effectiveCanGeneratePrd =
    resolvedSnapshotState?.canGeneratePrd ?? canGeneratePrd;
  const effectivePrd = resolvedSnapshotState?.prd ?? prd;
  const linkedProjectSummary = useMemo(
    () =>
      effectiveSessionId
        ? intakeSessions.find((session) => session.id === effectiveSessionId) ?? null
        : null,
    [effectiveSessionId, intakeSessions]
  );
  const effectiveLinkedProjectId =
    linkedProjectSummary?.linked_project_id ||
    resolvedSnapshotState?.linkedProjectId ||
    linkedProjectId;
  const effectiveLinkedProjectName =
    linkedProjectSummary?.linked_project_name ||
    resolvedSnapshotState?.linkedProjectName ||
    linkedProjectName;
  const effectiveSessionLoadError =
    resolvedSnapshotState?.sessionLoadError ?? sessionLoadError;
  const effectiveSelectedLaunchPresetId = useMemo(
    () =>
      resolveExecutionLaunchPresetId(
        launchPresets,
        selectedLaunchPresetId,
        "fast"
      ),
    [launchPresets, selectedLaunchPresetId]
  );
  const loading =
    busyActionKey === "send" || busyActionKey === "generate-prd";
  const pendingAction =
    busyActionKey === "create" || busyActionKey === "create-launch"
      ? busyActionKey
      : "";
  const activeRouteScope = routeScopeFromIntakeSessionRef(
    effectiveSessionId,
    effectiveLinkedProjectId,
    routeScope
  );
  const displayedProjectName = useMemo(
    () => resolveExecutionDraftValue(projectName, effectivePrd?.title),
    [effectivePrd?.title, projectName]
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 160 || effectiveMessages.length <= 2 || loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [effectiveMessages, loading]);

  async function handleSendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setSessionLoadError(null);
    setMessages([...effectiveMessages, { role: "user", content: text }]);
    await runMutation(
      "send",
      () =>
        sendExecutionIntakeConversationMessage({
          message: text,
          sessionId: routeSessionId,
          routeScope: activeRouteScope,
        }),
      {
        fallbackErrorMessage: "Failed to reach the Autopilot intake service.",
        onError: () => {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: "The intake agent is unavailable right now.",
            },
          ]);
          inputRef.current?.focus();
        },
        onSuccess: (effect) => {
          const response = effect.data?.response;
          if (!response) {
            throw new Error("Intake response payload missing.");
          }
          const nextState = reconcileExecutionIntakeResponse(
            response,
            routeSessionId
          );
          setSessionId(nextState.sessionId);
          setBootstrap(nextState.bootstrap);
          setCanGeneratePrd(nextState.canGeneratePrd);
          if (nextState.linkedProjectId !== null) {
            setLinkedProjectId(nextState.linkedProjectId);
          }
          if (nextState.linkedProjectName !== null) {
            setLinkedProjectName(nextState.linkedProjectName);
          }
          const assistantMessage = nextState.assistantMessage;
          if (assistantMessage) {
            setMessages((current) => [...current, assistantMessage]);
          }
          setPrd(nextState.prd);
          inputRef.current?.focus();
        },
      }
    );
  }

  async function handleGeneratePrd() {
    if (!effectiveSessionId || loading) return;

    setSessionLoadError(null);
    await runMutation(
      "generate-prd",
      () =>
        generateExecutionIntakePrd({
          sessionId: effectiveSessionId,
          linkedProjectId: effectiveLinkedProjectId,
          routeScope: activeRouteScope,
        }),
      {
        fallbackErrorMessage:
          "Failed to generate a PRD from the current intake session.",
        onSuccess: (effect) => {
          setPrd(effect.data?.prd ?? null);
        },
      }
    );
  }

  async function handleCreateProject(launch: boolean) {
    if (!effectivePrd || pendingAction.length > 0) return;

    setCreatedProjectId(null);
    await runMutation(
      launch ? "create-launch" : "create",
      () =>
        createExecutionProjectFromPrd({
          prd: effectivePrd,
          projectName: projectName.trim() || effectivePrd.title || undefined,
          projectPath: projectPath.trim() || undefined,
          intakeSessionId: effectiveSessionId,
          routeScope: activeRouteScope,
          launch,
          selectedLaunchPresetId: effectiveSelectedLaunchPresetId,
          launchPresets,
        }),
      {
        fallbackErrorMessage: "Project creation failed.",
        onSuccess: (effect) => {
          const createdProject = effect.data?.createdProject ?? null;
          if (!createdProject) {
            throw new Error("Project creation payload missing.");
          }
          const nextState = reconcileExecutionCreatedProject(
            createdProject,
            Boolean(effect.href)
          );
          setLinkedProjectId(nextState.linkedProjectId);
          setLinkedProjectName(nextState.linkedProjectName);
          setCreatedProjectId(nextState.createdProjectId);
        },
      }
    );
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  const hasSessions = intakeSessions.length > 0;
  const showPrdPanel = effectivePrd !== null;

  return (
    <div className="flex h-[calc(100dvh-var(--shell-header-height,56px))] overflow-hidden">
      {/* ── Sessions sidebar ── */}
      {hasSessions ? (
        <div className="hidden w-[260px] shrink-0 lg:block">
          <IntakeSessionsSidebar
            sessions={intakeSessions}
            activeSessionId={effectiveSessionId}
            sessionsError={intakeSessionsError}
            routeScope={activeRouteScope}
          />
        </div>
      ) : null}

      {/* ── Main chat column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-foreground">
              Execution Intake
            </h1>
            {effectiveSessionId ? (
              <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">
                {effectiveSessionId}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <ShellFilterChipLink href={buildExecutionScopeHref(activeRouteScope)} label="Execution" />
            {effectiveLinkedProjectId ? (
              <ShellFilterChipLink
                href={buildExecutionProjectScopeHref(effectiveLinkedProjectId, activeRouteScope)}
                label={effectiveLinkedProjectName || "Project"}
              />
            ) : null}
          </div>
        </div>

        {/* Session load error */}
        {effectiveSessionLoadError ? (
          <div className="px-4 pt-3 sm:px-6">
            <ShellStatusBanner tone="danger">
              <p>{effectiveSessionLoadError}</p>
              <ShellActionLink
                href={buildExecutionIntakeScopeHref(undefined, routeScope)}
                label="Start a new intake"
              />
            </ShellStatusBanner>
          </div>
        ) : null}

        {/* Bootstrap banner (shown when interview data available) */}
        {effectiveBootstrap ? (
          <div className="px-4 pt-3 sm:px-6">
            <IntakeBootstrapBanner
              bootstrap={effectiveBootstrap}
              canGeneratePrd={effectiveCanGeneratePrd}
              loading={loading}
              onGeneratePrd={handleGeneratePrd}
            />
          </div>
        ) : null}

        {/* Chat messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        >
          {effectiveMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <Bot className="h-6 w-6 text-accent" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                  What would you like to build?
                </h2>
                <p className="max-w-sm text-[13px] leading-5 text-muted-foreground">
                  Describe your project idea and the intake agent will ask clarifying
                  questions, then generate a PRD with stories ready for execution.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[720px] space-y-5">
              {effectiveMessages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
                    <div className={cn("flex max-w-[70%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
                      {!isUser ? (
                        <div className="flex items-center gap-1.5 px-1">
                          <Bot className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-[11px] font-medium text-muted-foreground/60">
                            Intake agent
                          </span>
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-[14px] leading-6",
                          isUser
                            ? "bg-foreground text-background"
                            : "bg-muted/70 text-foreground"
                        )}
                      >
                        <span className="whitespace-pre-wrap">{message.content}</span>
                      </div>
                      <span className="px-1 text-[11px] leading-3 text-muted-foreground/40">
                        just now
                      </span>
                    </div>
                  </div>
                );
              })}

              {loading ? (
                <div className="flex justify-start">
                  <div className="flex max-w-[70%] flex-col gap-1 items-start">
                    <div className="flex items-center gap-1.5 px-1">
                      <Bot className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[11px] font-medium text-muted-foreground/60">
                        Intake agent
                      </span>
                    </div>
                    <ShellInlineStatus
                      busy
                      label="Thinking..."
                      className="rounded-2xl bg-muted/70 px-4 py-2.5"
                    />
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input area (fixed at bottom) ── */}
        <div className="border-t border-border/40 bg-background/80 px-4 pb-4 pt-3 backdrop-blur-sm sm:px-6">
          <div className="mx-auto max-w-[720px]">
            <div className="relative">
              <ShellComposerTextarea
                textareaRef={inputRef}
                placeholder="Describe what you want to build..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="min-h-[56px] resize-none rounded-2xl pr-12"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={loading || !input.trim()}
                className={cn(
                  "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                  input.trim() && !loading
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>

            {/* Action buttons row */}
            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShellPillButton type="button" tone="outline" compact disabled>
                  <FileUp className="h-3 w-3" />
                  <span>Import spec</span>
                </ShellPillButton>
                <ShellPillButton type="button" tone="outline" compact disabled>
                  <Share2 className="h-3 w-3" />
                  <span>Import brief</span>
                </ShellPillButton>
                {effectiveCanGeneratePrd && effectiveSessionId ? (
                  <ShellPillButton
                    type="button"
                    tone="primary"
                    compact
                    onClick={() => void handleGeneratePrd()}
                    disabled={loading}
                  >
                    <ShellActionStateLabel
                      busy={loading && busyActionKey === "generate-prd"}
                      idleLabel="Generate PRD"
                      busyLabel="Generating..."
                      icon={<FileText className="h-3 w-3" />}
                    />
                  </ShellPillButton>
                ) : null}
              </div>
              <ShellShortcutCombo keys={["Enter"]} />
            </div>
          </div>
        </div>
      </div>

      {/* ── PRD side panel (appears when PRD is generated) ── */}
      {showPrdPanel ? (
        <div className="hidden w-[440px] shrink-0 overflow-y-auto border-l border-border/50 bg-background xl:block">
          <div className="p-4">
            <PrdSummaryCard
              prd={effectivePrd}
              projectName={displayedProjectName}
              projectPath={projectPath}
              launchPresets={launchPresets}
              selectedLaunchPresetId={effectiveSelectedLaunchPresetId}
              launchPresetsError={launchPresetsError}
              createdProjectId={createdProjectId}
              createdProjectHref={
                createdProjectId
                  ? buildExecutionProjectScopeHref(createdProjectId, activeRouteScope)
                  : null
              }
              pendingAction={pendingAction}
              errorMessage={errorMessage}
              statusMessage={statusMessage}
              onProjectNameChange={setProjectName}
              onProjectPathChange={setProjectPath}
              onLaunchPresetChange={setSelectedLaunchPresetId}
              onCreateProject={handleCreateProject}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

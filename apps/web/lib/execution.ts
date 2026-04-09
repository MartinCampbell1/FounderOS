import type {
  AutopilotLaunchPreset,
  AutopilotIntakeSessionDetail,
  AutopilotIntakeSessionSummary,
  AutopilotProjectDetail,
  AutopilotProjectSummary,
  ExecutionBriefHandoff,
} from "@founderos/api-clients";

import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";
import { getExecutionBriefHandoff } from "@/lib/execution-brief-handoffs";

export interface ShellExecutionWorkspaceSnapshot {
  generatedAt: string;
  projects: AutopilotProjectSummary[];
  projectsError: string | null;
  projectsLoadState: "ready" | "error";
  launchPresets: AutopilotLaunchPreset[];
  launchPresetsError: string | null;
  launchPresetsLoadState: "ready" | "error";
  project: AutopilotProjectDetail | null;
  projectError: string | null;
  projectLoadState: "idle" | "ready" | "error";
}

export interface ShellExecutionIntakeSnapshot {
  generatedAt: string;
  launchPresets: AutopilotLaunchPreset[];
  launchPresetsError: string | null;
  launchPresetsLoadState: "ready" | "error";
  intakeSessions: AutopilotIntakeSessionSummary[];
  intakeSessionsError: string | null;
  intakeSessionsLoadState: "idle" | "ready" | "error";
  intakeSession: AutopilotIntakeSessionDetail | null;
  intakeSessionError: string | null;
  intakeSessionLoadState: "idle" | "ready" | "error";
}

export interface ShellExecutionHandoffSnapshot extends ShellExecutionIntakeSnapshot {
  handoff: ExecutionBriefHandoff | null;
  handoffError: string | null;
  handoffLoadState: "ready" | "error";
}

function sortProjects(items: AutopilotProjectSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.last_activity_at ?? "") || 0;
    const rightTime = Date.parse(right.last_activity_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function formatShellErrorMessage(fallback: string, error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function emptyShellExecutionWorkspaceSnapshot(): ShellExecutionWorkspaceSnapshot {
  return {
    generatedAt: "",
    projects: [],
    projectsError: null,
    projectsLoadState: "ready",
    launchPresets: [],
    launchPresetsError: null,
    launchPresetsLoadState: "ready",
    project: null,
    projectError: null,
    projectLoadState: "idle",
  };
}

export function emptyShellExecutionIntakeSnapshot(): ShellExecutionIntakeSnapshot {
  return {
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
}

async function loadAutopilotLaunchPresets(): Promise<AutopilotLaunchPreset[]> {
  const payload = await requestUpstreamJson<{
    launch_presets: AutopilotLaunchPreset[];
  }>("autopilot", "capabilities/launch-presets");

  return payload.launch_presets;
}

export async function buildExecutionWorkspaceSnapshot(
  projectId: string | null,
  options?: {
    includeArchived?: boolean;
  },
): Promise<ShellExecutionWorkspaceSnapshot> {
  const includeArchived = options?.includeArchived ?? false;
  const [projectsResult, launchPresetsResult, projectResult] =
    await Promise.allSettled([
      requestUpstreamJson<{ projects: AutopilotProjectSummary[] }>(
        "autopilot",
        "projects/",
        buildUpstreamQuery({ include_archived: includeArchived }),
      ),
      loadAutopilotLaunchPresets(),
      projectId
        ? requestUpstreamJson<AutopilotProjectDetail>(
            "autopilot",
            `projects/${encodeURIComponent(projectId)}`,
          )
        : Promise.resolve(null),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    projects:
      projectsResult.status === "fulfilled"
        ? sortProjects(projectsResult.value.projects)
        : [],
    projectsError:
      projectsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Autopilot projects",
            projectsResult.reason,
          ),
    projectsLoadState:
      projectsResult.status === "fulfilled" ? "ready" : "error",
    launchPresets:
      launchPresetsResult.status === "fulfilled"
        ? launchPresetsResult.value
        : [],
    launchPresetsError:
      launchPresetsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Autopilot launch presets",
            launchPresetsResult.reason,
          ),
    launchPresetsLoadState:
      launchPresetsResult.status === "fulfilled" ? "ready" : "error",
    project:
      projectResult.status === "fulfilled" && projectResult.value
        ? projectResult.value
        : null,
    projectError:
      projectResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Autopilot project", projectResult.reason),
    projectLoadState: !projectId
      ? "idle"
      : projectResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}

export async function buildExecutionIntakeSnapshot(
  sessionId: string | null,
): Promise<ShellExecutionIntakeSnapshot> {
  const [launchPresetsResult, intakeSessionsResult, intakeSessionResult] =
    await Promise.allSettled([
      loadAutopilotLaunchPresets(),
      requestUpstreamJson<{
        sessions: AutopilotIntakeSessionSummary[];
      }>("autopilot", "intake/sessions"),
      sessionId
        ? requestUpstreamJson<AutopilotIntakeSessionDetail>(
            "autopilot",
            `intake/sessions/${encodeURIComponent(sessionId)}`,
          )
        : Promise.resolve(null),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    launchPresets:
      launchPresetsResult.status === "fulfilled"
        ? launchPresetsResult.value
        : [],
    launchPresetsError:
      launchPresetsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Autopilot launch presets",
            launchPresetsResult.reason,
          ),
    launchPresetsLoadState:
      launchPresetsResult.status === "fulfilled" ? "ready" : "error",
    intakeSessions:
      intakeSessionsResult.status === "fulfilled"
        ? intakeSessionsResult.value.sessions
        : [],
    intakeSessionsError:
      intakeSessionsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Autopilot intake sessions",
            intakeSessionsResult.reason,
          ),
    intakeSessionsLoadState:
      intakeSessionsResult.status === "fulfilled" ? "ready" : "error",
    intakeSession:
      intakeSessionResult.status === "fulfilled"
        ? intakeSessionResult.value
        : null,
    intakeSessionError:
      intakeSessionResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Autopilot intake session",
            intakeSessionResult.reason,
          ),
    intakeSessionLoadState: !sessionId
      ? "idle"
      : intakeSessionResult.status === "fulfilled"
        ? "ready"
        : "error",
  };
}

export async function buildExecutionHandoffSnapshot(
  handoffId: string,
): Promise<ShellExecutionHandoffSnapshot> {
  const [launchPresetsResult, handoffResult] = await Promise.allSettled([
    loadAutopilotLaunchPresets(),
    Promise.resolve().then(async () => {
      const handoff = await getExecutionBriefHandoff(handoffId);
      if (!handoff) {
        throw new Error(
          `Execution brief handoff ${handoffId} not found or expired.`,
        );
      }
      return handoff as ExecutionBriefHandoff;
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    launchPresets:
      launchPresetsResult.status === "fulfilled"
        ? launchPresetsResult.value
        : [],
    launchPresetsError:
      launchPresetsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Autopilot launch presets",
            launchPresetsResult.reason,
          ),
    launchPresetsLoadState:
      launchPresetsResult.status === "fulfilled" ? "ready" : "error",
    intakeSessions: [],
    intakeSessionsError: null,
    intakeSessionsLoadState: "idle",
    intakeSession: null,
    intakeSessionError: null,
    intakeSessionLoadState: "idle",
    handoff: handoffResult.status === "fulfilled" ? handoffResult.value : null,
    handoffError:
      handoffResult.status === "fulfilled"
        ? null
        : formatShellErrorMessage(
            "Cross-plane handoff is unavailable.",
            handoffResult.reason,
          ),
    handoffLoadState: handoffResult.status === "fulfilled" ? "ready" : "error",
  };
}

export function emptyShellExecutionHandoffSnapshot(): ShellExecutionHandoffSnapshot {
  return {
    ...emptyShellExecutionIntakeSnapshot(),
    handoff: null,
    handoffError: null,
    handoffLoadState: "error",
  };
}

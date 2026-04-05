import {
  allowAutopilotToolPermissionRuntime,
  approveAutopilotExecutionApproval,
  createAutopilotProjectFromExecutionBrief,
  createAutopilotProjectFromPrd,
  denyAutopilotToolPermissionRuntime,
  generateAutopilotPrdFromSession,
  launchAutopilotProject,
  pauseAutopilotProject,
  rejectAutopilotExecutionApproval,
  resolveAutopilotExecutionIssue,
  resumeAutopilotProject,
  sendAutopilotIntakeMessage,
  type AutopilotApprovalDecisionResult,
  type AutopilotCreateProjectFromExecutionBriefResult,
  type AutopilotCreateProjectResult,
  type AutopilotExecutionApprovalRecord,
  type AutopilotExecutionIssueRecord,
  type AutopilotIntakeResponse,
  type AutopilotIssueResolutionResult,
  type AutopilotLaunchPreset,
  type AutopilotLaunchProfile,
  type AutopilotLaunchResult,
  type AutopilotPrd,
  type AutopilotTaskSource,
  type AutopilotToolPermissionRuntimeDecisionResult,
  type AutopilotToolPermissionRuntimeRecord,
} from "@founderos/api-clients";

import {
  intakeSessionIdFromExecutionSourceContext,
  routeScopeFromExecutionSourceContext,
  type ShellExecutionSourceContext,
} from "@/lib/execution-source";
import {
  routeScopeFromIntakeSessionRef,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  resolveExecutionIntakeSessionHref,
  resolveExecutionProjectHref,
} from "@/lib/shell-route-intents";
import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";
import type { ShellRouteMutationInvalidation } from "@/lib/use-shell-route-mutation";

export type ExecutionMutationEffect<T = unknown> = ShellMutationEffect<T>;

type ExecutionSourceMutationContext = Pick<
  ShellExecutionSourceContext,
  "projectId" | "intakeSession" | "sourceKind" | "sourceExternalId"
>;

function buildExecutionInvalidation(args: {
  projectId?: string | null;
  intakeSessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  reason: string;
  source: string;
}) {
  const projectId = (args.projectId || "").trim();
  const intakeSessionId = (args.intakeSessionId || "").trim();
  const scope = projectId
    ? routeScopeFromProjectRef(projectId, intakeSessionId, args.routeScope)
    : intakeSessionId
      ? routeScopeFromIntakeSessionRef(
          intakeSessionId,
          "",
          args.routeScope
        )
      : args.routeScope;

  return {
    planes: ["execution"],
    scope,
    resource: {
      executionProjectId: projectId,
      executionIntakeSessionId: intakeSessionId,
    },
    source: args.source,
    reason: args.reason,
  } satisfies ShellRouteMutationInvalidation;
}

function buildExecutionSourceInvalidation(args: {
  sourceContext: ExecutionSourceMutationContext;
  routeScope?: Partial<ShellRouteScope> | null;
  reason: string;
  source: string;
}) {
  return {
    planes: ["execution"],
    scope: routeScopeFromExecutionSourceContext(
      args.sourceContext,
      args.routeScope
    ),
    resource: {
      executionProjectId: args.sourceContext.projectId,
      executionIntakeSessionId:
        intakeSessionIdFromExecutionSourceContext(args.sourceContext),
    },
    source: args.source,
    reason: args.reason,
  } satisfies ShellRouteMutationInvalidation;
}

export async function launchExecutionProject(args: {
  projectId: string;
  launchProfile?: Partial<AutopilotLaunchProfile> | null;
  intakeSessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ExecutionMutationEffect<AutopilotLaunchResult>> {
  const response = await launchAutopilotProject(
    args.projectId,
    args.launchProfile
  );
  return {
    statusMessage: response.message || "Project launch requested.",
    invalidation: buildExecutionInvalidation({
      projectId: args.projectId,
      intakeSessionId: args.intakeSessionId,
      routeScope: args.routeScope,
      reason: "execution-project-launch",
      source: args.source || "execution-workspace",
    }),
    data: response,
  };
}

export async function pauseExecutionProject(args: {
  projectId: string;
  intakeSessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<
  ExecutionMutationEffect<{ status: string; message: string }>
> {
  const response = await pauseAutopilotProject(args.projectId);
  return {
    statusMessage: response.message || "Project paused.",
    invalidation: buildExecutionInvalidation({
      projectId: args.projectId,
      intakeSessionId: args.intakeSessionId,
      routeScope: args.routeScope,
      reason: "execution-project-pause",
      source: args.source || "execution-workspace",
    }),
    data: response,
  };
}

export async function resumeExecutionProject(args: {
  projectId: string;
  intakeSessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ExecutionMutationEffect<AutopilotLaunchResult>> {
  const response = await resumeAutopilotProject(args.projectId);
  return {
    statusMessage: response.message || "Project resumed.",
    invalidation: buildExecutionInvalidation({
      projectId: args.projectId,
      intakeSessionId: args.intakeSessionId,
      routeScope: args.routeScope,
      reason: "execution-project-resume",
      source: args.source || "execution-workspace",
    }),
    data: response,
  };
}

export async function sendExecutionIntakeConversationMessage(args: {
  message: string;
  sessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ExecutionMutationEffect<{ response: AutopilotIntakeResponse }>> {
  const response = await sendAutopilotIntakeMessage(args.message, args.sessionId);
  const nextSessionId = response.session_id;
  const nextHref =
    nextSessionId && nextSessionId !== (args.sessionId || "")
      ? resolveExecutionIntakeSessionHref({
          sessionId: nextSessionId,
          routeScope: args.routeScope,
        })
      : null;

  return {
    statusMessage: response.response.trim()
      ? "Intake response received."
      : "Intake message accepted.",
    href: nextHref,
    navigation: "replace",
    refreshClient: true,
    invalidation: buildExecutionInvalidation({
      intakeSessionId: nextSessionId,
      routeScope: routeScopeFromIntakeSessionRef(
        nextSessionId,
        "",
        args.routeScope
      ),
      reason: "execution-intake-message",
      source: args.source || "execution-intake",
    }),
    data: {
      response,
    },
  };
}

export async function generateExecutionIntakePrd(args: {
  sessionId: string;
  linkedProjectId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<ExecutionMutationEffect<{ prd: AutopilotPrd }>> {
  const response = await generateAutopilotPrdFromSession(args.sessionId);
  return {
    statusMessage: "PRD generated from the current intake interview.",
    refreshClient: true,
    refreshServer: true,
    invalidation: buildExecutionInvalidation({
      projectId: args.linkedProjectId,
      intakeSessionId: args.sessionId,
      routeScope: routeScopeFromIntakeSessionRef(
        args.sessionId,
        args.linkedProjectId,
        args.routeScope
      ),
      reason: "execution-intake-prd-generated",
      source: args.source || "execution-intake",
    }),
    data: response,
  };
}

export async function createExecutionProjectFromPrd(args: {
  prd: AutopilotPrd;
  projectName?: string;
  projectPath?: string;
  priority?: string;
  taskSource?: AutopilotTaskSource | null;
  intakeSessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  launch?: boolean;
  selectedLaunchPresetId?: string;
  launchPresets?: AutopilotLaunchPreset[];
  source?: string;
}): Promise<
  ExecutionMutationEffect<{
    createdProject: AutopilotCreateProjectResult;
    launchResult?: AutopilotLaunchResult | null;
  }>
> {
  const createdProject = await createAutopilotProjectFromPrd({
    prd: args.prd,
    projectName: args.projectName,
    projectPath: args.projectPath,
    priority: args.priority,
    taskSource: args.taskSource,
    intakeSessionId: args.intakeSessionId || undefined,
  });
  const nextIntakeSessionId =
    args.intakeSessionId || createdProject.intake_session_id || "";
  const nextHref = resolveExecutionProjectHref({
    projectId: createdProject.project_id,
    intakeSessionId: nextIntakeSessionId,
    routeScope: args.routeScope,
  });
  const invalidation = buildExecutionInvalidation({
    projectId: createdProject.project_id,
    intakeSessionId: nextIntakeSessionId,
    routeScope: routeScopeFromProjectRef(
      createdProject.project_id,
      nextIntakeSessionId,
      args.routeScope
    ),
    reason: args.launch
      ? "execution-project-created-and-launched"
      : "execution-project-created",
    source: args.source || "execution-intake",
  });

  if (!args.launch) {
    return {
      statusMessage:
        createdProject.message ||
        `Project ${createdProject.project_name} created.`,
      href: nextHref,
      refreshClient: false,
      refreshServer: true,
      invalidation,
      data: {
        createdProject,
      },
    };
  }

  try {
    const launchPreset = args.launchPresets?.find(
      (preset) => preset.id === args.selectedLaunchPresetId
    );
    const launchResult = await launchAutopilotProject(
      createdProject.project_id,
      launchPreset?.launch_profile ?? {
        preset: args.selectedLaunchPresetId || "fast",
      }
    );

    return {
      statusMessage:
        launchResult.message ||
        createdProject.message ||
        `Project ${createdProject.project_name} created and launched.`,
      href: nextHref,
      refreshClient: false,
      refreshServer: true,
      invalidation,
      data: {
        createdProject,
        launchResult,
      },
    };
  } catch (error) {
    return {
      statusMessage: `Project ${createdProject.project_name} was created, but launch still needs attention.`,
      errorMessage:
        error instanceof Error ? error.message : "Launch request failed.",
      refreshClient: true,
      refreshServer: true,
      invalidation,
      data: {
        createdProject,
        launchResult: null,
      },
    };
  }
}

export async function createExecutionProjectFromHandoff(args: {
  brief: Record<string, unknown>;
  projectName?: string;
  projectPath?: string;
  priority?: string;
  launch?: boolean;
  launchProfile?: Partial<AutopilotLaunchProfile> | null;
  intakeSessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
  source?: string;
}): Promise<
  ExecutionMutationEffect<{
    createdProject: AutopilotCreateProjectFromExecutionBriefResult;
  }>
> {
  const createdProject = await createAutopilotProjectFromExecutionBrief({
    brief: args.brief,
    projectName: args.projectName,
    projectPath: args.projectPath,
    priority: args.priority,
    launch: args.launch,
    launchProfile: args.launchProfile,
  });
  const nextIntakeSessionId =
    args.intakeSessionId || createdProject.intake_session_id || "";

  return {
    statusMessage:
      createdProject.message || "Project created from discovery handoff.",
    href: resolveExecutionProjectHref({
      projectId: createdProject.project_id,
      intakeSessionId: nextIntakeSessionId,
      routeScope: args.routeScope,
    }),
    refreshClient: false,
    refreshServer: true,
    invalidation: buildExecutionInvalidation({
      projectId: createdProject.project_id,
      intakeSessionId: nextIntakeSessionId,
      routeScope: routeScopeFromProjectRef(
        createdProject.project_id,
        nextIntakeSessionId,
        args.routeScope
      ),
      reason: args.launch
        ? "execution-handoff-create-launch"
        : "execution-handoff-create",
      source: args.source || "execution-handoff",
    }),
    data: {
      createdProject,
    },
  };
}

export async function resolveExecutionIssue(args: {
  issue: Pick<AutopilotExecutionIssueRecord, "id">;
  sourceContext: ExecutionSourceMutationContext;
  routeScope?: Partial<ShellRouteScope> | null;
  actor?: string;
  note?: string;
  source?: string;
}): Promise<ExecutionMutationEffect<AutopilotIssueResolutionResult>> {
  const response = await resolveAutopilotExecutionIssue(args.issue.id, {
    actor: args.actor,
    note: args.note,
  });
  return {
    statusMessage: `Resolved execution issue ${args.issue.id}.`,
    invalidation: buildExecutionSourceInvalidation({
      sourceContext: args.sourceContext,
      routeScope: args.routeScope,
      reason: "execution-issue-resolve",
      source: args.source || "inbox",
    }),
    data: response,
  };
}

export async function approveExecutionApproval(args: {
  approval: Pick<AutopilotExecutionApprovalRecord, "id">;
  sourceContext: ExecutionSourceMutationContext;
  routeScope?: Partial<ShellRouteScope> | null;
  actor?: string;
  note?: string;
  source?: string;
}): Promise<ExecutionMutationEffect<AutopilotApprovalDecisionResult>> {
  const response = await approveAutopilotExecutionApproval(args.approval.id, {
    actor: args.actor,
    note: args.note,
  });
  return {
    statusMessage: `Approved execution approval ${args.approval.id}.`,
    invalidation: buildExecutionSourceInvalidation({
      sourceContext: args.sourceContext,
      routeScope: args.routeScope,
      reason: "execution-approval-approve",
      source: args.source || "inbox",
    }),
    data: response,
  };
}

export async function rejectExecutionApproval(args: {
  approval: Pick<AutopilotExecutionApprovalRecord, "id">;
  sourceContext: ExecutionSourceMutationContext;
  routeScope?: Partial<ShellRouteScope> | null;
  actor?: string;
  note?: string;
  source?: string;
}): Promise<ExecutionMutationEffect<AutopilotApprovalDecisionResult>> {
  const response = await rejectAutopilotExecutionApproval(args.approval.id, {
    actor: args.actor,
    note: args.note,
  });
  return {
    statusMessage: `Rejected execution approval ${args.approval.id}.`,
    invalidation: buildExecutionSourceInvalidation({
      sourceContext: args.sourceContext,
      routeScope: args.routeScope,
      reason: "execution-approval-reject",
      source: args.source || "inbox",
    }),
    data: response,
  };
}

export async function allowExecutionRuntime(args: {
  runtime: Pick<AutopilotToolPermissionRuntimeRecord, "id">;
  sourceContext: ExecutionSourceMutationContext;
  routeScope?: Partial<ShellRouteScope> | null;
  actor?: string;
  note?: string;
  permissionSource?: "user" | "channel" | string;
  source?: string;
}): Promise<
  ExecutionMutationEffect<AutopilotToolPermissionRuntimeDecisionResult>
> {
  const response = await allowAutopilotToolPermissionRuntime(args.runtime.id, {
    actor: args.actor,
    note: args.note,
    source: args.permissionSource,
  });
  return {
    statusMessage: `Allowed tool permission runtime ${args.runtime.id}.`,
    invalidation: buildExecutionSourceInvalidation({
      sourceContext: args.sourceContext,
      routeScope: args.routeScope,
      reason: "execution-runtime-allow",
      source: args.source || "inbox",
    }),
    data: response,
  };
}

export async function denyExecutionRuntime(args: {
  runtime: Pick<AutopilotToolPermissionRuntimeRecord, "id">;
  sourceContext: ExecutionSourceMutationContext;
  routeScope?: Partial<ShellRouteScope> | null;
  actor?: string;
  note?: string;
  permissionSource?: "user" | "channel" | string;
  source?: string;
}): Promise<
  ExecutionMutationEffect<AutopilotToolPermissionRuntimeDecisionResult>
> {
  const response = await denyAutopilotToolPermissionRuntime(args.runtime.id, {
    actor: args.actor,
    note: args.note,
    source: args.permissionSource,
  });
  return {
    statusMessage: `Denied tool permission runtime ${args.runtime.id}.`,
    invalidation: buildExecutionSourceInvalidation({
      sourceContext: args.sourceContext,
      routeScope: args.routeScope,
      reason: "execution-runtime-deny",
      source: args.source || "inbox",
    }),
    data: response,
  };
}

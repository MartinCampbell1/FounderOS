import type {
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
} from "@founderos/api-clients";

import {
  routeScopeFromExecutionSourceRef,
  type ShellRouteScope,
} from "@/lib/route-scope";

export type ShellExecutionSourceContext = {
  projectId: string;
  project: AutopilotProjectSummary | null;
  intakeSession: AutopilotIntakeSessionSummary | null;
  sourceKind: string;
  sourceExternalId: string;
  chainKind: "linked" | "intake-linked" | "orphan-project" | "unlinked";
  briefId: string;
  discoveryIdeaId: string;
  discoveryIdeaTitle: string;
};

type ExecutionSourceChainRef = {
  kind: "linked" | "intake-linked" | "orphan-project";
  briefId: string;
  idea: {
    idea_id: string;
    title: string;
  } | null;
  project: AutopilotProjectSummary | null;
  intakeSession: AutopilotIntakeSessionSummary | null;
};

export function buildExecutionSourceContext(
  projectId: string,
  projectsById: Map<string, AutopilotProjectSummary>,
  intakeSessionsById: Map<string, AutopilotIntakeSessionSummary>,
  intakeSessionsByProjectId: Map<string, AutopilotIntakeSessionSummary>,
  chainRecord?: ExecutionSourceChainRef | null
): ShellExecutionSourceContext {
  const project = chainRecord?.project ?? projectsById.get(projectId) ?? null;
  const linkedIntakeSession =
    chainRecord?.intakeSession ?? intakeSessionsByProjectId.get(projectId) ?? null;
  const sourceKind =
    project?.task_source?.source_kind ||
    (linkedIntakeSession ? "intake_session" : "local_brief");
  const sourceExternalId =
    project?.task_source?.external_id || linkedIntakeSession?.id || "";
  const intakeSession =
    sourceKind === "intake_session" && sourceExternalId
      ? intakeSessionsById.get(sourceExternalId) ?? linkedIntakeSession
      : linkedIntakeSession;

  return {
    projectId,
    project,
    intakeSession,
    sourceKind,
    sourceExternalId,
    chainKind: chainRecord?.kind ?? "unlinked",
    briefId:
      chainRecord?.briefId ||
      (project?.task_source?.source_kind === "execution_brief"
        ? project.task_source.external_id
        : ""),
    discoveryIdeaId: chainRecord?.idea?.idea_id || "",
    discoveryIdeaTitle: chainRecord?.idea?.title || "",
  };
}

export function intakeSessionIdFromExecutionSourceContext(
  source: Pick<
    ShellExecutionSourceContext,
    "intakeSession" | "sourceKind" | "sourceExternalId"
  >
) {
  return (
    source.intakeSession?.id ||
    (source.sourceKind === "intake_session" ? source.sourceExternalId : "")
  ).trim();
}

export function routeScopeFromExecutionSourceContext(
  source: Pick<
    ShellExecutionSourceContext,
    "projectId" | "intakeSession" | "sourceKind" | "sourceExternalId"
  >,
  fallback?: Partial<ShellRouteScope> | null
) {
  return routeScopeFromExecutionSourceRef({
    projectId: source.projectId,
    sourceKind: source.sourceKind,
    sourceExternalId: source.sourceExternalId,
    linkedIntakeSessionId: source.intakeSession?.id,
    fallback,
  });
}

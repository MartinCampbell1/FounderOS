import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryIdea,
  QuorumExecutionBriefCandidate,
  QuorumExecutionOutcome,
  QuorumIdeaDossier,
} from "@founderos/api-clients";

import {
  buildProjectAttentionRollup,
  humanizeAttentionToken,
  type ProjectAttentionRollup,
} from "@/lib/attention-records";
import {
  buildShellDiscoveryAuthoringSummary,
  type ShellDiscoveryAuthoringSummary,
} from "@/lib/discovery-authoring";
import {
  hasShellRouteScope,
  resolveScopedIntakeSessionId,
  routeScopeFromIntakeSessionRef,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";

export type ShellChainProjectAttention = ProjectAttentionRollup;

export type LinkedShellChainRecord = {
  kind: "linked";
  key: string;
  briefId: string;
  idea: QuorumDiscoveryIdea;
  authoring: ShellDiscoveryAuthoringSummary;
  brief: QuorumExecutionBriefCandidate | null;
  outcome: QuorumExecutionOutcome | null;
  intakeSessionId: string;
  intakeSession: AutopilotIntakeSessionSummary | null;
  project: AutopilotProjectSummary | null;
  attention: ShellChainProjectAttention | null;
};

export type IntakeShellChainRecord = {
  kind: "intake-linked";
  key: string;
  briefId: string;
  idea: null;
  brief: null;
  outcome: null;
  intakeSessionId: string;
  intakeSession: AutopilotIntakeSessionSummary | null;
  project: AutopilotProjectSummary | null;
  attention: ShellChainProjectAttention | null;
};

export type OrphanProjectShellChainRecord = {
  kind: "orphan-project";
  key: string;
  briefId: string;
  idea: null;
  brief: null;
  outcome: null;
  intakeSessionId: string;
  intakeSession: AutopilotIntakeSessionSummary | null;
  project: AutopilotProjectSummary;
  attention: ShellChainProjectAttention | null;
};

export type ShellChainRecord =
  | LinkedShellChainRecord
  | IntakeShellChainRecord
  | OrphanProjectShellChainRecord;

export type ShellChainGraphStats = {
  activeExecutionCount: number;
  authoringGapCount: number;
  authoringReadyCount: number;
  brokenIntakeCount: number;
  chainsWithAttentionCount: number;
  intakeLinkedCount: number;
  linkedCount: number;
  orphanCount: number;
  validatedCount: number;
};

function sortIdeas(items: QuorumDiscoveryIdea[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function sortProjects(items: AutopilotProjectSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.last_activity_at ?? "") || 0;
    const rightTime = Date.parse(right.last_activity_at ?? "") || 0;
    return rightTime - leftTime;
  });
}

function sortIntakeSessions(items: AutopilotIntakeSessionSummary[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || "") || 0;
    return rightTime - leftTime;
  });
}

function latestOutcome(outcomes: QuorumExecutionOutcome[]) {
  return [...outcomes].sort((left, right) => {
    const leftTime = Date.parse(left.ingested_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.ingested_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  })[0] ?? null;
}

function intakeSessionIdForProject(
  project: AutopilotProjectSummary | null | undefined,
  intakeSessionsByProjectId: Map<string, AutopilotIntakeSessionSummary>
) {
  if (!project) {
    return "";
  }

  if (project.task_source?.source_kind === "intake_session") {
    return project.task_source.external_id.trim();
  }

  return intakeSessionsByProjectId.get(project.id)?.id || "";
}

function intakeSessionForProject(
  project: AutopilotProjectSummary | null | undefined,
  intakeSessionsByProjectId: Map<string, AutopilotIntakeSessionSummary>,
  intakeSessionsById: Map<string, AutopilotIntakeSessionSummary>
) {
  if (!project) {
    return null;
  }

  const sourceSessionId = intakeSessionIdForProject(project, intakeSessionsByProjectId);
  if (!sourceSessionId) {
    return null;
  }

  return intakeSessionsById.get(sourceSessionId) ?? null;
}

export function buildShellChainGraph(
  dossiers: QuorumIdeaDossier[],
  projects: AutopilotProjectSummary[],
  intakeSessions: AutopilotIntakeSessionSummary[],
  issues: AutopilotExecutionIssueRecord[] = [],
  approvals: AutopilotExecutionApprovalRecord[] = [],
  runtimes: AutopilotToolPermissionRuntimeRecord[] = []
): ShellChainRecord[] {
  const projectsByBriefId = new Map<string, AutopilotProjectSummary>();
  const projectsById = new Map<string, AutopilotProjectSummary>();
  const intakeProjectsBySessionId = new Map<string, AutopilotProjectSummary>();
  const intakeSessionsById = new Map(
    intakeSessions.map((session) => [session.id, session])
  );
  const intakeSessionsByProjectId = new Map(
    intakeSessions
      .filter((session) => Boolean(session.linked_project_id))
      .map((session) => [session.linked_project_id, session])
  );

  for (const project of sortProjects(projects)) {
    projectsById.set(project.id, project);

    const briefId =
      project.task_source?.source_kind === "execution_brief"
        ? project.task_source.external_id.trim()
        : "";
    if (briefId && !projectsByBriefId.has(briefId)) {
      projectsByBriefId.set(briefId, project);
    }

    const intakeSessionId =
      project.task_source?.source_kind === "intake_session"
        ? project.task_source.external_id.trim()
        : "";
    if (intakeSessionId && !intakeProjectsBySessionId.has(intakeSessionId)) {
      intakeProjectsBySessionId.set(intakeSessionId, project);
    }
  }

  const usedProjectIds = new Set<string>();
  const linkedRecords: LinkedShellChainRecord[] = [];

  for (const dossier of dossiers) {
    const brief = dossier.execution_brief_candidate ?? null;
    const outcome = latestOutcome(dossier.execution_outcomes ?? []);
    const briefId = brief?.brief_id || outcome?.brief_id || "";
    if (!briefId) {
      continue;
    }

    const project = projectsByBriefId.get(briefId) ?? null;
    if (project) {
      usedProjectIds.add(project.id);
    }

    const linkedIntakeSession = intakeSessionForProject(
      project,
      intakeSessionsByProjectId,
      intakeSessionsById
    );

    linkedRecords.push({
      kind: "linked",
      key: `linked:${dossier.idea.idea_id}:${briefId}`,
      briefId,
      idea: dossier.idea,
      authoring: buildShellDiscoveryAuthoringSummary(dossier),
      brief,
      outcome,
      intakeSessionId: linkedIntakeSession?.id || "",
      intakeSession: linkedIntakeSession,
      project,
      attention: buildProjectAttentionRollup(
        project?.id,
        issues,
        approvals,
        runtimes
      ),
    });
  }

  const usedIntakeProjectIds = new Set<string>();
  const intakeRecords: IntakeShellChainRecord[] = [];

  for (const intakeSession of sortIntakeSessions(intakeSessions)) {
    const linkedProject =
      (intakeSession.linked_project_id
        ? projectsById.get(intakeSession.linked_project_id)
        : null) ??
      intakeProjectsBySessionId.get(intakeSession.id) ??
      null;

    if (!linkedProject && !intakeSession.linked_project_id) {
      continue;
    }

    if (linkedProject) {
      usedIntakeProjectIds.add(linkedProject.id);
    }

    intakeRecords.push({
      kind: "intake-linked",
      key: `intake:${intakeSession.id}:${linkedProject?.id || intakeSession.linked_project_id || "missing-project"}`,
      briefId: "",
      idea: null,
      brief: null,
      outcome: null,
      intakeSessionId: intakeSession.id,
      intakeSession,
      project: linkedProject,
      attention: buildProjectAttentionRollup(
        linkedProject?.id,
        issues,
        approvals,
        runtimes
      ),
    });
  }

  for (const project of sortProjects(projects)) {
    const intakeSessionId =
      project.task_source?.source_kind === "intake_session"
        ? project.task_source.external_id.trim()
        : "";
    if (!intakeSessionId || usedIntakeProjectIds.has(project.id)) {
      continue;
    }

    intakeRecords.push({
      kind: "intake-linked",
      key: `intake-project:${project.id}`,
      briefId: "",
      idea: null,
      brief: null,
      outcome: null,
      intakeSessionId,
      intakeSession: intakeSessionsById.get(intakeSessionId) ?? null,
      project,
      attention: buildProjectAttentionRollup(
        project.id,
        issues,
        approvals,
        runtimes
      ),
    });
    usedIntakeProjectIds.add(project.id);
  }

  const orphanRecords: OrphanProjectShellChainRecord[] = sortProjects(projects)
    .filter((project) => {
      const briefId =
        project.task_source?.source_kind === "execution_brief"
          ? project.task_source.external_id.trim()
          : "";
      return Boolean(briefId) && !usedProjectIds.has(project.id);
    })
    .map((project) => ({
      kind: "orphan-project" as const,
      key: `orphan:${project.id}`,
      briefId: project.task_source?.external_id.trim() || "",
      idea: null,
      brief: null,
      outcome: null,
      intakeSessionId: intakeSessionIdForProject(project, intakeSessionsByProjectId),
      intakeSession: intakeSessionForProject(
        project,
        intakeSessionsByProjectId,
        intakeSessionsById
      ),
      project,
      attention: buildProjectAttentionRollup(
        project.id,
        issues,
        approvals,
        runtimes
      ),
    }));

  return [...linkedRecords, ...intakeRecords, ...orphanRecords];
}

export function shellChainProjectId(record: ShellChainRecord) {
  return record.project?.id || "";
}

export function shellChainIntakeSessionId(record: ShellChainRecord) {
  return record.intakeSessionId || record.intakeSession?.id || "";
}

export function shellChainRouteScope(
  record: ShellChainRecord,
  fallback?: Partial<ShellRouteScope> | null
) {
  const intakeSessionId = shellChainIntakeSessionId(record);
  const projectId = shellChainProjectId(record);
  return projectId
    ? routeScopeFromProjectRef(projectId, intakeSessionId, fallback)
    : routeScopeFromIntakeSessionRef(intakeSessionId, "", fallback);
}

export function matchesShellChainRouteScope(
  record: ShellChainRecord,
  scope: ShellRouteScope
) {
  if (!hasShellRouteScope(scope)) {
    return true;
  }

  if (scope.projectId && shellChainProjectId(record) !== scope.projectId) {
    return false;
  }

  if (scope.intakeSessionId && shellChainIntakeSessionId(record) !== scope.intakeSessionId) {
    return false;
  }

  return true;
}

export function resolveScopedShellChainProject(
  records: ShellChainRecord[],
  scope: ShellRouteScope
) {
  if (scope.projectId) {
    return (
      records.find((record) => shellChainProjectId(record) === scope.projectId)
        ?.project || null
    );
  }

  if (scope.intakeSessionId) {
    return (
      records.find(
        (record) => shellChainIntakeSessionId(record) === scope.intakeSessionId
      )?.project || null
    );
  }

  return null;
}

export function resolveScopedShellChainIntakeSession(
  records: ShellChainRecord[],
  scope: ShellRouteScope
) {
  if (scope.intakeSessionId) {
    return (
      records.find(
        (record) => shellChainIntakeSessionId(record) === scope.intakeSessionId
      )?.intakeSession || null
    );
  }

  if (scope.projectId) {
    return (
      records.find((record) => shellChainProjectId(record) === scope.projectId)
        ?.intakeSession || null
    );
  }

  return null;
}

export function resolveScopedShellChainIntakeSessionId(
  records: ShellChainRecord[],
  scope: ShellRouteScope
) {
  const projectRecord = scope.projectId
    ? records.find((record) => shellChainProjectId(record) === scope.projectId) ?? null
    : null;
  const scopedProject = projectRecord?.project ?? resolveScopedShellChainProject(records, scope);

  return resolveScopedIntakeSessionId(scope, {
    project: scopedProject,
    linkedIntakeSessionId: projectRecord ? shellChainIntakeSessionId(projectRecord) : "",
    projectId: scope.projectId,
  });
}

export function matchShellChainQuery(record: ShellChainRecord, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (record.kind === "linked") {
    return (
      record.idea.title.toLowerCase().includes(normalized) ||
      record.idea.idea_id.toLowerCase().includes(normalized) ||
      record.briefId.toLowerCase().includes(normalized) ||
      record.authoring.headline.toLowerCase().includes(normalized) ||
      record.authoring.detail.toLowerCase().includes(normalized) ||
      record.authoring.gaps.some((gap) =>
        humanizeAttentionToken(gap).toLowerCase().includes(normalized)
      ) ||
      (record.brief?.title || "").toLowerCase().includes(normalized) ||
      (record.project?.name || "").toLowerCase().includes(normalized) ||
      humanizeAttentionToken(record.project?.task_source?.source_kind || "")
        .toLowerCase()
        .includes(normalized) ||
      record.attention?.issues.some((issue) => issue.title.toLowerCase().includes(normalized)) ||
      record.attention?.approvals.some((approval) =>
        humanizeAttentionToken(approval.action).toLowerCase().includes(normalized)
      ) ||
      record.attention?.runtimes.some((runtime) =>
        runtime.tool_name.toLowerCase().includes(normalized)
      ) ||
      false
    );
  }

  if (record.kind === "intake-linked") {
    return (
      record.intakeSessionId.toLowerCase().includes(normalized) ||
      (record.intakeSession?.title || "").toLowerCase().includes(normalized) ||
      (record.intakeSession?.linked_project_name || "").toLowerCase().includes(normalized) ||
      (record.project?.name || "").toLowerCase().includes(normalized) ||
      humanizeAttentionToken(record.project?.task_source?.source_kind || "")
        .toLowerCase()
        .includes(normalized) ||
      record.attention?.issues.some((issue) => issue.title.toLowerCase().includes(normalized)) ||
      record.attention?.approvals.some((approval) =>
        humanizeAttentionToken(approval.action).toLowerCase().includes(normalized)
      ) ||
      record.attention?.runtimes.some((runtime) =>
        runtime.tool_name.toLowerCase().includes(normalized)
      ) ||
      false
    );
  }

  return (
    record.project.name.toLowerCase().includes(normalized) ||
    record.project.id.toLowerCase().includes(normalized) ||
    record.briefId.toLowerCase().includes(normalized) ||
    record.attention?.issues.some((issue) => issue.title.toLowerCase().includes(normalized)) ||
    record.attention?.approvals.some((approval) =>
      humanizeAttentionToken(approval.action).toLowerCase().includes(normalized)
    ) ||
    record.attention?.runtimes.some((runtime) =>
      runtime.tool_name.toLowerCase().includes(normalized)
    ) ||
    false
  );
}

export function buildShellChainGraphStats(records: ShellChainRecord[]): ShellChainGraphStats {
  return {
    activeExecutionCount: records.filter((record) => {
      const project = record.project;
      return Boolean(project && ["running", "paused"].includes(project.status));
    }).length,
    authoringGapCount: records.filter(
      (record) => record.kind === "linked" && record.authoring.gapCount > 0
    ).length,
    authoringReadyCount: records.filter(
      (record) => record.kind === "linked" && record.authoring.gapCount === 0
    ).length,
    brokenIntakeCount: records.filter(
      (record) => record.kind === "intake-linked" && (!record.project || !record.intakeSession)
    ).length,
    chainsWithAttentionCount: records.filter((record) =>
      Boolean(record.attention?.total)
    ).length,
    intakeLinkedCount: records.filter((record) => record.kind === "intake-linked").length,
    linkedCount: records.filter((record) => record.kind === "linked").length,
    orphanCount: records.filter((record) => record.kind === "orphan-project").length,
    validatedCount: records.filter(
      (record) => record.kind === "linked" && record.outcome?.status === "validated"
    ).length,
  };
}

export function filterShellChainGraphByIdeas(
  records: ShellChainRecord[],
  ideas: QuorumDiscoveryIdea[]
) {
  const allowedIdeaIds = new Set(sortIdeas(ideas).map((idea) => idea.idea_id));
  return records.filter((record) => {
    if (record.kind !== "linked") {
      return true;
    }
    return allowedIdeaIds.has(record.idea.idea_id);
  });
}

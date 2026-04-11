import type {
  AutopilotIntakeSessionDetail,
  AutopilotIntakeSessionSummary,
  AutopilotProjectDetail,
  AutopilotProjectSummary,
} from "@founderos/api-clients";

export type ShellRouteScope = {
  projectId: string;
  intakeSessionId: string;
};

export type ShellSettingsParityTargets = {
  discoverySessionId: string;
  discoveryIdeaId: string;
};

type QueryRecord = Record<string, string | string[] | undefined>;
type SearchParamsLike = {
  get(name: string): string | null;
};
type ExecutionProjectScopeSource =
  | Pick<AutopilotProjectSummary, "id" | "task_source">
  | Pick<AutopilotProjectDetail, "id" | "task_source">;
type ExecutionIntakeSessionScopeSource =
  | Pick<AutopilotIntakeSessionSummary, "id" | "linked_project_id">
  | Pick<AutopilotIntakeSessionDetail, "session_id" | "linked_project_id">;

export const EMPTY_SHELL_ROUTE_SCOPE: ShellRouteScope = {
  projectId: "",
  intakeSessionId: "",
};

export const EMPTY_SHELL_SETTINGS_PARITY_TARGETS: ShellSettingsParityTargets = {
  discoverySessionId: "",
  discoveryIdeaId: "",
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function normalizeScopeValue(value: string | null | undefined) {
  return (value || "").trim();
}

export function normalizeShellRouteScope(
  scope?: Partial<ShellRouteScope> | null
): ShellRouteScope {
  return {
    projectId: normalizeScopeValue(scope?.projectId),
    intakeSessionId: normalizeScopeValue(scope?.intakeSessionId),
  };
}

export function normalizeShellSettingsParityTargets(
  targets?: Partial<ShellSettingsParityTargets> | null
): ShellSettingsParityTargets {
  return {
    discoverySessionId: normalizeScopeValue(targets?.discoverySessionId),
    discoveryIdeaId: normalizeScopeValue(targets?.discoveryIdeaId),
  };
}

export function readShellRouteScopeFromQueryRecord(
  params?: QueryRecord | null
): ShellRouteScope {
  return {
    projectId: normalizeScopeValue(firstParam(params?.project_id)),
    intakeSessionId: normalizeScopeValue(firstParam(params?.intake_session_id)),
  };
}

export function readShellSettingsParityTargetsFromQueryRecord(
  params?: QueryRecord | null
): ShellSettingsParityTargets {
  return {
    discoverySessionId: normalizeScopeValue(firstParam(params?.session_id)),
    discoveryIdeaId: normalizeScopeValue(firstParam(params?.idea_id)),
  };
}

export function readShellRouteScopeFromSearchParams(
  searchParams?: SearchParamsLike | null
): ShellRouteScope {
  return {
    projectId: normalizeScopeValue(searchParams?.get("project_id")),
    intakeSessionId: normalizeScopeValue(searchParams?.get("intake_session_id")),
  };
}

export function readShellSettingsParityTargetsFromSearchParams(
  searchParams?: SearchParamsLike | null
): ShellSettingsParityTargets {
  return {
    discoverySessionId: normalizeScopeValue(searchParams?.get("session_id")),
    discoveryIdeaId: normalizeScopeValue(searchParams?.get("idea_id")),
  };
}

export function hasShellRouteScope(
  scope?: Partial<ShellRouteScope> | null
) {
  return Boolean(scope?.projectId || scope?.intakeSessionId);
}

export function intakeSessionIdFromExecutionProject(
  project?: Pick<ExecutionProjectScopeSource, "task_source"> | null
) {
  return project?.task_source?.source_kind === "intake_session"
    ? normalizeScopeValue(project.task_source.external_id)
    : "";
}

export function routeScopeFromProjectRef(
  projectId?: string | null,
  intakeSessionId?: string | null,
  fallback?: Partial<ShellRouteScope> | null
): ShellRouteScope {
  const normalizedProjectId = normalizeScopeValue(projectId);
  const normalizedIntakeSessionId = normalizeScopeValue(intakeSessionId);
  const normalizedFallback = normalizeShellRouteScope(fallback);

  return {
    projectId: normalizedProjectId || normalizedFallback.projectId,
    intakeSessionId:
      normalizedIntakeSessionId ||
      (normalizedProjectId && normalizedFallback.projectId === normalizedProjectId
        ? normalizedFallback.intakeSessionId
        : ""),
  };
}

export function routeScopeFromExecutionProject(
  project?: ExecutionProjectScopeSource | null,
  fallback?: Partial<ShellRouteScope> | null
): ShellRouteScope {
  if (!project) {
    return normalizeShellRouteScope(fallback);
  }

  return routeScopeFromProjectRef(
    project.id,
    intakeSessionIdFromExecutionProject(project),
    fallback
  );
}

export function intakeSessionIdFromExecutionIntakeSession(
  session?: ExecutionIntakeSessionScopeSource | null
) {
  if (!session) {
    return "";
  }

  return normalizeScopeValue("id" in session ? session.id : session.session_id);
}

export function linkedProjectIdFromExecutionIntakeSession(
  session?: Pick<ExecutionIntakeSessionScopeSource, "linked_project_id"> | null
) {
  return normalizeScopeValue(session?.linked_project_id);
}

export function routeScopeFromIntakeSessionRef(
  intakeSessionId?: string | null,
  linkedProjectId?: string | null,
  fallback?: Partial<ShellRouteScope> | null
): ShellRouteScope {
  const normalizedIntakeSessionId = normalizeScopeValue(intakeSessionId);
  const normalizedLinkedProjectId = normalizeScopeValue(linkedProjectId);
  const normalizedFallback = normalizeShellRouteScope(fallback);

  if (!normalizedIntakeSessionId && !normalizedLinkedProjectId) {
    return normalizedFallback;
  }

  return {
    projectId:
      normalizedLinkedProjectId ||
      (normalizedIntakeSessionId &&
      normalizedFallback.intakeSessionId === normalizedIntakeSessionId
        ? normalizedFallback.projectId
        : ""),
    intakeSessionId:
      normalizedIntakeSessionId ||
      (normalizedLinkedProjectId &&
      normalizedFallback.projectId === normalizedLinkedProjectId
        ? normalizedFallback.intakeSessionId
        : ""),
  };
}

export function routeScopeFromExecutionIntakeSession(
  session?: ExecutionIntakeSessionScopeSource | null,
  fallback?: Partial<ShellRouteScope> | null
): ShellRouteScope {
  return routeScopeFromIntakeSessionRef(
    intakeSessionIdFromExecutionIntakeSession(session),
    linkedProjectIdFromExecutionIntakeSession(session),
    fallback
  );
}

export function routeScopeFromExecutionSourceRef(args: {
  projectId?: string | null;
  sourceKind?: string | null;
  sourceExternalId?: string | null;
  linkedIntakeSessionId?: string | null;
  fallback?: Partial<ShellRouteScope> | null;
}) {
  const sourceKind = normalizeScopeValue(args.sourceKind);
  const intakeSessionId =
    sourceKind === "intake_session"
      ? normalizeScopeValue(args.sourceExternalId)
      : normalizeScopeValue(args.linkedIntakeSessionId);

  return routeScopeFromProjectRef(
    args.projectId,
    intakeSessionId,
    args.fallback
  );
}

export function resolveScopedIntakeSessionId(
  scope?: Partial<ShellRouteScope> | null,
  options?: {
    project?: Pick<ExecutionProjectScopeSource, "task_source"> | null;
    linkedIntakeSessionId?: string | null;
    projectId?: string | null;
  }
) {
  const normalizedScope = normalizeShellRouteScope(scope);
  if (normalizedScope.intakeSessionId) {
    return normalizedScope.intakeSessionId;
  }

  const projectScopedIntakeSessionId = intakeSessionIdFromExecutionProject(
    options?.project
  );
  if (projectScopedIntakeSessionId) {
    return projectScopedIntakeSessionId;
  }

  if (
    normalizedScope.projectId &&
    options?.projectId &&
    normalizeScopeValue(options.projectId) !== normalizedScope.projectId
  ) {
    return "";
  }

  if (!normalizedScope.projectId) {
    return "";
  }

  return normalizeScopeValue(options?.linkedIntakeSessionId);
}

export function matchesProjectRouteScope(
  project: Pick<ExecutionProjectScopeSource, "id" | "task_source">,
  scope?: Partial<ShellRouteScope> | null
) {
  const normalizedScope = normalizeShellRouteScope(scope);
  if (!hasShellRouteScope(normalizedScope)) {
    return true;
  }

  if (normalizedScope.projectId && project.id !== normalizedScope.projectId) {
    return false;
  }

  if (!normalizedScope.intakeSessionId) {
    return true;
  }

  return (
    intakeSessionIdFromExecutionProject(project) === normalizedScope.intakeSessionId
  );
}

export function withShellRouteScope(
  href: string,
  scope?: Partial<ShellRouteScope> | null
) {
  if (!hasShellRouteScope(scope)) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const pathWithQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hashFragment = hashIndex >= 0 ? href.slice(hashIndex + 1) : "";
  const queryIndex = pathWithQuery.indexOf("?");
  const pathname =
    queryIndex >= 0 ? pathWithQuery.slice(0, queryIndex) : pathWithQuery;
  const rawQuery = queryIndex >= 0 ? pathWithQuery.slice(queryIndex + 1) : "";

  const params = new URLSearchParams(rawQuery);

  if (scope?.projectId) {
    params.set("project_id", scope.projectId);
  } else {
    params.delete("project_id");
  }

  if (scope?.intakeSessionId) {
    params.set("intake_session_id", scope.intakeSessionId);
  } else {
    params.delete("intake_session_id");
  }

  const query = params.toString();
  const nextHref = query ? `${pathname}?${query}` : pathname;
  return hashFragment ? `${nextHref}#${hashFragment}` : nextHref;
}

export function withShellSettingsParityTargets(
  href: string,
  targets?: Partial<ShellSettingsParityTargets> | null
) {
  const normalizedTargets = normalizeShellSettingsParityTargets(targets);
  if (!normalizedTargets.discoverySessionId && !normalizedTargets.discoveryIdeaId) {
    return href;
  }

  const hashIndex = href.indexOf("#");
  const pathWithQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hashFragment = hashIndex >= 0 ? href.slice(hashIndex + 1) : "";
  const queryIndex = pathWithQuery.indexOf("?");
  const pathname =
    queryIndex >= 0 ? pathWithQuery.slice(0, queryIndex) : pathWithQuery;
  const rawQuery = queryIndex >= 0 ? pathWithQuery.slice(queryIndex + 1) : "";

  const params = new URLSearchParams(rawQuery);

  if (normalizedTargets.discoverySessionId) {
    params.set("session_id", normalizedTargets.discoverySessionId);
  } else {
    params.delete("session_id");
  }

  if (normalizedTargets.discoveryIdeaId) {
    params.set("idea_id", normalizedTargets.discoveryIdeaId);
  } else {
    params.delete("idea_id");
  }

  const query = params.toString();
  const nextHref = query ? `${pathname}?${query}` : pathname;
  return hashFragment ? `${nextHref}#${hashFragment}` : nextHref;
}

export function buildDashboardScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/dashboard", scope);
}

export function buildExecutionScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/execution", scope);
}

export function buildExecutionHandoffsScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/execution/handoffs", scope);
}

export function buildExecutionAgentsScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/execution/agents", scope);
}

export function buildExecutionAuditsScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/execution/audits", scope);
}

export function buildExecutionEventsScopeHref(
  scope?: Partial<ShellRouteScope> | null,
  filters?: {
    runtimeAgentId?: string | null;
    orchestratorSessionId?: string | null;
    initiativeId?: string | null;
    orchestrator?: string | null;
  }
) {
  const href = withShellRouteScope("/execution/events", scope);
  if (
    !filters?.runtimeAgentId &&
    !filters?.orchestratorSessionId &&
    !filters?.initiativeId &&
    !filters?.orchestrator
  ) {
    return href;
  }

  const url = new URL(href, "http://founderos-shell.local");
  if (filters.runtimeAgentId) {
    url.searchParams.set("runtime_agent_id", filters.runtimeAgentId);
  }
  if (filters.orchestratorSessionId) {
    url.searchParams.set("orchestrator_session_id", filters.orchestratorSessionId);
  }
  if (filters.initiativeId) {
    url.searchParams.set("initiative_id", filters.initiativeId);
  }
  if (filters.orchestrator) {
    url.searchParams.set("orchestrator", filters.orchestrator);
  }
  return `${url.pathname}${url.search}`;
}

export function buildExecutionReviewScopeHref(
  scope?: Partial<ShellRouteScope> | null,
  filter?: string | null
) {
  const href = withShellRouteScope("/execution/review", scope);
  if (!filter) {
    return href;
  }

  const url = new URL(href, "http://founderos-shell.local");
  url.searchParams.set("filter", filter);
  return `${url.pathname}${url.search}`;
}

export function buildReviewScopeHref(
  scope?: Partial<ShellRouteScope> | null,
  lane?: string | null,
  preset?: string | null
) {
  const href = withShellRouteScope("/review", scope);
  if (!lane && !preset) {
    return href;
  }

  const url = new URL(href, "http://founderos-shell.local");
  if (lane) {
    url.searchParams.set("lane", lane);
  }
  if (preset) {
    url.searchParams.set("preset", preset);
  }
  return `${url.pathname}${url.search}`;
}

export function buildExecutionProjectScopeHref(
  projectId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/execution/projects/${encodeURIComponent(projectId)}`,
    scope
  );
}

export function buildExecutionAgentScopeHref(
  runtimeAgentId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/execution/agents/${encodeURIComponent(runtimeAgentId)}`,
    scope
  );
}

export function buildExecutionIntakeScopeHref(
  sessionId?: string | null,
  scope?: Partial<ShellRouteScope> | null
) {
  const href = sessionId
    ? `/execution/intake/${encodeURIComponent(sessionId)}`
    : "/execution/intake";
  return withShellRouteScope(href, scope);
}

export function buildInboxScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/inbox", scope);
}

export function buildPortfolioScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/portfolio", scope);
}

export function buildSettingsScopeHref(
  scope?: Partial<ShellRouteScope> | null,
  targets?: Partial<ShellSettingsParityTargets> | null
) {
  return withShellSettingsParityTargets(withShellRouteScope("/settings", scope), targets);
}

export function buildShellParityAuditScopeHref(
  scope?: Partial<ShellRouteScope> | null,
  targets?: Partial<ShellSettingsParityTargets> | null
) {
  return withShellSettingsParityTargets(
    withShellRouteScope("/api/shell/parity", scope),
    targets
  );
}

export function buildDiscoveryIdeasScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/ideas", scope);
}

export function buildDiscoveryIntelligenceScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/intelligence", scope);
}

export function buildDiscoveryIntelligenceProfileScopeHref(
  profileId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/discovery/intelligence/${encodeURIComponent(profileId)}`,
    scope
  );
}

export function buildDiscoveryImprovementScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/improvement", scope);
}

export function buildDiscoveryImprovementProfileScopeHref(
  profileId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/discovery/improvement/${encodeURIComponent(profileId)}`,
    scope
  );
}

export function buildDiscoveryAuthoringScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/authoring", scope);
}

export function buildDiscoveryReviewScopeHref(
  scope?: Partial<ShellRouteScope> | null,
  filter?: string | null
) {
  const href = withShellRouteScope("/discovery/review", scope);
  if (!filter) {
    return href;
  }

  const url = new URL(href, "http://founderos-shell.local");
  url.searchParams.set("filter", filter);
  return `${url.pathname}${url.search}`;
}

export function buildDiscoveryIdeaAuthoringScopeHref(
  ideaId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/discovery/ideas/${encodeURIComponent(ideaId)}/authoring`,
    scope
  );
}

export function buildDiscoveryBoardScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/board", scope);
}

export function buildDiscoveryBoardRankingScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/board/ranking", scope);
}

export function buildDiscoveryBoardArchiveScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/board/archive", scope);
}

export function buildDiscoveryBoardFinalsScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/board/finals", scope);
}

export function buildDiscoveryBoardSimulationsScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/board/simulations", scope);
}

export function buildDiscoveryBoardSimulationIdeaScopeHref(
  ideaId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/discovery/board/simulations/${encodeURIComponent(ideaId)}`,
    scope
  );
}

export function buildDiscoveryTracesScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery/traces", scope);
}

export function buildDiscoveryTraceIdeaScopeHref(
  ideaId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/discovery/traces/${encodeURIComponent(ideaId)}`,
    scope
  );
}

export function buildDiscoveryReplayScopeHref(
  sessionId?: string | null,
  scope?: Partial<ShellRouteScope> | null
) {
  const href = sessionId
    ? `/discovery/replays/${encodeURIComponent(sessionId)}`
    : "/discovery/replays";
  return withShellRouteScope(href, scope);
}

export function buildDiscoveryScopeHref(
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope("/discovery", scope);
}

export function buildDiscoverySessionScopeHref(
  sessionId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/discovery/sessions/${encodeURIComponent(sessionId)}`,
    scope
  );
}

export function buildDiscoveryIdeaScopeHref(
  ideaId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/discovery/ideas/${encodeURIComponent(ideaId)}`,
    scope
  );
}

export function buildExecutionHandoffScopeHref(
  handoffId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/execution/handoffs/${encodeURIComponent(handoffId)}`,
    scope
  );
}

export function buildExecutionAuditScopeHref(
  auditId: string,
  scope?: Partial<ShellRouteScope> | null
) {
  return withShellRouteScope(
    `/execution/audits/${encodeURIComponent(auditId)}`,
    scope
  );
}

import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotIntakeSessionSummary,
  AutopilotProjectSummary,
  AutopilotToolPermissionRuntimeRecord,
  QuorumDiscoveryInboxFeed,
  QuorumDiscoveryInboxItem,
} from "@founderos/api-clients";
import type { ShellChainRecord } from "@/lib/chain-graph";
import type { ShellDiscoveryAuthoringSummary } from "@/lib/discovery-authoring";

import {
  buildExecutionSourceContext,
  routeScopeFromExecutionSourceContext,
  type ShellExecutionSourceContext,
} from "@/lib/execution-source";
import {
  buildDiscoveryIdeaAuthoringScopeHref,
  buildDiscoveryIdeaScopeHref,
  buildDiscoveryScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  hasShellRouteScope,
  routeScopeFromIntakeSessionRef,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";

export type DiscoveryAttentionChainContext = {
  chainKind: "linked" | "intake-linked" | "orphan-project";
  authoring: ShellDiscoveryAuthoringSummary;
  authoringHref: string;
  briefId: string;
  ideaId: string;
  ideaTitle: string;
  projectId: string;
  projectName: string;
  intakeSessionId: string;
  intakeSessionTitle: string;
  routeScope: ShellRouteScope;
  executionHref: string | null;
  intakeHref: string | null;
};

export type DiscoveryAttentionRecord = {
  type: "discovery";
  plane: "discovery";
  key: string;
  tone: "info" | "warning" | "danger" | "neutral";
  label: string;
  title: string;
  detail: string;
  status: string;
  attention: number;
  sortAt: string;
  href: string;
  hrefLabel: string;
  searchText: string;
  chain: DiscoveryAttentionChainContext | null;
  item: QuorumDiscoveryInboxItem;
};

export type IssueAttentionRecord = {
  type: "issue";
  plane: "execution";
  key: string;
  tone: "info" | "warning" | "danger" | "neutral";
  label: string;
  title: string;
  detail: string;
  status: string;
  attention: number;
  sortAt: string;
  href: string;
  hrefLabel: string;
  searchText: string;
  source: ShellExecutionSourceContext;
  issue: AutopilotExecutionIssueRecord;
};

export type ApprovalAttentionRecord = {
  type: "approval";
  plane: "execution";
  key: string;
  tone: "info" | "warning" | "danger" | "neutral";
  label: string;
  title: string;
  detail: string;
  status: string;
  attention: number;
  sortAt: string;
  href: string;
  hrefLabel: string;
  searchText: string;
  source: ShellExecutionSourceContext;
  approval: AutopilotExecutionApprovalRecord;
};

export type RuntimeAttentionRecord = {
  type: "runtime";
  plane: "execution";
  key: string;
  tone: "info" | "warning" | "danger" | "neutral";
  label: string;
  title: string;
  detail: string;
  status: string;
  attention: number;
  sortAt: string;
  href: string;
  hrefLabel: string;
  searchText: string;
  source: ShellExecutionSourceContext;
  runtime: AutopilotToolPermissionRuntimeRecord;
};

export type ShellAttentionRecord =
  | DiscoveryAttentionRecord
  | IssueAttentionRecord
  | ApprovalAttentionRecord
  | RuntimeAttentionRecord;

export type ShellExecutionAttentionRecord =
  | IssueAttentionRecord
  | ApprovalAttentionRecord
  | RuntimeAttentionRecord;

export type ProjectAttentionRollup = {
  issues: AutopilotExecutionIssueRecord[];
  approvals: AutopilotExecutionApprovalRecord[];
  runtimes: AutopilotToolPermissionRuntimeRecord[];
  total: number;
};

function chainRecordForProjectId(
  records: ShellChainRecord[] | undefined,
  projectId: string
) {
  return (
    records?.find((record) => {
      if (record.kind === "orphan-project") {
        return record.project.id === projectId;
      }
      return record.project?.id === projectId;
    }) ?? null
  );
}

function chainRecordForIdeaId(
  records: ShellChainRecord[] | undefined,
  ideaId: string
) {
  return (
    records?.find(
      (record) => record.kind === "linked" && record.idea.idea_id === ideaId
    ) ?? null
  );
}

function discoveryChainContext(
  item: QuorumDiscoveryInboxItem,
  chainRecord: ShellChainRecord | null,
  fallback?: Partial<ShellRouteScope> | null
): DiscoveryAttentionChainContext | null {
  if (!chainRecord || chainRecord.kind !== "linked") {
    return null;
  }

  const intakeSessionId =
    chainRecord.intakeSessionId || chainRecord.intakeSession?.id || "";
  const routeScope = chainRecord.project
    ? routeScopeFromProjectRef(chainRecord.project.id, intakeSessionId, fallback)
    : routeScopeFromIntakeSessionRef(intakeSessionId, "", fallback);

  return {
    chainKind: chainRecord.kind,
    authoring: chainRecord.authoring,
    authoringHref: buildDiscoveryIdeaAuthoringScopeHref(
      item.idea_id || chainRecord.idea.idea_id,
      routeScope
    ),
    briefId: chainRecord.briefId,
    ideaId: item.idea_id || chainRecord.idea.idea_id,
    ideaTitle: chainRecord.idea.title,
    projectId: chainRecord.project?.id || "",
    projectName: chainRecord.project?.name || "",
    intakeSessionId,
    intakeSessionTitle: chainRecord.intakeSession?.title || "",
    routeScope,
    executionHref: chainRecord.project
      ? buildExecutionProjectScopeHref(chainRecord.project.id, routeScope)
      : null,
    intakeHref: intakeSessionId
      ? buildExecutionIntakeScopeHref(intakeSessionId, routeScope)
      : null,
  };
}

function issueSeverityRank(severity: string) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function sortIssues(items: AutopilotExecutionIssueRecord[]) {
  return [...items].sort((left, right) => {
    const severityDelta =
      issueSeverityRank(right.severity) - issueSeverityRank(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }
    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function sortApprovals(items: AutopilotExecutionApprovalRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function sortRuntimes(items: AutopilotToolPermissionRuntimeRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function buildSearchText(values: unknown[], depth: number = 0): string {
  if (depth > 2) {
    return "";
  }

  const tokens: string[] = [];

  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      tokens.push(String(value));
      continue;
    }
    if (Array.isArray(value)) {
      const nested = buildSearchText(value.slice(0, 8), depth + 1);
      if (nested) {
        tokens.push(nested);
      }
      continue;
    }
    const record = asRecord(value);
    if (record) {
      for (const [key, entry] of Object.entries(record).slice(0, 8)) {
        tokens.push(key);
        const nested = buildSearchText([entry], depth + 1);
        if (nested) {
          tokens.push(nested);
        }
      }
    }
  }

  return tokens.join(" ").toLowerCase();
}

function extractToolPermissionMessage(runtime: AutopilotToolPermissionRuntimeRecord): string {
  const pendingStage = (runtime.pending_stage || "").trim();
  const stagePayload =
    pendingStage &&
    runtime.payload &&
    typeof runtime.payload === "object" &&
    !Array.isArray(runtime.payload)
      ? runtime.payload[pendingStage]
      : null;
  const stageMessage =
    stagePayload &&
    typeof stagePayload === "object" &&
    !Array.isArray(stagePayload) &&
    typeof (stagePayload as Record<string, unknown>).message === "string"
      ? ((stagePayload as Record<string, unknown>).message as string)
      : null;

  if (stageMessage && stageMessage.trim()) {
    return stageMessage;
  }

  return runtime.message || "Tool permission request is waiting for review.";
}

function discoveryHref(
  item: QuorumDiscoveryInboxItem,
  routeScope?: Partial<ShellRouteScope> | null,
  chainContext?: DiscoveryAttentionChainContext | null
) {
  const nextScope = chainContext?.routeScope || routeScope;
  if (item.idea_id) {
    return buildDiscoveryIdeaScopeHref(item.idea_id, nextScope);
  }
  return buildDiscoveryScopeHref(nextScope);
}

function issueAttention(issue: AutopilotExecutionIssueRecord) {
  const severityScore =
    issue.severity === "critical"
      ? 100
      : issue.severity === "high"
        ? 85
        : issue.severity === "medium"
          ? 65
          : 45;
  return severityScore + (issue.status === "open" ? 20 : 0);
}

function approvalAttention(approval: AutopilotExecutionApprovalRecord) {
  return (
    70 + approval.policy_reasons.length * 5 + (approval.status === "pending" ? 15 : 0)
  );
}

function runtimeAttention(runtime: AutopilotToolPermissionRuntimeRecord) {
  return 75 + (runtime.pending_stage ? 10 : 0) + (runtime.status === "pending" ? 10 : 0);
}

function discoveryAttention(item: QuorumDiscoveryInboxItem) {
  const bucketBonus =
    item.aging_bucket === "stale" ? 35 : item.aging_bucket === "aging" ? 15 : 0;
  const interruptBonus = item.interrupt ? 20 : 0;
  return item.priority_score + bucketBonus + interruptBonus;
}

export function humanizeAttentionToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function attentionPlaneTone(plane: "discovery" | "execution") {
  return plane === "discovery" ? ("info" as const) : ("neutral" as const);
}

export function executionIssueSeverityTone(severity: string) {
  if (severity === "critical" || severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  return "neutral" as const;
}

export function executionStatusTone(status: string) {
  if (status === "pending" || status === "open") return "warning" as const;
  if (status === "approved" || status === "allowed" || status === "resolved") {
    return "success" as const;
  }
  if (status === "rejected" || status === "denied") return "danger" as const;
  return "neutral" as const;
}

export function executionSourceTone(sourceKind: string) {
  if (sourceKind === "intake_session") return "info" as const;
  if (sourceKind === "execution_brief") return "success" as const;
  return "neutral" as const;
}

export function executionSourceLabel(sourceKind?: string) {
  if (sourceKind === "intake_session") return "intake session";
  if (sourceKind === "execution_brief") return "execution brief";
  return (sourceKind || "local_brief").replace(/[_-]+/g, " ");
}

export function matchesAttentionRouteScope(
  record: ShellAttentionRecord,
  scope: ShellRouteScope
) {
  if (!hasShellRouteScope(scope)) {
    return true;
  }

  if (record.type === "discovery") {
    if (!record.chain) {
      return false;
    }

    if (scope.projectId && record.chain.projectId !== scope.projectId) {
      return false;
    }

    if (!scope.intakeSessionId) {
      return true;
    }

    return record.chain.intakeSessionId === scope.intakeSessionId;
  }

  if (scope.projectId && record.source.projectId !== scope.projectId) {
    return false;
  }

  if (!scope.intakeSessionId) {
    return true;
  }

  const recordIntakeSessionId =
    record.source.intakeSession?.id ||
    (record.source.sourceKind === "intake_session"
      ? record.source.sourceExternalId
      : "");

  return recordIntakeSessionId === scope.intakeSessionId;
}

export function buildProjectAttentionRollup(
  projectId: string | null | undefined,
  issues: AutopilotExecutionIssueRecord[],
  approvals: AutopilotExecutionApprovalRecord[],
  runtimes: AutopilotToolPermissionRuntimeRecord[]
): ProjectAttentionRollup | null {
  if (!projectId) {
    return null;
  }

  const projectIssues = sortIssues(
    issues.filter((issue) => issue.project_id === projectId)
  );
  const projectApprovals = sortApprovals(
    approvals.filter((approval) => approval.project_id === projectId)
  );
  const projectRuntimes = sortRuntimes(
    runtimes.filter((runtime) => runtime.project_id === projectId)
  );
  const total =
    projectIssues.length + projectApprovals.length + projectRuntimes.length;

  if (total === 0) {
    return null;
  }

  return {
    issues: projectIssues,
    approvals: projectApprovals,
    runtimes: projectRuntimes,
    total,
  };
}

export function buildShellAttentionRecords(input: {
  discoveryFeed: QuorumDiscoveryInboxFeed;
  projects: AutopilotProjectSummary[];
  intakeSessions: AutopilotIntakeSessionSummary[];
  approvals: AutopilotExecutionApprovalRecord[];
  issues: AutopilotExecutionIssueRecord[];
  runtimes: AutopilotToolPermissionRuntimeRecord[];
  chains?: ShellChainRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
}): ShellAttentionRecord[] {
  const projectsById = new Map(input.projects.map((project) => [project.id, project]));
  const intakeSessionsById = new Map(
    input.intakeSessions.map((session) => [session.id, session])
  );
  const intakeSessionsByProjectId = new Map(
    input.intakeSessions
      .filter((session) => Boolean(session.linked_project_id))
      .map((session) => [session.linked_project_id, session])
  );

  const discoveryRecords: DiscoveryAttentionRecord[] = input.discoveryFeed.items.map(
    (item) => {
      const chain = item.idea_id
        ? discoveryChainContext(
            item,
            chainRecordForIdeaId(input.chains, item.idea_id),
            input.routeScope
          )
        : null;

      return {
        type: "discovery",
        plane: "discovery",
        key: `discovery:${item.item_id}`,
        tone:
          item.aging_bucket === "stale"
            ? ("danger" as const)
            : item.aging_bucket === "aging"
              ? ("warning" as const)
              : ("info" as const),
        label: "discovery",
        title: item.title,
        detail:
          item.interrupt?.description ||
          item.dossier_preview?.idea_summary ||
          item.detail,
        status: item.status,
        attention: discoveryAttention(item),
        sortAt: item.due_at || item.created_at,
        href: discoveryHref(item, input.routeScope, chain),
        hrefLabel: item.idea_id ? "Open dossier" : "Open discovery",
        searchText: buildSearchText([
          item.title,
          item.detail,
          item.item_id,
          item.kind,
          item.subject_kind,
          item.idea_id,
          item.interrupt?.summary,
          item.interrupt?.description,
          item.dossier_preview?.headline,
          item.dossier_preview?.idea_summary,
          item.dossier_preview?.compare_options,
          item.dossier_preview?.evidence,
          chain?.chainKind,
          chain?.briefId,
          chain?.projectId,
          chain?.projectName,
          chain?.intakeSessionId,
          chain?.intakeSessionTitle,
          chain?.ideaTitle,
          chain?.authoring.headline,
          chain?.authoring.detail,
          chain?.authoring.gaps,
        ]),
        chain,
        item,
      };
    }
  );

  const issueRecords: IssueAttentionRecord[] = input.issues.map((issue) => {
    const chainRecord = chainRecordForProjectId(input.chains, issue.project_id);
    const source = buildExecutionSourceContext(
      issue.project_id,
      projectsById,
      intakeSessionsById,
      intakeSessionsByProjectId,
      chainRecord
    );

    return {
      type: "issue",
      plane: "execution",
      key: `issue:${issue.id}`,
      tone: executionIssueSeverityTone(issue.severity),
      label: "issue",
      title: issue.title,
      detail: issue.description || issue.root_cause || issue.project_name,
      status: issue.status,
      attention: issueAttention(issue),
      sortAt: issue.updated_at || issue.created_at,
      href: buildExecutionProjectScopeHref(
        issue.project_id,
        routeScopeFromExecutionSourceContext(source, input.routeScope)
      ),
      hrefLabel: "Open project",
      searchText: buildSearchText([
        issue.title,
        issue.description,
        issue.root_cause,
        issue.project_id,
        issue.project_name,
        issue.category,
        issue.severity,
        issue.id,
        issue.orchestrator,
        issue.related_command,
        issue.runtime_agent_id,
        issue.runtime_agent_ids,
        issue.approval_id,
        issue.context,
        source.sourceKind,
        source.sourceExternalId,
        source.chainKind,
        source.briefId,
        source.discoveryIdeaId,
        source.discoveryIdeaTitle,
        source.intakeSession?.title,
        source.intakeSession?.linked_project_name,
      ]),
      source,
      issue,
    };
  });

  const approvalRecords: ApprovalAttentionRecord[] = input.approvals.map(
    (approval) => {
      const chainRecord = chainRecordForProjectId(input.chains, approval.project_id);
      const source = buildExecutionSourceContext(
        approval.project_id,
        projectsById,
        intakeSessionsById,
        intakeSessionsByProjectId,
        chainRecord
      );

      return {
        type: "approval",
        plane: "execution",
        key: `approval:${approval.id}`,
        tone: "warning" as const,
        label: "approval",
        title: `Approval for ${approval.project_name}`,
        detail: approval.reason || `Approve ${humanizeAttentionToken(approval.action)}.`,
        status: approval.status,
        attention: approvalAttention(approval),
        sortAt: approval.updated_at || approval.created_at,
        href: buildExecutionProjectScopeHref(
          approval.project_id,
          routeScopeFromExecutionSourceContext(source, input.routeScope)
        ),
        hrefLabel: "Open approval context",
        searchText: buildSearchText([
          approval.id,
          approval.project_id,
          approval.project_name,
          approval.action,
          approval.reason,
          approval.requested_by,
          approval.policy_reasons,
          approval.payload,
          approval.issue_id,
          approval.runtime_agent_ids,
          source.sourceKind,
          source.sourceExternalId,
          source.chainKind,
          source.briefId,
          source.discoveryIdeaId,
          source.discoveryIdeaTitle,
          source.intakeSession?.title,
          source.intakeSession?.linked_project_name,
        ]),
        source,
        approval,
      };
    }
  );

  const runtimeRecords: RuntimeAttentionRecord[] = input.runtimes.map((runtime) => {
    const chainRecord = chainRecordForProjectId(input.chains, runtime.project_id);
    const source = buildExecutionSourceContext(
      runtime.project_id,
      projectsById,
      intakeSessionsById,
      intakeSessionsByProjectId,
      chainRecord
    );

    return {
      type: "runtime",
      plane: "execution",
      key: `runtime:${runtime.id}`,
      tone: "warning" as const,
      label: "tool permission",
      title: `Tool permission for ${runtime.tool_name}`,
      detail:
        extractToolPermissionMessage(runtime) ||
        `${runtime.tool_name} is waiting for review.`,
      status: runtime.status,
      attention: runtimeAttention(runtime),
      sortAt: runtime.updated_at || runtime.created_at,
      href: buildExecutionProjectScopeHref(
        runtime.project_id,
        routeScopeFromExecutionSourceContext(source, input.routeScope)
      ),
      hrefLabel: "Open runtime context",
      searchText: buildSearchText([
        runtime.id,
        runtime.project_id,
        runtime.tool_name,
        runtime.message,
        runtime.pending_stage,
        runtime.status,
        runtime.kind,
        runtime.payload,
        runtime.metadata,
        runtime.approval_id,
        runtime.issue_id,
        runtime.runtime_agent_ids,
        source.sourceKind,
        source.sourceExternalId,
        source.chainKind,
        source.briefId,
        source.discoveryIdeaId,
        source.discoveryIdeaTitle,
        source.intakeSession?.title,
        source.intakeSession?.linked_project_name,
      ]),
      source,
      runtime,
    };
  });

  return [
    ...discoveryRecords,
    ...issueRecords,
    ...approvalRecords,
    ...runtimeRecords,
  ].sort((left, right) => {
    if (right.attention !== left.attention) {
      return right.attention - left.attention;
    }
    const leftTime = Date.parse(left.sortAt || "") || 0;
    const rightTime = Date.parse(right.sortAt || "") || 0;
    return rightTime - leftTime;
  });
}

export function isShellExecutionAttentionRecord(
  record: ShellAttentionRecord
): record is ShellExecutionAttentionRecord {
  return record.plane === "execution";
}

export function buildShellExecutionAttentionRecords(input: {
  discoveryFeed: QuorumDiscoveryInboxFeed;
  projects: AutopilotProjectSummary[];
  intakeSessions: AutopilotIntakeSessionSummary[];
  approvals: AutopilotExecutionApprovalRecord[];
  issues: AutopilotExecutionIssueRecord[];
  runtimes: AutopilotToolPermissionRuntimeRecord[];
  chains?: ShellChainRecord[];
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  return buildShellAttentionRecords(input).filter(isShellExecutionAttentionRecord);
}

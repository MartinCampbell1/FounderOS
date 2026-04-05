export type AutopilotProjectRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export interface AutopilotLaunchProfile {
  preset: "fast" | "team" | "parallel" | string;
  provider?: string;
  provider_config_id?: string;
  runtime_profile_id?: string;
  story_execution_mode: "solo" | "team" | string;
  project_concurrency_mode: "sequential" | "parallel" | string;
  max_parallel_stories: number;
  story_pipeline?: string[];
  review_phases?: string[];
}

export interface AutopilotLaunchPreset {
  id: string;
  label: string;
  description: string;
  launch_profile: AutopilotLaunchProfile;
}

export interface AutopilotTaskSource {
  source_kind: string;
  external_id: string;
  repo: string;
  branch_policy: string;
  brief_ref: string;
}

export interface AutopilotProjectDeliveryLoop {
  source?: AutopilotTaskSource;
  brief?: {
    title: string;
    relpath: string;
    path: string;
    present: boolean;
  };
  run?: {
    status: string;
    started_at?: string | null;
    finished_at?: string | null;
    current_story_id?: number | null;
    current_story_title?: string | null;
    last_event?: {
      event?: string | null;
      status?: string | null;
      message?: string | null;
      timestamp?: string | null;
    } | null;
  };
  handoff?: {
    story_id?: number | null;
    story_title?: string;
    head_branch?: string;
    number?: number | null;
    url?: string;
    state?: string;
    ci_status?: string;
    review_status?: string;
    handoff_status?: string;
    merge_state?: string;
    updated_at?: string | null;
  } | null;
  artifact?: {
    artifact_id?: string;
    artifact_type?: string;
    ref_label?: string;
    url?: string;
    path?: string;
    present?: boolean;
    generated_at?: string | null;
  } | null;
}

export interface AutopilotProjectDeliveryStatus {
  stage: string;
  status: string;
  headline: string;
  detail: string;
  next_step: string;
  handoff_ref: string;
  artifact_present: boolean;
  brief_present: boolean;
}

export interface AutopilotSpecBootstrap {
  title: string;
  summary: string;
  goals: string[];
  tech_stack: string[];
  execution_context: string[];
  integrations: string[];
  constraints: string[];
  deliverables: string[];
  open_questions: string[];
  rendered_spec: string;
}

export interface AutopilotPrdStory {
  id: number;
  phase_id?: string;
  phase_title?: string;
  title: string;
  description: string;
  acceptance_criteria?: string[];
  tags?: string[];
  role?: string;
  skill_packs?: string[];
  connectors?: string[];
  required_connectors?: string[];
  preferred_connectors?: string[];
  forbidden_connectors?: string[];
  status?: string;
}

export interface AutopilotPrd {
  title: string;
  description: string;
  phases?: Array<{
    id: string;
    title: string;
    goal?: string;
  }>;
  stories: AutopilotPrdStory[];
}

export interface AutopilotCreateProjectResult {
  status: string;
  project_id: string;
  project_name: string;
  project_path: string;
  prd_path: string;
  launched: boolean;
  message: string;
  intake_session_id?: string;
}

export interface AutopilotCreateProjectFromExecutionBriefResult
  extends AutopilotCreateProjectResult {
  execution_brief_path?: string;
  log_path?: string;
  launch_profile?: AutopilotLaunchProfile | null;
}

export interface AutopilotLaunchResult {
  status: string;
  project_id: string;
  launched: boolean;
  message: string;
  log_path?: string;
  launch_profile?: AutopilotLaunchProfile | null;
}

export interface AutopilotIntakeResponse {
  session_id: string;
  response: string;
  prd_ready: boolean;
  prd: AutopilotPrd | null;
  spec_bootstrap: AutopilotSpecBootstrap | null;
  can_generate_prd: boolean;
}

export interface AutopilotIntakeMessage {
  role: "user" | "assistant" | string;
  content: string;
}

export interface AutopilotIntakeSessionSummary {
  id: string;
  title: string;
  messages: number;
  prd_ready: boolean;
  bootstrap_ready: boolean;
  updated_at: string;
  last_message: string;
  project_name: string;
  linked_project_id: string;
  linked_project_name: string;
}

export interface AutopilotIntakeSessionDetail {
  session_id: string;
  title: string;
  messages: AutopilotIntakeMessage[];
  prd_ready: boolean;
  bootstrap_ready: boolean;
  prd: AutopilotPrd | null;
  spec_bootstrap: AutopilotSpecBootstrap | null;
  can_generate_prd: boolean;
  project_name: string;
  updated_at: string;
  linked_project_id: string;
  linked_project_name: string;
}

export interface AutopilotProjectSummary {
  id: string;
  name: string;
  path: string;
  priority: "high" | "normal" | "low" | string;
  archived: boolean;
  status: AutopilotProjectRunStatus | string;
  paused: boolean;
  stories_done: number;
  stories_total: number;
  current_story_id?: number | null;
  current_story_title?: string | null;
  last_activity_at?: string | null;
  last_message?: string;
  pid?: number | null;
  runtime_session_id?: string;
  runtime_control_available?: boolean;
  launch_profile?: AutopilotLaunchProfile;
  provider_config?: {
    id: string;
    family: string;
    mode: string;
    transport: string;
  };
  runtime_profile?: {
    id: string;
    sandbox_mode: string;
    network_policy: string;
    filesystem_policy: string;
    default_tools: string[];
  };
  task_source?: AutopilotTaskSource;
  delivery_loop?: AutopilotProjectDeliveryLoop;
  delivery_status?: AutopilotProjectDeliveryStatus;
}

export interface AutopilotStory {
  id: number;
  title: string;
  description: string;
  status: string;
  agent?: string | null;
  iteration?: number;
  updated_at?: string | null;
}

export interface AutopilotTimelineEvent {
  event: string;
  status?: string | null;
  message?: string | null;
  timestamp?: string | null;
}

export interface AutopilotProjectDetail extends AutopilotProjectSummary {
  description: string;
  stories: AutopilotStory[];
  timeline: AutopilotTimelineEvent[];
  last_error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  active_worker?: string | null;
  active_critic?: string | null;
  current_iteration?: number;
}

export interface AutopilotToolPermissionRuntimeRecord {
  id: string;
  key: string;
  project_id: string;
  status: string;
  claim_id: string;
  resolution_id: string;
  approval_id: string;
  issue_id: string;
  permission_sync_key: string;
  runtime_agent_ids: string[];
  winner_source: string;
  outcome: string;
  message: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  settlement_attempts: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  kind: string;
  pending_stage: string;
  tool_name: string;
  tool_use_id: string;
  resolved_behavior: string;
  resolved_by: string;
  resolved_source: string;
}

export interface AutopilotExecutionApprovalRecord {
  id: string;
  project_id: string;
  project_name: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  requested_by: string;
  reason: string;
  initiative_id: string;
  orchestrator: string;
  orchestration_run_id: string;
  issue_id: string;
  runtime_agent_ids: string[];
  policy_reasons: string[];
  created_at: string;
  updated_at: string;
  decided_at?: string | null;
  decided_by?: string | null;
  decision_note: string;
  applied_at?: string | null;
  applied_by?: string | null;
}

export interface AutopilotExecutionIssueRecord {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  root_cause: string;
  category: string;
  severity: string;
  status: string;
  source_event: string;
  related_command: string;
  story_id?: number | null;
  runtime_agent_id: string;
  runtime_agent_ids: string[];
  approval_id: string;
  dedupe_key: string;
  initiative_id: string;
  orchestrator: string;
  orchestration_run_id: string;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_note: string;
}

export interface AutopilotApprovalDecisionResult {
  status: string;
  approval: AutopilotExecutionApprovalRecord;
}

export interface AutopilotIssueResolutionResult {
  status: string;
  issue: AutopilotExecutionIssueRecord;
}

export interface AutopilotToolPermissionRuntimeDecisionResult {
  status: string;
  runtime: AutopilotToolPermissionRuntimeRecord;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      if (payload.detail) {
        detail = payload.detail;
      } else if (payload.message) {
        detail = payload.message;
      }
    } catch {
      // Keep fallback.
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function buildQuery(
  entries: Record<string, string | number | boolean | null | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchAutopilotProjects(
  includeArchived = false
): Promise<AutopilotProjectSummary[]> {
  const payload = await requestJson<{
    projects: AutopilotProjectSummary[];
    projectsError: string | null;
  }>(
    `/api/shell/execution/workspace?includeArchived=${includeArchived ? "true" : "false"}`
  );

  if (payload.projectsError) {
    throw new Error(payload.projectsError);
  }

  return payload.projects;
}

export async function fetchAutopilotProject(
  projectId: string
): Promise<AutopilotProjectDetail> {
  const payload = await requestJson<{
    project: AutopilotProjectDetail | null;
    projectError: string | null;
  }>(`/api/shell/execution/workspace?projectId=${encodeURIComponent(projectId)}`);

  if (payload.project) {
    return payload.project;
  }

  throw new Error(payload.projectError || `Autopilot project ${projectId} not found.`);
}

export async function fetchAutopilotLaunchPresets(): Promise<
  AutopilotLaunchPreset[]
> {
  const payload = await requestJson<{
    launchPresets: AutopilotLaunchPreset[];
    launchPresetsError: string | null;
  }>(`/api/shell/execution/workspace`);

  if (payload.launchPresetsError) {
    throw new Error(payload.launchPresetsError);
  }

  return payload.launchPresets;
}

export async function sendAutopilotIntakeMessage(
  message: string,
  sessionId?: string | null
): Promise<AutopilotIntakeResponse> {
  return requestJson<AutopilotIntakeResponse>(`/api/shell/execution/actions/intake/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      session_id: sessionId ?? null,
    }),
  });
}

export async function generateAutopilotPrdFromSession(
  sessionId: string
): Promise<{ prd: AutopilotPrd }> {
  return requestJson<{ prd: AutopilotPrd }>(
    `/api/shell/execution/actions/intake/generate-prd`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    }
  );
}

export async function fetchAutopilotIntakeSession(
  sessionId: string
): Promise<AutopilotIntakeSessionDetail> {
  const payload = await requestJson<{
    intakeSession: AutopilotIntakeSessionDetail | null;
    intakeSessionError: string | null;
  }>(`/api/shell/execution/intake?sessionId=${encodeURIComponent(sessionId)}`);

  if (payload.intakeSession) {
    return payload.intakeSession;
  }

  throw new Error(
    payload.intakeSessionError || `Autopilot intake session ${sessionId} not found.`
  );
}

export async function fetchAutopilotIntakeSessions(): Promise<
  AutopilotIntakeSessionSummary[]
> {
  const response = await requestJson<{
    intakeSessions: AutopilotIntakeSessionSummary[];
    intakeSessionsError?: string | null;
  }>(`/api/shell/execution/intake`);

  if (response.intakeSessionsError) {
    throw new Error(response.intakeSessionsError);
  }

  return response.intakeSessions;
}

export async function createAutopilotProjectFromPrd(input: {
  prd: AutopilotPrd;
  projectName?: string;
  projectPath?: string;
  priority?: string;
  taskSource?: AutopilotTaskSource | null;
  intakeSessionId?: string;
}): Promise<AutopilotCreateProjectResult> {
  return requestJson<AutopilotCreateProjectResult>(`/api/shell/execution/actions/projects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prd: input.prd,
      project_name: input.projectName ?? null,
      project_path: input.projectPath ?? null,
      priority: input.priority ?? "normal",
      task_source: input.taskSource ?? null,
      intake_session_id: input.intakeSessionId ?? null,
    }),
  });
}

export async function createAutopilotProjectFromExecutionBrief(input: {
  brief: Record<string, unknown>;
  projectName?: string;
  projectPath?: string;
  priority?: string;
  launch?: boolean;
  launchProfile?: Partial<AutopilotLaunchProfile> | null;
}): Promise<AutopilotCreateProjectFromExecutionBriefResult> {
  return requestJson<AutopilotCreateProjectFromExecutionBriefResult>(
    `/api/shell/execution/actions/projects/from-execution-brief`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brief: input.brief,
        project_name: input.projectName ?? null,
        project_path: input.projectPath ?? null,
        priority: input.priority ?? "normal",
        launch: input.launch ?? false,
        launch_profile: input.launchProfile ?? null,
      }),
    }
  );
}

export async function launchAutopilotProject(
  projectId: string,
  launchProfile?: Partial<AutopilotLaunchProfile> | null
): Promise<AutopilotLaunchResult> {
  return requestJson<AutopilotLaunchResult>(
    `/api/shell/execution/actions/projects/${encodeURIComponent(projectId)}/launch`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        launch_profile: launchProfile ?? null,
      }),
    }
  );
}

export async function pauseAutopilotProject(
  projectId: string
): Promise<{ status: string; message: string }> {
  return requestJson<{ status: string; message: string }>(
    `/api/shell/execution/actions/projects/${encodeURIComponent(projectId)}/pause`,
    {
      method: "POST",
    }
  );
}

export async function resumeAutopilotProject(
  projectId: string
): Promise<AutopilotLaunchResult> {
  return requestJson<AutopilotLaunchResult>(
    `/api/shell/execution/actions/projects/${encodeURIComponent(projectId)}/resume`,
    {
      method: "POST",
    }
  );
}

export async function fetchAutopilotExecutionIssues(filters?: {
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  status?: string;
  category?: string;
  runtimeAgentId?: string;
}): Promise<AutopilotExecutionIssueRecord[]> {
  const payload = await requestJson<{
    issues: AutopilotExecutionIssueRecord[];
  }>(
    `/api/shell/execution/attention${buildQuery({
      kind: "issues",
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      status: filters?.status,
      category: filters?.category,
      runtime_agent_id: filters?.runtimeAgentId,
    })}`
  );
  return payload.issues;
}

export async function fetchAutopilotExecutionApprovals(filters?: {
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  status?: string;
  action?: string;
  runtimeAgentId?: string;
}): Promise<AutopilotExecutionApprovalRecord[]> {
  const payload = await requestJson<{
    approvals: AutopilotExecutionApprovalRecord[];
  }>(
    `/api/shell/execution/attention${buildQuery({
      kind: "approvals",
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      status: filters?.status,
      action: filters?.action,
      runtime_agent_id: filters?.runtimeAgentId,
    })}`
  );
  return payload.approvals;
}

export async function fetchAutopilotToolPermissionRuntimes(filters?: {
  projectId?: string;
  runtimeAgentId?: string;
  status?: string;
  pendingStage?: string;
}): Promise<AutopilotToolPermissionRuntimeRecord[]> {
  const payload = await requestJson<{
    runtimes: AutopilotToolPermissionRuntimeRecord[];
  }>(
    `/api/shell/execution/attention${buildQuery({
      kind: "runtimes",
      project_id: filters?.projectId,
      runtime_agent_id: filters?.runtimeAgentId,
      status: filters?.status,
      pending_stage: filters?.pendingStage,
    })}`
  );
  return payload.runtimes;
}

export async function approveAutopilotExecutionApproval(
  approvalId: string,
  payload?: { actor?: string; note?: string }
): Promise<AutopilotApprovalDecisionResult> {
  return requestJson<AutopilotApprovalDecisionResult>(
    `/api/shell/execution/actions/execution-plane/approvals/${encodePathSegment(approvalId)}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: payload?.actor ?? "founderos-shell",
        note: payload?.note ?? "",
      }),
    }
  );
}

export async function rejectAutopilotExecutionApproval(
  approvalId: string,
  payload?: { actor?: string; note?: string }
): Promise<AutopilotApprovalDecisionResult> {
  return requestJson<AutopilotApprovalDecisionResult>(
    `/api/shell/execution/actions/execution-plane/approvals/${encodePathSegment(approvalId)}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: payload?.actor ?? "founderos-shell",
        note: payload?.note ?? "",
      }),
    }
  );
}

export async function resolveAutopilotExecutionIssue(
  issueId: string,
  payload?: { actor?: string; note?: string }
): Promise<AutopilotIssueResolutionResult> {
  return requestJson<AutopilotIssueResolutionResult>(
    `/api/shell/execution/actions/execution-plane/issues/${encodePathSegment(issueId)}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: payload?.actor ?? "founderos-shell",
        note: payload?.note ?? "",
      }),
    }
  );
}

export async function allowAutopilotToolPermissionRuntime(
  approvalRuntimeId: string,
  payload?: {
    actor?: string;
    note?: string;
    source?: "user" | "channel" | string;
  }
): Promise<AutopilotToolPermissionRuntimeDecisionResult> {
  return requestJson<AutopilotToolPermissionRuntimeDecisionResult>(
    `/api/shell/execution/actions/execution-plane/tool-permission-runtimes/${encodePathSegment(approvalRuntimeId)}/allow`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: payload?.actor ?? "founderos-shell",
        note: payload?.note ?? "",
        source: payload?.source ?? "user",
      }),
    }
  );
}

export async function denyAutopilotToolPermissionRuntime(
  approvalRuntimeId: string,
  payload?: {
    actor?: string;
    note?: string;
    source?: "user" | "channel" | string;
  }
): Promise<AutopilotToolPermissionRuntimeDecisionResult> {
  return requestJson<AutopilotToolPermissionRuntimeDecisionResult>(
    `/api/shell/execution/actions/execution-plane/tool-permission-runtimes/${encodePathSegment(approvalRuntimeId)}/deny`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: payload?.actor ?? "founderos-shell",
        note: payload?.note ?? "",
        source: payload?.source ?? "user",
      }),
    }
  );
}

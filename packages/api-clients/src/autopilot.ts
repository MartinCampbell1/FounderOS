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

export type AutopilotExecutionCountMap = Record<string, number>;

export interface AutopilotExecutionRuntimeAgentBudgetSummary {
  tracked: boolean;
  usage_label?: string | null;
  metric?: string | null;
  used?: number | null;
  limit?: number | null;
  remaining?: number | null;
  exhausted: boolean;
  auto_pause_on_exhaustion: boolean;
  last_exhaustion_reason?: string | null;
  auto_paused_at?: string | null;
}

export interface AutopilotExecutionRuntimeAgentAttentionSummary {
  state: string;
  recommended_action: string;
  reasons: string[];
}

export interface AutopilotExecutionRuntimeAgentRecord {
  agent_id: string;
  role: string;
  label: string;
  provider?: string | null;
  profile_name?: string | null;
  member_id?: string | null;
  role_id?: string | null;
  specialist?: boolean;
  status: string;
  pipeline_stage?: string | null;
  pipeline_order?: number | null;
  pipeline_status?: string | null;
  story_id?: number | null;
  story_title?: string | null;
  story_status?: string | null;
  ownership?: Record<string, unknown> | null;
  checkout?: Record<string, unknown> | null;
  skill_packs?: string[];
  planned_connectors?: string[];
  active_connectors?: Array<Record<string, unknown>>;
  open_issue_count: number;
  pending_approval_count: number;
  tool_permission_runtime_count?: number;
  pending_tool_permission_runtime_count?: number;
  active_async_task_count?: number;
  pending_async_run_count?: number;
  budget?: AutopilotExecutionRuntimeAgentBudgetSummary;
  attention?: AutopilotExecutionRuntimeAgentAttentionSummary;
  recommendations?: Array<Record<string, unknown>>;
  suggested_commands?: Array<Record<string, unknown>>;
  project_id?: string;
  project_name?: string;
  project_status?: string;
  project_paused?: boolean;
  initiative?: Record<string, unknown>;
  orchestration?: Record<string, unknown>;
}

export interface AutopilotExecutionProjectDetail {
  project_id: string;
  runtime_agents: AutopilotExecutionRuntimeAgentRecord[];
  monitoring?: Record<string, unknown>;
  trace?: {
    summary?: Record<string, unknown>;
    path?: string;
    monitoring?: Record<string, unknown>;
  };
}

export interface AutopilotExecutionAgentsSummary {
  totals: {
    agents: number;
    active: number;
    blocked: number;
    needs_approval: number;
    waiting_async: number;
    budget_risk: number;
    budget_exhausted: number;
    actionable: number;
    with_suggested_commands: number;
    approval_required_suggestions: number;
  };
  by_attention_state: AutopilotExecutionCountMap;
  by_role: AutopilotExecutionCountMap;
  by_project: AutopilotExecutionCountMap;
  by_recommendation_kind: AutopilotExecutionCountMap;
  by_suggested_command: AutopilotExecutionCountMap;
}

export interface AutopilotExecutionOrchestratorSessionSummary {
  totals: {
    sessions: number;
    open: number;
    completed: number;
    archived: number;
  };
  by_status: AutopilotExecutionCountMap;
  by_orchestrator: AutopilotExecutionCountMap;
  by_actor: AutopilotExecutionCountMap;
  latest_session_at?: string | null;
}

export interface AutopilotExecutionOrchestratorPendingActionOperation {
  type: string;
  session_id: string;
  endpoint: string;
  mode: string;
  payload: Record<string, unknown>;
}

export interface AutopilotExecutionOrchestratorPendingAction {
  kind: string;
  priority: string;
  title: string;
  reason: string;
  session_id: string;
  counts: Record<string, number>;
  operation?: AutopilotExecutionOrchestratorPendingActionOperation | null;
}

export interface AutopilotExecutionOrchestratorSessionRecord {
  id: string;
  orchestrator: string;
  actor: string;
  title: string;
  initiative_id: string;
  project_ids: string[];
  status: string;
  reason: string;
  context: Record<string, unknown>;
  linked_run_ids: string[];
  linked_control_pass_ids: string[];
  linked_approval_ids: string[];
  linked_issue_ids: string[];
  linked_runtime_agent_ids: string[];
  runtime_state: "idle" | "running" | "requires_action" | string;
  pending_action?: AutopilotExecutionOrchestratorPendingAction | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  closed_by: string;
  close_note: string;
}

export interface AutopilotExecutionOrchestratorControlPassSummary {
  totals: {
    control_passes: number;
    ok: number;
    partial: number;
    error: number;
    noop: number;
    customized: number;
    sessions: number;
    projects: number;
    applied_steps: number;
    error_steps: number;
  };
  by_status: AutopilotExecutionCountMap;
  by_profile: AutopilotExecutionCountMap;
  by_actor: AutopilotExecutionCountMap;
  by_orchestrator: AutopilotExecutionCountMap;
  by_final_state: AutopilotExecutionCountMap;
  by_stopped_reason: AutopilotExecutionCountMap;
  by_session_status_before: AutopilotExecutionCountMap;
  by_session_status_after: AutopilotExecutionCountMap;
  latest_control_pass_at?: string | null;
}

export interface AutopilotExecutionOrchestratorControlPassRecord {
  id: string;
  orchestrator_session_id: string;
  actor: string;
  reason: string;
  profile: string;
  customized: boolean;
  recommendation_kinds: string[];
  control_before: Record<string, unknown>;
  control_after: Record<string, unknown>;
  applied: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
  status: string;
  project_ids: string[];
  initiative_id: string;
  orchestrator: string;
  session_status_before: string;
  session_status_after: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface AutopilotExecutionOrchestratorSessionActionSummary {
  totals: {
    actions: number;
    suggested_commands: number;
    recommendations: number;
    approval_required: number;
    projects: number;
  };
  by_action_type: AutopilotExecutionCountMap;
  by_priority: AutopilotExecutionCountMap;
  by_project: AutopilotExecutionCountMap;
  by_command: AutopilotExecutionCountMap;
  by_recommendation_kind: AutopilotExecutionCountMap;
}

export type AutopilotExecutionOrchestratorSessionActionRecord = Record<
  string,
  unknown
>;

export type AutopilotExecutionAgentActionRecord = Record<string, unknown>;

export type AutopilotExecutionProjectCommandPolicy = Record<string, unknown>;

export type AutopilotExecutionProjectCommandResult = Record<string, unknown>;

export interface AutopilotExecutionAgentActionBatchPolicyRequest {
  includeActionTypes?: string[];
  skipPausedProjects?: boolean;
  excludeAttentionStates?: string[];
  priorityAtLeast?: string;
  approvalStrategy?: string;
  approvalPriorityAtLeast?: string;
  allowedCommands?: string[];
  allowedRecommendationKinds?: string[];
  maxActionsPerProject?: number;
}

export type AutopilotExecutionAgentActionPolicyProfile = Record<
  string,
  unknown
>;

export interface AutopilotExecutionOrchestratorSessionControlRecommendation {
  kind: string;
  priority: string;
  title: string;
  reason: string;
  counts: Record<string, number>;
  operation: Record<string, unknown>;
}

export interface AutopilotExecutionOrchestratorSessionControl {
  state: string;
  session_state: "idle" | "running" | "requires_action" | string;
  pending_action?: AutopilotExecutionOrchestratorPendingAction | null;
  counts: {
    pending_approvals: number;
    pending_tool_permission_runtimes?: number;
    open_issues: number;
    active_async_tasks: number;
    pending_async_runs?: number;
    safe_actions: number;
    approval_required_actions: number;
    recommendation_actions: number;
  };
  action_summary: AutopilotExecutionOrchestratorSessionActionSummary;
  recommendations: AutopilotExecutionOrchestratorSessionControlRecommendation[];
}

export interface AutopilotExecutionAgentActionRunSummary {
  selected_count?: number;
  processed_count?: number;
  status_counts?: AutopilotExecutionCountMap;
  [key: string]: unknown;
}

export interface AutopilotExecutionArtifactRecord {
  id: string;
  owner_kind: string;
  owner_id: string;
  source_path: string;
  content_path: string;
  content_bytes: number;
  truncated: boolean;
  preview: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  artifact_ref?: string;
  content: string;
}

export interface AutopilotExecutionShadowAuditRecord {
  id: string;
  project_id: string;
  orchestrator_session_id: string;
  runtime_agent_ids: string[];
  source_kind: string;
  source_name: string;
  source_id: string;
  action: string;
  summary: string;
  findings: string[];
  artifact_id: string;
  blocked_artifact_id: string;
  blocked_artifact_owner_kind: string;
  blocked_artifact_owner_id: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolution: Record<string, unknown>;
  artifact_ref: string;
  resolve_ref: string;
  blocked_artifact_ref: string;
  open: boolean;
}

export interface AutopilotExecutionShadowAuditDetail
  extends AutopilotExecutionShadowAuditRecord {
  audit_artifact?: AutopilotExecutionArtifactRecord | null;
  blocked_artifact?: AutopilotExecutionArtifactRecord | null;
}

export interface AutopilotExecutionRuntimeAgentTaskResumeContract {
  task_id: string;
  project_id: string;
  command: string;
  status: string;
  orchestrator_session_id: string;
  agent_action_run_id: string;
  approval_id: string;
  issue_id: string;
  runtime_agent_id: string;
  runtime_agent_ids: string[];
  output_artifact_id?: string;
  output_artifact_ref?: string;
  output_origin?: string;
  output_source_available?: boolean;
  output_generated_from_project_state?: boolean;
  settlement_source?: string;
  settlement_reason?: string;
  settlement_state_status?: string;
  settlement_state_timestamp?: string;
  transcript_artifact_id?: string;
  transcript_artifact_ref?: string;
  active: boolean;
  terminal: boolean;
  output_quarantined?: boolean;
  output_was_quarantined?: boolean;
  open_shadow_audit_count?: number;
  shadow_audit_id?: string;
}

export interface AutopilotExecutionRuntimeAgentTaskRecord {
  id: string;
  project_id: string;
  orchestrator_session_id: string;
  agent_action_run_id: string;
  approval_id: string;
  issue_id: string;
  command: string;
  actor: string;
  reason: string;
  title: string;
  status: string;
  runtime_agent_id: string;
  runtime_agent_ids: string[];
  placeholder_result: string;
  result_summary: string;
  result_payload: Record<string, unknown>;
  output_path: string;
  output_artifact_id: string;
  output_origin: string;
  output_source_available: boolean;
  settlement_source: string;
  settlement_reason: string;
  settlement_state_status: string;
  settlement_state_timestamp: string;
  output_preview: string;
  history: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  artifact_ref?: string;
  output_artifact_ref?: string;
  transcript_artifact_id?: string;
  transcript_artifact_ref?: string;
  output_available?: boolean;
  active?: boolean;
  terminal?: boolean;
  resume_contract?: AutopilotExecutionRuntimeAgentTaskResumeContract | null;
  shadow_audits?: AutopilotExecutionShadowAuditRecord[];
  open_shadow_audit_count?: number;
  output_quarantined?: boolean;
  output_was_quarantined?: boolean;
}

export interface AutopilotExecutionAgentActionRunRecord {
  id: string;
  run_kind: string;
  orchestrator_session_id: string;
  idempotency_key: string;
  request_fingerprint: string;
  actor: string;
  mode: string;
  reason: string;
  dry_run: boolean;
  policy_profile: string;
  policy: Record<string, unknown>;
  selection: Record<string, unknown>;
  summary: AutopilotExecutionAgentActionRunSummary;
  diff_summary?: Record<string, unknown>;
  patch_bundle?: Record<string, unknown>;
  preview_id?: string;
  artifact_ref?: string;
  approval_required?: boolean;
  apply_mode?: string;
  completion_state: string;
  completion_message: string;
  async_task_status_counts: AutopilotExecutionCountMap;
  async_task_count?: number;
  active_async_task_count?: number;
  async_tasks?: AutopilotExecutionRuntimeAgentTaskRecord[];
  resume_contracts?: AutopilotExecutionRuntimeAgentTaskResumeContract[];
  resume_contract?: AutopilotExecutionRuntimeAgentTaskResumeContract | null;
  shadow_audits?: AutopilotExecutionShadowAuditRecord[];
  open_shadow_audit_count?: number;
  handoff_state?: string;
  handoff_blocked?: boolean;
  results: Array<Record<string, unknown>>;
  status: string;
  project_ids: string[];
  initiative_ids: string[];
  orchestrators: string[];
  runtime_agent_ids: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export type AutopilotExecutionAgentActionRunSummaryRecord = Pick<
  AutopilotExecutionAgentActionRunRecord,
  | "id"
  | "run_kind"
  | "orchestrator_session_id"
  | "actor"
  | "mode"
  | "reason"
  | "dry_run"
  | "policy_profile"
  | "summary"
  | "approval_required"
  | "status"
  | "completion_state"
  | "completion_message"
  | "shadow_audits"
  | "open_shadow_audit_count"
  | "handoff_state"
  | "handoff_blocked"
  | "project_ids"
  | "orchestrators"
  | "runtime_agent_ids"
  | "created_at"
  | "updated_at"
  | "completed_at"
>;

export interface AutopilotExecutionAgentActionRunsSummary {
  totals: {
    runs: number;
    dry_runs: number;
    executions: number;
    single_action_runs: number;
    batch_runs: number;
    ok: number;
    partial: number;
    error: number;
    pending_async: number;
    quarantined: number;
  };
  by_status: AutopilotExecutionCountMap;
  by_completion_state: AutopilotExecutionCountMap;
  by_run_kind: AutopilotExecutionCountMap;
  by_actor: AutopilotExecutionCountMap;
  by_policy_profile: AutopilotExecutionCountMap;
  by_project: AutopilotExecutionCountMap;
  by_orchestrator: AutopilotExecutionCountMap;
  result_status_counts: AutopilotExecutionCountMap;
  latest_run_at?: string | null;
}

export interface AutopilotExecutionAgentActionRunCancelResponse {
  status: string;
  run: AutopilotExecutionAgentActionRunRecord;
  cancel_applied: boolean;
  cancelled_task_ids: string[];
  message: string;
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

export interface AutopilotExecutionEventRecord {
  event: string;
  project_id: string;
  project_name?: string | null;
  story_id?: number | null;
  status?: string | null;
  message?: string | null;
  timestamp?: string | null;
  task_source?: Record<string, unknown> | null;
  run_id?: string | null;
  run_started_at?: string | null;
  current_iteration?: number | null;
  active_worker?: string | null;
  active_critic?: string | null;
  runtime_agent_id?: string | null;
  runtime_agent_ids?: string[];
  worker_runtime_agent_id?: string | null;
  critic_runtime_agent_id?: string | null;
  specialist_runtime_agent_id?: string | null;
  runtime_agent_task_id?: string | null;
  agent_action_run_id?: string | null;
  orchestrator_session_id?: string | null;
  approval_id?: string | null;
  issue_id?: string | null;
  actor?: string | null;
  source?: string | null;
  handoff?: Record<string, unknown> | null;
  initiative?: Record<string, unknown> | null;
  orchestration?: Record<string, unknown> | null;
}

export interface AutopilotExecutionOrchestratorSessionDetail
  extends AutopilotExecutionOrchestratorSessionRecord {
  runs: AutopilotExecutionAgentActionRunRecord[];
  control_passes: AutopilotExecutionOrchestratorControlPassRecord[];
  approvals: AutopilotExecutionApprovalRecord[];
  issues: AutopilotExecutionIssueRecord[];
  tool_permission_runtimes?: AutopilotToolPermissionRuntimeRecord[];
  async_tasks?: AutopilotExecutionRuntimeAgentTaskRecord[];
  shadow_audits?: AutopilotExecutionShadowAuditRecord[];
  events: AutopilotExecutionEventRecord[];
  control: AutopilotExecutionOrchestratorSessionControl;
  summary: {
    run_count: number;
    control_pass_count: number;
    approval_count: number;
    pending_approval_count: number;
    issue_count: number;
    open_issue_count: number;
    tool_permission_runtime_count?: number;
    pending_tool_permission_runtime_count?: number;
    async_task_count?: number;
    active_async_task_count?: number;
    shadow_audit_count?: number;
    open_shadow_audit_count?: number;
    event_count: number;
    event_limit: number;
    latest_event_at?: string | null;
    by_event: AutopilotExecutionCountMap;
    by_event_status: AutopilotExecutionCountMap;
  };
}

export interface AutopilotExecutionOrchestratorSessionControlProfile {
  name: string;
  description: string;
  recommendation_kinds: string[];
  repeatable_kinds: string[];
  default: boolean;
}

export interface AutopilotExecutionOrchestratorSessionRecommendationApplyResult {
  status: string;
  session_id: string;
  recommendation: AutopilotExecutionOrchestratorSessionControlRecommendation;
  operation: Record<string, unknown>;
  result: Record<string, unknown>;
  control_before: AutopilotExecutionOrchestratorSessionControl;
  control: AutopilotExecutionOrchestratorSessionControl;
}

export interface AutopilotExecutionOrchestratorSessionControlPlanApplyResult {
  status: string;
  session_id: string;
  profile: {
    name: string;
    description: string;
    recommendation_kinds: string[];
    repeatable_kinds: string[];
    customized: boolean;
  };
  control_pass: AutopilotExecutionOrchestratorControlPassRecord;
  control_before: AutopilotExecutionOrchestratorSessionControl;
  control: AutopilotExecutionOrchestratorSessionControl;
  applied: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
  skipped_recommendation_kinds: string[];
}

export interface AutopilotExecutionRuntimeAgentHistorySummary {
  issue_count: number;
  open_issue_count: number;
  approval_count: number;
  pending_approval_count: number;
  tool_permission_runtime_count: number;
  pending_tool_permission_runtime_count: number;
  async_task_count: number;
  active_async_task_count: number;
  pending_async_run_count: number;
  event_count: number;
  last_event_at?: string | null;
}

export interface AutopilotExecutionRuntimeAgentProjectSnapshot {
  project_id: string;
  name: string;
  path: string;
  status: string;
  paused: boolean;
  current_story_id?: number | null;
  current_iteration?: number | null;
}

export interface AutopilotExecutionRuntimeAgentStorySnapshot {
  id?: number | null;
  title?: string | null;
  status?: string | null;
  phase_id?: string | null;
  phase_title?: string | null;
  iteration?: number | null;
  discoveries?: Array<Record<string, unknown>>;
  github_pr?: Record<string, unknown> | null;
}

export interface AutopilotExecutionRuntimeAgentDetail {
  runtime_agent_id: string;
  project_id: string;
  project_name: string;
  initiative: Record<string, unknown>;
  orchestration: Record<string, unknown>;
  role: string;
  status: string;
  budget: AutopilotExecutionRuntimeAgentBudgetSummary;
  attention: AutopilotExecutionRuntimeAgentAttentionSummary;
  recommendations: Array<Record<string, unknown>>;
  suggested_commands: Array<Record<string, unknown>>;
  story_id?: number | null;
  story_title?: string | null;
  project: AutopilotExecutionRuntimeAgentProjectSnapshot;
  story: AutopilotExecutionRuntimeAgentStorySnapshot;
  current?: AutopilotExecutionRuntimeAgentRecord | null;
  history: AutopilotExecutionRuntimeAgentHistorySummary;
  issues: AutopilotExecutionIssueRecord[];
  approvals: AutopilotExecutionApprovalRecord[];
  tool_permission_runtimes: AutopilotToolPermissionRuntimeRecord[];
  async_tasks: AutopilotExecutionRuntimeAgentTaskRecord[];
  events: AutopilotExecutionEventRecord[];
}

export interface AutopilotExecutionRuntimeAgentTaskCancelResponse {
  status: string;
  task: AutopilotExecutionRuntimeAgentTaskRecord;
  cancel_applied: boolean;
  message: string;
}

export interface AutopilotExecutionRuntimeAgentTaskOutputArtifact
  extends AutopilotExecutionArtifactRecord {
  task_id: string;
  status?: string;
  message?: string;
  content_blocked?: boolean;
  quarantined?: boolean;
  shadow_audits?: AutopilotExecutionShadowAuditRecord[];
}

export interface AutopilotExecutionRuntimeAgentTaskOutputLiveArtifact
  extends Partial<AutopilotExecutionArtifactRecord> {
  task_id: string;
  artifact_ref: string;
  status: string;
  task_status?: string;
  content: string;
  message?: string;
  content_blocked?: boolean;
  quarantined?: boolean;
  content_live?: boolean;
  content_source?: string;
  content_offset: number;
  content_next_offset: number;
  content_total_bytes: number;
  content_window_truncated: boolean;
  source_path?: string;
  tail_lines?: number | null;
  shadow_audits?: AutopilotExecutionShadowAuditRecord[];
}

export interface AutopilotExecutionRuntimeAgentTaskTranscriptArtifact {
  id: string;
  owner_kind: string;
  owner_id: string;
  content_path: string;
  preview: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  task_id: string;
  artifact_ref: string;
  content: string;
}

export interface AutopilotExecutionProjectRuntimeLog {
  project_id: string;
  status: string;
  project_status: string;
  paused: boolean;
  log_path: string;
  content: string;
  content_offset: number;
  content_next_offset: number;
  content_total_bytes: number;
  content_window_truncated: boolean;
  tail_lines?: number | null;
}

export interface AutopilotExecutionAgentActionExecuteResult {
  status: string;
  message?: string;
  action?: Record<string, unknown>;
  command_result?: Record<string, unknown>;
  approval?: AutopilotExecutionApprovalRecord;
  issue?: AutopilotExecutionIssueRecord;
  project?: Record<string, unknown>;
  diff_summary?: Record<string, unknown>;
  patch_bundle?: Record<string, unknown>;
  preview_id?: string;
  artifact_ref?: string;
  approval_required?: boolean;
  apply_mode?: string;
  completion_state?: string;
  completion_message?: string;
  async_task_count?: number;
  active_async_task_count?: number;
  async_tasks?: AutopilotExecutionRuntimeAgentTaskRecord[];
  resume_contracts?: AutopilotExecutionRuntimeAgentTaskResumeContract[];
  resume_contract?: AutopilotExecutionRuntimeAgentTaskResumeContract | null;
  async_task?: AutopilotExecutionRuntimeAgentTaskRecord;
  run?: AutopilotExecutionAgentActionRunRecord;
  idempotent_replay?: boolean;
}

export interface AutopilotExecutionAgentActionBatchResult {
  status: string;
  selection: Record<string, unknown>;
  policy: Record<string, unknown>;
  summary: AutopilotExecutionAgentActionRunSummary;
  diff_summary?: Record<string, unknown>;
  patch_bundle?: Record<string, unknown>;
  preview_id?: string;
  artifact_ref?: string;
  approval_required?: boolean;
  apply_mode?: string;
  completion_state?: string;
  completion_message?: string;
  async_task_count?: number;
  active_async_task_count?: number;
  async_tasks?: AutopilotExecutionRuntimeAgentTaskRecord[];
  resume_contracts?: AutopilotExecutionRuntimeAgentTaskResumeContract[];
  resume_contract?: AutopilotExecutionRuntimeAgentTaskResumeContract | null;
  dry_run: boolean;
  results: Array<Record<string, unknown>>;
  run: AutopilotExecutionAgentActionRunRecord;
  idempotent_replay?: boolean;
  session_id?: string;
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

export async function fetchAutopilotExecutionRuntimeAgents(filters?: {
  includeArchived?: boolean;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  status?: string;
  role?: string;
  attentionState?: string;
  recommendationKind?: string;
  suggestedCommand?: string;
  actionableOnly?: boolean;
  commandRequiresApproval?: boolean;
}): Promise<AutopilotExecutionRuntimeAgentRecord[]> {
  const payload = await requestJson<{
    agents: AutopilotExecutionRuntimeAgentRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/agents${buildQuery({
      include_archived: filters?.includeArchived ?? false,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      status: filters?.status,
      role: filters?.role,
      attention_state: filters?.attentionState,
      recommendation_kind: filters?.recommendationKind,
      suggested_command: filters?.suggestedCommand,
      actionable_only: filters?.actionableOnly ?? false,
      command_requires_approval: filters?.commandRequiresApproval,
    })}`
  );
  return payload.agents;
}

export async function fetchAutopilotExecutionRuntimeAgentsSummary(filters?: {
  includeArchived?: boolean;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  status?: string;
  role?: string;
  attentionState?: string;
  recommendationKind?: string;
  suggestedCommand?: string;
  actionableOnly?: boolean;
  commandRequiresApproval?: boolean;
}): Promise<AutopilotExecutionAgentsSummary> {
  return requestJson<AutopilotExecutionAgentsSummary>(
    `/api/shell/execution/actions/execution-plane/agents/summary${buildQuery({
      include_archived: filters?.includeArchived ?? false,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      status: filters?.status,
      role: filters?.role,
      attention_state: filters?.attentionState,
      recommendation_kind: filters?.recommendationKind,
      suggested_command: filters?.suggestedCommand,
      actionable_only: filters?.actionableOnly ?? false,
      command_requires_approval: filters?.commandRequiresApproval,
    })}`
  );
}

export async function fetchAutopilotExecutionAgentActionRuns(filters?: {
  summary?: false;
  runKind?: string;
  orchestratorSessionId?: string;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  dryRun?: boolean;
  status?: string;
  idempotencyKey?: string;
}): Promise<AutopilotExecutionAgentActionRunRecord[]>;
export async function fetchAutopilotExecutionAgentActionRuns(filters: {
  summary: true;
  runKind?: string;
  orchestratorSessionId?: string;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  dryRun?: boolean;
  status?: string;
  idempotencyKey?: string;
}): Promise<AutopilotExecutionAgentActionRunSummaryRecord[]>;
export async function fetchAutopilotExecutionAgentActionRuns(filters?: {
  summary?: boolean;
  runKind?: string;
  orchestratorSessionId?: string;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  dryRun?: boolean;
  status?: string;
  idempotencyKey?: string;
}): Promise<
  | AutopilotExecutionAgentActionRunRecord[]
  | AutopilotExecutionAgentActionRunSummaryRecord[]
> {
  const payload = await requestJson<{
    runs:
      | AutopilotExecutionAgentActionRunRecord[]
      | AutopilotExecutionAgentActionRunSummaryRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/agents/action-runs${buildQuery({
      summary: filters?.summary ? true : undefined,
      run_kind: filters?.runKind,
      orchestrator_session_id: filters?.orchestratorSessionId,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      actor: filters?.actor,
      dry_run: filters?.dryRun,
      status: filters?.status,
      idempotency_key: filters?.idempotencyKey,
    })}`
  );
  return payload.runs;
}

export async function fetchAutopilotExecutionAgentActionRunsSummary(filters?: {
  runKind?: string;
  orchestratorSessionId?: string;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  dryRun?: boolean;
  status?: string;
  idempotencyKey?: string;
}): Promise<AutopilotExecutionAgentActionRunsSummary> {
  return requestJson<AutopilotExecutionAgentActionRunsSummary>(
    `/api/shell/execution/actions/execution-plane/agents/action-runs/summary${buildQuery({
      run_kind: filters?.runKind,
      orchestrator_session_id: filters?.orchestratorSessionId,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      actor: filters?.actor,
      dry_run: filters?.dryRun,
      status: filters?.status,
      idempotency_key: filters?.idempotencyKey,
    })}`
  );
}

export async function fetchAutopilotExecutionProject(
  projectId: string
): Promise<AutopilotExecutionProjectDetail> {
  return requestJson<AutopilotExecutionProjectDetail>(
    `/api/shell/execution/actions/execution-plane/projects/${encodePathSegment(projectId)}`
  );
}

export async function createAutopilotExecutionOrchestratorSession(payload?: {
  orchestrator?: string;
  actor?: string;
  title?: string;
  initiativeId?: string;
  projectIds?: string[];
  reason?: string;
  context?: Record<string, unknown>;
}): Promise<{
  status: string;
  session: AutopilotExecutionOrchestratorSessionRecord;
}> {
  return requestJson<{
    status: string;
    session: AutopilotExecutionOrchestratorSessionRecord;
  }>(`/api/shell/execution/actions/execution-plane/orchestrator-sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orchestrator: payload?.orchestrator ?? "founderos",
      actor: payload?.actor ?? "founderos-shell",
      title: payload?.title ?? "",
      initiative_id: payload?.initiativeId ?? "",
      project_ids: payload?.projectIds ?? [],
      reason: payload?.reason ?? "",
      context: payload?.context ?? {},
    }),
  });
}

export async function fetchAutopilotExecutionOrchestratorSessions(filters?: {
  sessionId?: string;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  status?: string;
}): Promise<AutopilotExecutionOrchestratorSessionRecord[]> {
  const payload = await requestJson<{
    sessions: AutopilotExecutionOrchestratorSessionRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions${buildQuery({
      session_id: filters?.sessionId,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      actor: filters?.actor,
      status: filters?.status,
    })}`
  );
  return payload.sessions;
}

export async function fetchAutopilotExecutionOrchestratorSessionSummary(filters?: {
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  status?: string;
}): Promise<AutopilotExecutionOrchestratorSessionSummary> {
  return requestJson<AutopilotExecutionOrchestratorSessionSummary>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/summary${buildQuery({
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      actor: filters?.actor,
      status: filters?.status,
    })}`
  );
}

export async function fetchAutopilotExecutionOrchestratorSession(
  sessionId: string,
  options?: {
    eventLimit?: number;
  }
): Promise<AutopilotExecutionOrchestratorSessionDetail> {
  return requestJson<AutopilotExecutionOrchestratorSessionDetail>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}${buildQuery(
      {
        event_limit: options?.eventLimit ?? 25,
      }
    )}`
  );
}

export async function fetchAutopilotExecutionAgentActions(filters?: {
  includeArchived?: boolean;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  status?: string;
  role?: string;
  attentionState?: string;
  recommendationKind?: string;
  suggestedCommand?: string;
  actionableOnly?: boolean;
  commandRequiresApproval?: boolean;
  priority?: string;
}): Promise<AutopilotExecutionAgentActionRecord[]> {
  const payload = await requestJson<{
    actions: AutopilotExecutionAgentActionRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/agents/actions${buildQuery({
      include_archived: filters?.includeArchived ?? false,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      status: filters?.status,
      role: filters?.role,
      attention_state: filters?.attentionState,
      recommendation_kind: filters?.recommendationKind,
      suggested_command: filters?.suggestedCommand,
      actionable_only: filters?.actionableOnly ?? true,
      command_requires_approval: filters?.commandRequiresApproval,
      priority: filters?.priority,
    })}`
  );
  return payload.actions;
}

export async function fetchAutopilotExecutionAgentAction(
  actionKey: string
): Promise<AutopilotExecutionAgentActionRecord> {
  return requestJson<AutopilotExecutionAgentActionRecord>(
    `/api/shell/execution/actions/execution-plane/agents/actions/${encodePathSegment(actionKey)}`
  );
}

export async function fetchAutopilotExecutionAgentActionPolicyProfiles(): Promise<
  Record<string, AutopilotExecutionAgentActionPolicyProfile>
> {
  const payload = await requestJson<{
    profiles: Record<string, AutopilotExecutionAgentActionPolicyProfile>;
  }>(
    `/api/shell/execution/actions/execution-plane/agents/actions/policy-profiles`
  );
  return payload.profiles;
}

export async function fetchAutopilotExecutionOrchestratorSessionEvents(
  sessionId: string,
  options?: { limit?: number }
): Promise<AutopilotExecutionEventRecord[]> {
  const payload = await requestJson<{
    session_id: string;
    events: AutopilotExecutionEventRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/events${buildQuery(
      {
        limit: options?.limit,
      }
    )}`
  );
  return payload.events;
}

export async function fetchAutopilotExecutionOrchestratorSessionActions(
  sessionId: string,
  filters?: {
    includeArchived?: boolean;
    status?: string;
    role?: string;
    attentionState?: string;
    recommendationKind?: string;
    suggestedCommand?: string;
    actionableOnly?: boolean;
    commandRequiresApproval?: boolean;
    priority?: string;
  }
): Promise<Array<Record<string, unknown>>> {
  const payload = await requestJson<{
    session_id: string;
    actions: Array<Record<string, unknown>>;
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/actions${buildQuery(
      {
        include_archived: filters?.includeArchived ?? false,
        status: filters?.status,
        role: filters?.role,
        attention_state: filters?.attentionState,
        recommendation_kind: filters?.recommendationKind,
        suggested_command: filters?.suggestedCommand,
        actionable_only: filters?.actionableOnly ?? true,
        command_requires_approval: filters?.commandRequiresApproval,
        priority: filters?.priority,
      }
    )}`
  );
  return payload.actions;
}

export async function fetchAutopilotExecutionOrchestratorSessionActionSummary(
  sessionId: string,
  filters?: {
    includeArchived?: boolean;
    status?: string;
    role?: string;
    attentionState?: string;
    recommendationKind?: string;
    suggestedCommand?: string;
    actionableOnly?: boolean;
    commandRequiresApproval?: boolean;
    priority?: string;
  }
): Promise<AutopilotExecutionOrchestratorSessionActionSummary> {
  const payload = await requestJson<
    { session_id: string } & AutopilotExecutionOrchestratorSessionActionSummary
  >(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/actions/summary${buildQuery(
      {
        include_archived: filters?.includeArchived ?? false,
        status: filters?.status,
        role: filters?.role,
        attention_state: filters?.attentionState,
        recommendation_kind: filters?.recommendationKind,
        suggested_command: filters?.suggestedCommand,
        actionable_only: filters?.actionableOnly ?? true,
        command_requires_approval: filters?.commandRequiresApproval,
        priority: filters?.priority,
      }
    )}`
  );
  const summary = { ...payload };
  delete (summary as { session_id?: string }).session_id;
  return summary;
}

export async function executeAutopilotExecutionOrchestratorSessionActions(
  sessionId: string,
  payload?: {
    actionKeys?: string[];
    previewId?: string;
    idempotencyKey?: string;
    actor?: string;
    mode?: string;
    reason?: string;
    policyProfile?: string | null;
    policy?: AutopilotExecutionAgentActionBatchPolicyRequest | null;
    includeArchived?: boolean;
    status?: string | null;
    role?: string | null;
    attentionState?: string | null;
    recommendationKind?: string | null;
    suggestedCommand?: string | null;
    actionableOnly?: boolean;
    commandRequiresApproval?: boolean | null;
    priority?: string | null;
    limit?: number;
    continueOnError?: boolean;
    includeNonExecutable?: boolean;
  }
): Promise<AutopilotExecutionAgentActionBatchResult> {
  return requestJson<AutopilotExecutionAgentActionBatchResult>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/actions/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action_keys: payload?.actionKeys ?? [],
        preview_id: payload?.previewId ?? "",
        idempotency_key: payload?.idempotencyKey ?? "",
        actor: payload?.actor ?? "founderos-shell",
        mode: payload?.mode ?? "auto",
        reason: payload?.reason ?? "",
        policy_profile: payload?.policyProfile ?? null,
        policy: payload?.policy ?? null,
        include_archived: payload?.includeArchived ?? false,
        status: payload?.status ?? null,
        role: payload?.role ?? null,
        attention_state: payload?.attentionState ?? null,
        recommendation_kind: payload?.recommendationKind ?? null,
        suggested_command: payload?.suggestedCommand ?? null,
        actionable_only: payload?.actionableOnly ?? true,
        command_requires_approval: payload?.commandRequiresApproval ?? null,
        priority: payload?.priority ?? null,
        limit: payload?.limit ?? 20,
        continue_on_error: payload?.continueOnError ?? true,
        include_non_executable: payload?.includeNonExecutable ?? false,
      }),
    }
  );
}

export async function previewAutopilotExecutionOrchestratorSessionActions(
  sessionId: string,
  payload?: {
    actionKeys?: string[];
    previewId?: string;
    idempotencyKey?: string;
    actor?: string;
    mode?: string;
    reason?: string;
    policyProfile?: string | null;
    policy?: AutopilotExecutionAgentActionBatchPolicyRequest | null;
    includeArchived?: boolean;
    status?: string | null;
    role?: string | null;
    attentionState?: string | null;
    recommendationKind?: string | null;
    suggestedCommand?: string | null;
    actionableOnly?: boolean;
    commandRequiresApproval?: boolean | null;
    priority?: string | null;
    limit?: number;
    continueOnError?: boolean;
    includeNonExecutable?: boolean;
  }
): Promise<AutopilotExecutionAgentActionBatchResult> {
  return requestJson<AutopilotExecutionAgentActionBatchResult>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/actions/preview`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action_keys: payload?.actionKeys ?? [],
        preview_id: payload?.previewId ?? "",
        idempotency_key: payload?.idempotencyKey ?? "",
        actor: payload?.actor ?? "founderos-shell",
        mode: payload?.mode ?? "auto",
        reason: payload?.reason ?? "",
        policy_profile: payload?.policyProfile ?? null,
        policy: payload?.policy ?? null,
        include_archived: payload?.includeArchived ?? false,
        status: payload?.status ?? null,
        role: payload?.role ?? null,
        attention_state: payload?.attentionState ?? null,
        recommendation_kind: payload?.recommendationKind ?? null,
        suggested_command: payload?.suggestedCommand ?? null,
        actionable_only: payload?.actionableOnly ?? true,
        command_requires_approval: payload?.commandRequiresApproval ?? null,
        priority: payload?.priority ?? null,
        limit: payload?.limit ?? 20,
        continue_on_error: payload?.continueOnError ?? true,
        include_non_executable: payload?.includeNonExecutable ?? false,
      }),
    }
  );
}

export async function fetchAutopilotExecutionOrchestratorSessionControl(
  sessionId: string
): Promise<AutopilotExecutionOrchestratorSessionControl> {
  const payload = await requestJson<{
    session_id: string;
    control: AutopilotExecutionOrchestratorSessionControl;
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/control`
  );
  return payload.control;
}

export async function fetchAutopilotExecutionControlPasses(filters?: {
  orchestratorSessionId?: string;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  profile?: string;
  status?: string;
}): Promise<AutopilotExecutionOrchestratorControlPassRecord[]> {
  const payload = await requestJson<{
    control_passes: AutopilotExecutionOrchestratorControlPassRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/control/passes${buildQuery({
      orchestrator_session_id: filters?.orchestratorSessionId,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      actor: filters?.actor,
      profile: filters?.profile,
      status: filters?.status,
    })}`
  );
  return payload.control_passes;
}

export async function fetchAutopilotExecutionControlPassSummary(filters?: {
  orchestratorSessionId?: string;
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  actor?: string;
  profile?: string;
  status?: string;
}): Promise<AutopilotExecutionOrchestratorControlPassSummary> {
  return requestJson<AutopilotExecutionOrchestratorControlPassSummary>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/control/passes/summary${buildQuery({
      orchestrator_session_id: filters?.orchestratorSessionId,
      project_id: filters?.projectId,
      initiative_id: filters?.initiativeId,
      orchestrator: filters?.orchestrator,
      actor: filters?.actor,
      profile: filters?.profile,
      status: filters?.status,
    })}`
  );
}

export async function fetchAutopilotExecutionControlPass(
  controlPassId: string
): Promise<AutopilotExecutionOrchestratorControlPassRecord> {
  return requestJson<AutopilotExecutionOrchestratorControlPassRecord>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/control/passes/${encodePathSegment(
      controlPassId
    )}`
  );
}

export async function fetchAutopilotExecutionOrchestratorSessionControlPasses(
  sessionId: string,
  filters?: {
    profile?: string;
    status?: string;
  }
): Promise<AutopilotExecutionOrchestratorControlPassRecord[]> {
  const payload = await requestJson<{
    session_id: string;
    control_passes: AutopilotExecutionOrchestratorControlPassRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/control/passes${buildQuery(
      {
        profile: filters?.profile,
        status: filters?.status,
      }
    )}`
  );
  return payload.control_passes;
}

export async function fetchAutopilotExecutionOrchestratorSessionControlPassSummary(
  sessionId: string,
  filters?: {
    profile?: string;
    status?: string;
  }
): Promise<AutopilotExecutionOrchestratorControlPassSummary> {
  const payload = await requestJson<
    { session_id: string } & AutopilotExecutionOrchestratorControlPassSummary
  >(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/control/passes/summary${buildQuery(
      {
        profile: filters?.profile,
        status: filters?.status,
      }
    )}`
  );
  const summary = { ...payload };
  delete (summary as { session_id?: string }).session_id;
  return summary;
}

export async function fetchAutopilotExecutionOrchestratorSessionControlProfiles(): Promise<
  AutopilotExecutionOrchestratorSessionControlProfile[]
> {
  const payload = await requestJson<{
    profiles: AutopilotExecutionOrchestratorSessionControlProfile[];
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/control/profiles`
  );
  return payload.profiles;
}

export async function applyAutopilotExecutionOrchestratorSessionRecommendation(
  sessionId: string,
  payload: {
    recommendationKind: string;
    actor?: string;
    reason?: string;
    idempotencyKey?: string;
  }
): Promise<AutopilotExecutionOrchestratorSessionRecommendationApplyResult> {
  return requestJson<AutopilotExecutionOrchestratorSessionRecommendationApplyResult>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/control/apply`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recommendation_kind: payload.recommendationKind,
        actor: payload.actor ?? "founderos-shell",
        reason: payload.reason ?? "",
        idempotency_key: payload.idempotencyKey ?? "",
      }),
    }
  );
}

export async function applyAutopilotExecutionOrchestratorSessionControlPlan(
  sessionId: string,
  payload?: {
    profile?: string;
    recommendationKinds?: string[];
    actor?: string;
    reason?: string;
    maxOperations?: number;
    continueOnError?: boolean;
  }
): Promise<AutopilotExecutionOrchestratorSessionControlPlanApplyResult> {
  return requestJson<AutopilotExecutionOrchestratorSessionControlPlanApplyResult>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/control/apply-plan`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile: payload?.profile ?? "safe_progress",
        recommendation_kinds: payload?.recommendationKinds ?? [],
        actor: payload?.actor ?? "founderos-shell",
        reason: payload?.reason ?? "",
        max_operations: payload?.maxOperations ?? 10,
        continue_on_error: payload?.continueOnError ?? true,
      }),
    }
  );
}

export async function updateAutopilotExecutionOrchestratorSessionStatus(
  sessionId: string,
  payload?: {
    status?: string;
    actor?: string;
    note?: string;
  }
): Promise<{
  status: string;
  session: AutopilotExecutionOrchestratorSessionRecord;
}> {
  return requestJson<{
    status: string;
    session: AutopilotExecutionOrchestratorSessionRecord;
  }>(
    `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(sessionId)}/status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: payload?.status ?? "completed",
        actor: payload?.actor ?? "founderos-shell",
        note: payload?.note ?? "",
      }),
    }
  );
}

export async function fetchAutopilotExecutionAgentActionRun(
  runId: string,
  options?: {
    waitForAsyncSettlement?: boolean;
    runtimeAgentId?: string | null;
    waitTimeoutMs?: number;
  }
): Promise<AutopilotExecutionAgentActionRunRecord> {
  return requestJson<AutopilotExecutionAgentActionRunRecord>(
    `/api/shell/execution/actions/execution-plane/agents/action-runs/${encodePathSegment(runId)}${buildQuery(
      {
        wait_for_async_settlement: options?.waitForAsyncSettlement ?? false,
        runtime_agent_id: options?.runtimeAgentId ?? null,
        wait_timeout_ms: options?.waitTimeoutMs ?? null,
      }
    )}`
  );
}

export async function cancelAutopilotExecutionAgentActionRunAsync(
  runId: string,
  payload?: {
    actor?: string;
    note?: string;
  }
): Promise<AutopilotExecutionAgentActionRunCancelResponse> {
  return requestJson<AutopilotExecutionAgentActionRunCancelResponse>(
    `/api/shell/execution/actions/execution-plane/agents/action-runs/${encodePathSegment(runId)}/cancel-async`,
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

export async function fetchAutopilotExecutionRuntimeAgentTasks(filters?: {
  taskId?: string;
  projectId?: string;
  orchestratorSessionId?: string;
  runtimeAgentId?: string;
  status?: string;
  command?: string;
  agentActionRunId?: string;
}): Promise<AutopilotExecutionRuntimeAgentTaskRecord[]> {
  const payload = await requestJson<{
    tasks: AutopilotExecutionRuntimeAgentTaskRecord[];
  }>(
    `/api/shell/execution/actions/execution-plane/agents/tasks${buildQuery({
      task_id: filters?.taskId,
      project_id: filters?.projectId,
      orchestrator_session_id: filters?.orchestratorSessionId,
      runtime_agent_id: filters?.runtimeAgentId,
      status: filters?.status,
      command: filters?.command,
      agent_action_run_id: filters?.agentActionRunId,
    })}`
  );
  return payload.tasks;
}

export async function fetchAutopilotExecutionRuntimeAgentTask(
  taskId: string
): Promise<AutopilotExecutionRuntimeAgentTaskRecord> {
  return requestJson<AutopilotExecutionRuntimeAgentTaskRecord>(
    `/api/shell/execution/actions/execution-plane/agents/tasks/${encodePathSegment(taskId)}`
  );
}

export async function cancelAutopilotExecutionRuntimeAgentTask(
  taskId: string,
  payload?: {
    actor?: string;
    note?: string;
  }
): Promise<AutopilotExecutionRuntimeAgentTaskCancelResponse> {
  return requestJson<AutopilotExecutionRuntimeAgentTaskCancelResponse>(
    `/api/shell/execution/actions/execution-plane/agents/tasks/${encodePathSegment(taskId)}/cancel`,
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildAutopilotExecutionPreviewApplyPayload(
  run: AutopilotExecutionAgentActionRunRecord,
  payload?: { actor?: string; reason?: string }
) {
  const selectedActionKeys = stringArray(run.selection?.selected_action_keys);
  const previewId = run.preview_id || run.id;
  return {
    action_keys: selectedActionKeys,
    preview_id: previewId,
    orchestrator_session_id: run.orchestrator_session_id || "",
    actor: payload?.actor ?? "founderos-shell",
    mode: run.mode || "auto",
    reason:
      payload?.reason ??
      (run.approval_required
        ? `Shell requested approval from preview ${previewId}`
        : `Shell applied preview ${previewId}`),
    policy_profile: run.policy_profile || null,
    include_non_executable: Boolean(run.selection?.include_non_executable),
    limit: Math.max(
      selectedActionKeys.length,
      numberValue(run.selection?.limit, selectedActionKeys.length || 20)
    ),
    continue_on_error: true,
  };
}

export async function executeAutopilotExecutionAgentAction(payload: {
  actionKey: string;
  orchestratorSessionId?: string;
  actor?: string;
  mode?: string;
  reason?: string;
  idempotencyKey?: string;
}): Promise<AutopilotExecutionAgentActionExecuteResult> {
  return requestJson<AutopilotExecutionAgentActionExecuteResult>(
    `/api/shell/execution/actions/execution-plane/agents/actions/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action_key: payload.actionKey,
        orchestrator_session_id: payload.orchestratorSessionId ?? "",
        actor: payload.actor ?? "founderos-shell",
        mode: payload.mode ?? "auto",
        reason: payload.reason ?? "",
        idempotency_key: payload.idempotencyKey ?? "",
      }),
    }
  );
}

export async function executeAutopilotExecutionAgentActionBatch(payload: {
  actionKeys?: string[];
  previewId?: string;
  orchestratorSessionId?: string;
  idempotencyKey?: string;
  actor?: string;
  mode?: string;
  reason?: string;
  policyProfile?: string | null;
  policy?: AutopilotExecutionAgentActionBatchPolicyRequest | null;
  includeNonExecutable?: boolean;
  limit?: number;
  continueOnError?: boolean;
}): Promise<AutopilotExecutionAgentActionBatchResult> {
  return requestJson<AutopilotExecutionAgentActionBatchResult>(
    `/api/shell/execution/actions/execution-plane/agents/actions/execute-batch`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action_keys: payload.actionKeys ?? [],
        preview_id: payload.previewId ?? "",
        orchestrator_session_id: payload.orchestratorSessionId ?? "",
        idempotency_key: payload.idempotencyKey ?? "",
        actor: payload.actor ?? "founderos-shell",
        mode: payload.mode ?? "auto",
        reason: payload.reason ?? "",
        policy_profile: payload.policyProfile ?? null,
        policy: payload.policy ?? null,
        include_non_executable: payload.includeNonExecutable ?? false,
        limit: payload.limit ?? 20,
        continue_on_error: payload.continueOnError ?? true,
      }),
    }
  );
}

export async function previewAutopilotExecutionAgentActionBatch(payload: {
  actionKeys?: string[];
  previewId?: string;
  orchestratorSessionId?: string;
  idempotencyKey?: string;
  actor?: string;
  mode?: string;
  reason?: string;
  policyProfile?: string | null;
  policy?: AutopilotExecutionAgentActionBatchPolicyRequest | null;
  includeNonExecutable?: boolean;
  limit?: number;
  continueOnError?: boolean;
}): Promise<AutopilotExecutionAgentActionBatchResult> {
  return requestJson<AutopilotExecutionAgentActionBatchResult>(
    `/api/shell/execution/actions/execution-plane/agents/actions/preview-batch`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action_keys: payload.actionKeys ?? [],
        preview_id: payload.previewId ?? "",
        orchestrator_session_id: payload.orchestratorSessionId ?? "",
        idempotency_key: payload.idempotencyKey ?? "",
        actor: payload.actor ?? "founderos-shell",
        mode: payload.mode ?? "auto",
        reason: payload.reason ?? "",
        policy_profile: payload.policyProfile ?? null,
        policy: payload.policy ?? null,
        include_non_executable: payload.includeNonExecutable ?? false,
        limit: payload.limit ?? 20,
        continue_on_error: payload.continueOnError ?? true,
      }),
    }
  );
}

export async function applyAutopilotExecutionPreviewRun(
  run: AutopilotExecutionAgentActionRunRecord,
  payload?: {
    actor?: string;
    reason?: string;
  }
): Promise<AutopilotExecutionAgentActionBatchResult> {
  const request = buildAutopilotExecutionPreviewApplyPayload(run, payload);
  if (run.orchestrator_session_id) {
    return executeAutopilotExecutionOrchestratorSessionActions(
      run.orchestrator_session_id,
      {
        actionKeys: request.action_keys,
        previewId: request.preview_id,
        actor: request.actor,
        mode: request.mode,
        reason: request.reason,
        policyProfile: request.policy_profile,
        includeNonExecutable: request.include_non_executable,
        limit: request.limit,
        continueOnError: request.continue_on_error,
      }
    );
  }

  return executeAutopilotExecutionAgentActionBatch({
    actionKeys: request.action_keys,
    previewId: request.preview_id,
    orchestratorSessionId: request.orchestrator_session_id,
    actor: request.actor,
    mode: request.mode,
    reason: request.reason,
    policyProfile: request.policy_profile,
    includeNonExecutable: request.include_non_executable,
    limit: request.limit,
    continueOnError: request.continue_on_error,
  });
}

export async function fetchAutopilotExecutionProjectCommandPolicy(
  projectId: string
): Promise<AutopilotExecutionProjectCommandPolicy> {
  const payload = await requestJson<{
    project_id: string;
    command_policy: AutopilotExecutionProjectCommandPolicy;
  }>(
    `/api/shell/execution/actions/execution-plane/projects/${encodePathSegment(projectId)}/command-policy`
  );
  return payload.command_policy;
}

export async function updateAutopilotExecutionProjectCommandPolicy(
  projectId: string,
  payload?: {
    approvalRequiredCommands?: string[] | null;
    parallelLaunchRequiresApproval?: boolean | null;
    maxParallelStoriesWithoutApproval?: number | null;
    disableAutoPauseRequiresApproval?: boolean | null;
    githubApprovedAndGreenAutoResume?: boolean | null;
    projectMaxWorkerIterationsWithoutApproval?: number | null;
    projectMaxCriticReviewsWithoutApproval?: number | null;
    agentMaxWorkerIterationsWithoutApproval?: number | null;
    agentMaxCriticReviewsWithoutApproval?: number | null;
  }
): Promise<{
  status: string;
  project_id: string;
  command_policy: AutopilotExecutionProjectCommandPolicy;
}> {
  return requestJson<{
    status: string;
    project_id: string;
    command_policy: AutopilotExecutionProjectCommandPolicy;
  }>(
    `/api/shell/execution/actions/execution-plane/projects/${encodePathSegment(projectId)}/command-policy`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        approval_required_commands: payload?.approvalRequiredCommands ?? null,
        parallel_launch_requires_approval:
          payload?.parallelLaunchRequiresApproval ?? null,
        max_parallel_stories_without_approval:
          payload?.maxParallelStoriesWithoutApproval ?? null,
        disable_auto_pause_requires_approval:
          payload?.disableAutoPauseRequiresApproval ?? null,
        github_approved_and_green_auto_resume:
          payload?.githubApprovedAndGreenAutoResume ?? null,
        project_max_worker_iterations_without_approval:
          payload?.projectMaxWorkerIterationsWithoutApproval ?? null,
        project_max_critic_reviews_without_approval:
          payload?.projectMaxCriticReviewsWithoutApproval ?? null,
        agent_max_worker_iterations_without_approval:
          payload?.agentMaxWorkerIterationsWithoutApproval ?? null,
        agent_max_critic_reviews_without_approval:
          payload?.agentMaxCriticReviewsWithoutApproval ?? null,
      }),
    }
  );
}

export async function executeAutopilotExecutionProjectCommand(
  projectId: string,
  commandName: string,
  payload?: {
    requireApproval?: boolean;
    requestedBy?: string;
    reason?: string;
    launchProfile?: Record<string, unknown> | null;
    budgetPolicy?: Record<string, unknown> | null;
  }
): Promise<AutopilotExecutionProjectCommandResult> {
  return requestJson<AutopilotExecutionProjectCommandResult>(
    `/api/shell/execution/actions/execution-plane/projects/${encodePathSegment(projectId)}/commands/${encodePathSegment(commandName)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        require_approval: payload?.requireApproval ?? false,
        requested_by: payload?.requestedBy ?? "founderos-shell",
        reason: payload?.reason ?? "",
        launch_profile: payload?.launchProfile ?? null,
        budget_policy: payload?.budgetPolicy ?? null,
      }),
    }
  );
}

export async function fetchAutopilotExecutionEvents(filters?: {
  projectId?: string;
  initiativeId?: string;
  orchestrator?: string;
  runtimeAgentId?: string;
  orchestratorSessionId?: string;
  limit?: number;
}): Promise<AutopilotExecutionEventRecord[]> {
  const path = filters?.orchestratorSessionId
    ? `/api/shell/execution/actions/execution-plane/orchestrator-sessions/${encodePathSegment(
        filters.orchestratorSessionId
      )}/events${buildQuery({
        limit: filters.limit,
      })}`
    : `/api/shell/execution/actions/execution-plane/events${buildQuery({
        project_id: filters?.projectId,
        initiative_id: filters?.initiativeId,
        orchestrator: filters?.orchestrator,
        runtime_agent_id: filters?.runtimeAgentId,
        limit: filters?.limit,
      })}`;

  const payload = await requestJson<{
    events: AutopilotExecutionEventRecord[];
  }>(path);
  return payload.events;
}

export async function fetchAutopilotExecutionRuntimeAgent(
  runtimeAgentId: string,
  options?: {
    eventLimit?: number;
  }
): Promise<AutopilotExecutionRuntimeAgentDetail> {
  return requestJson<AutopilotExecutionRuntimeAgentDetail>(
    `/api/shell/execution/actions/execution-plane/agents/${encodePathSegment(runtimeAgentId)}${buildQuery(
      {
        event_limit: options?.eventLimit,
      }
    )}`
  );
}

export async function fetchAutopilotExecutionRuntimeAgentTaskOutput(
  taskId: string
): Promise<AutopilotExecutionRuntimeAgentTaskOutputArtifact> {
  return requestJson<AutopilotExecutionRuntimeAgentTaskOutputArtifact>(
    `/api/shell/execution/actions/execution-plane/agents/tasks/${encodePathSegment(taskId)}/output`
  );
}

export async function fetchAutopilotExecutionRuntimeAgentTaskOutputLive(
  taskId: string,
  options?: {
    offset?: number;
    maxBytes?: number;
    tailLines?: number;
  }
): Promise<AutopilotExecutionRuntimeAgentTaskOutputLiveArtifact> {
  return requestJson<AutopilotExecutionRuntimeAgentTaskOutputLiveArtifact>(
    `/api/shell/execution/actions/execution-plane/agents/tasks/${encodePathSegment(taskId)}/output/live${buildQuery(
      {
        offset: options?.offset,
        max_bytes: options?.maxBytes,
        tail_lines: options?.tailLines,
      }
    )}`
  );
}

export async function fetchAutopilotExecutionRuntimeAgentTaskTranscript(
  taskId: string
): Promise<AutopilotExecutionRuntimeAgentTaskTranscriptArtifact> {
  return requestJson<AutopilotExecutionRuntimeAgentTaskTranscriptArtifact>(
    `/api/shell/execution/actions/execution-plane/agents/tasks/${encodePathSegment(taskId)}/transcript`
  );
}

export async function fetchAutopilotExecutionProjectRuntimeLog(
  projectId: string,
  options?: {
    offset?: number;
    maxBytes?: number;
    tailLines?: number;
  }
): Promise<AutopilotExecutionProjectRuntimeLog> {
  return requestJson<AutopilotExecutionProjectRuntimeLog>(
    `/api/shell/execution/actions/execution-plane/projects/${encodePathSegment(projectId)}/runtime-log${buildQuery(
      {
        offset: options?.offset,
        max_bytes: options?.maxBytes,
        tail_lines: options?.tailLines,
      }
    )}`
  );
}

export async function fetchAutopilotExecutionShadowAudit(
  auditId: string
): Promise<AutopilotExecutionShadowAuditDetail> {
  return requestJson<AutopilotExecutionShadowAuditDetail>(
    `/api/shell/execution/actions/execution-plane/shadow-audits/${encodePathSegment(auditId)}`
  );
}

export async function resolveAutopilotExecutionShadowAudit(
  auditId: string,
  payload?: { actor?: string; note?: string; outcome?: string }
): Promise<{ status: string; shadow_audit: AutopilotExecutionShadowAuditRecord }> {
  return requestJson<{ status: string; shadow_audit: AutopilotExecutionShadowAuditRecord }>(
    `/api/shell/execution/actions/execution-plane/shadow-audits/${encodePathSegment(auditId)}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actor: payload?.actor ?? "founderos-shell",
        note: payload?.note ?? "",
        outcome: payload?.outcome ?? "released",
      }),
    }
  );
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

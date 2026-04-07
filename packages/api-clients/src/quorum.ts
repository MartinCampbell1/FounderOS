export interface QuorumMessage {
  agent_id: string;
  content: string;
  timestamp: number;
  phase: string;
}

export interface QuorumSessionEvent {
  id: number;
  timestamp: number;
  type: string;
  title: string;
  detail: string;
  status?: string;
  agent_id?: string;
  phase?: string;
  checkpoint_id?: string;
  next_node?: string | null;
  pending_instructions?: number;
  applied_count?: number;
  mode?: string;
  forked_from?: string;
  branch_to?: string;
  tool_name?: string;
  elapsed_sec?: number;
  success?: boolean;
  round?: number;
}

export type QuorumDiscoveryDossierStage =
  | "sourced"
  | "ranked"
  | "debated"
  | "simulated"
  | "swiped"
  | "handed_off"
  | "executed"
  | string;

export interface QuorumDiscoveryIdea {
  idea_id: string;
  title: string;
  thesis: string;
  summary: string;
  description: string;
  source: string;
  source_urls: string[];
  topic_tags: string[];
  provenance: Record<string, unknown>;
  lineage_parent_ids: string[];
  evolved_from: string[];
  superseded_by: string[];
  swipe_state: string;
  rank_score: number;
  belief_score: number;
  validation_state: string;
  simulation_state: string;
  latest_stage: QuorumDiscoveryDossierStage;
  latest_scorecard: Record<string, number>;
  score_snapshots: Array<Record<string, unknown>>;
  reason_snapshots: Array<Record<string, unknown>>;
  last_evidence_refresh_at?: string | null;
  last_debate_refresh_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuorumExecutionBriefCandidate {
  brief_id: string;
  idea_id: string;
  title: string;
  prd_summary: string;
  acceptance_criteria: string[];
  risks: Array<{
    category: string;
    description: string;
    level: string;
    mitigation?: string | null;
  }>;
  recommended_tech_stack: string[];
  first_stories: Array<{
    title: string;
    description: string;
    acceptance_criteria: string[];
    effort: string;
  }>;
  judge_summary?: string | null;
  simulation_summary?: string | null;
  confidence: string;
  effort: string;
  urgency: string;
  budget_tier: string;
  created_at: string;
  updated_at: string;
}

export interface QuorumEvidenceItem {
  evidence_id: string;
  kind: string;
  summary: string;
  raw_content?: string | null;
  artifact_path?: string | null;
  source?: string | null;
  confidence: string;
  created_at: string;
  tags: string[];
}

export interface QuorumEvidenceBundle {
  bundle_id: string;
  parent_id: string;
  items: QuorumEvidenceItem[];
  overall_confidence: string;
  created_at: string;
  updated_at: string;
}

export interface QuorumSourceObservation {
  observation_id: string;
  idea_id: string;
  source: string;
  entity: string;
  url: string;
  raw_text: string;
  topic_tags: string[];
  pain_score: number;
  trend_score: number;
  evidence_confidence: string;
  captured_at: string;
}

export interface QuorumValidationReport {
  report_id: string;
  idea_id: string;
  summary: string;
  verdict: string;
  findings: string[];
  confidence: string;
  evidence_bundle_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuorumIdeaDecision {
  decision_id: string;
  idea_id: string;
  decision_type: string;
  rationale: string;
  actor: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuorumDossierTimelineEvent {
  event_id: string;
  stage: QuorumDiscoveryDossierStage;
  title: string;
  detail: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface QuorumSourceObservationCreateRequest {
  source: string;
  entity: string;
  url: string;
  raw_text: string;
  topic_tags?: string[];
  pain_score?: number;
  trend_score?: number;
  evidence_confidence?: string;
  freshness_deadline?: string | null;
  metadata?: Record<string, unknown>;
}

export interface QuorumValidationReportCreateRequest {
  summary: string;
  verdict?: string;
  findings?: string[];
  confidence?: string;
  evidence_bundle_id?: string | null;
}

export interface QuorumIdeaDecisionCreateRequest {
  decision_type: string;
  rationale: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface QuorumDossierTimelineEventCreateRequest {
  stage: QuorumDiscoveryDossierStage;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface QuorumEvidenceBundleItemInput {
  kind: string;
  summary: string;
  raw_content?: string | null;
  artifact_path?: string | null;
  source?: string | null;
  confidence: string;
  tags?: string[];
}

export interface QuorumEvidenceBundleUpsertRequest {
  items: QuorumEvidenceBundleItemInput[];
  overall_confidence?: string;
}

export interface QuorumIdeaArchiveEntry {
  archive_id: string;
  idea_id: string;
  reason: string;
  superseded_by_idea_id?: string | null;
  created_at: string;
}

export interface QuorumPersonaMemoryEntry {
  memory_id: string;
  kind: string;
  content: string;
  weight: number;
  source: string;
}

export interface QuorumPersonaPlanStep {
  step_id: string;
  label: string;
  intent: string;
  urgency: number;
}

export interface QuorumVirtualPersona {
  persona_id: string;
  display_name: string;
  segment: string;
  archetype: string;
  company_size: string;
  budget_band: string;
  urgency: number;
  skepticism: number;
  ai_affinity: number;
  price_sensitivity: number;
  domain_context: string;
  needs: string[];
  objections: string[];
  memory: QuorumPersonaMemoryEntry[];
  daily_plan: QuorumPersonaPlanStep[];
}

export interface QuorumFocusGroupTurn {
  turn_id: string;
  round_index: number;
  persona_id: string;
  prompt: string;
  quote: string;
  stance: string;
  sentiment: number;
  resonance_score: number;
  purchase_intent: number;
  key_reasons: string[];
}

export interface QuorumFocusGroupRound {
  round_id: string;
  round_index: number;
  prompt: string;
  aggregate_note: string;
  responses: QuorumFocusGroupTurn[];
}

export interface QuorumFocusGroupRun {
  run_id: string;
  idea_id: string;
  engine: string;
  world_name: string;
  persona_count: number;
  step_count: number;
  estimated_token_count: number;
  estimated_cost_usd: number;
  seed: number;
  created_at: string;
  rounds: QuorumFocusGroupRound[];
}

export interface QuorumSimulationFeedbackReport {
  report_id: string;
  idea_id: string;
  run: QuorumFocusGroupRun;
  personas: QuorumVirtualPersona[];
  summary_headline: string;
  verdict: string;
  support_ratio: number;
  average_resonance: number;
  average_purchase_intent: number;
  strongest_segments: string[];
  positive_signals: string[];
  objections: string[];
  desired_capabilities: string[];
  pricing_signals: string[];
  go_to_market_signals: string[];
  sample_quotes: string[];
  recommended_actions: string[];
  created_at: string;
}

export interface QuorumSimulationRunRequest {
  persona_count?: number;
  max_rounds?: number;
  seed?: number | null;
  target_market?: string | null;
  force_refresh?: boolean;
}

export interface QuorumSimulationRunResponse {
  idea: QuorumDiscoveryIdea;
  report: QuorumSimulationFeedbackReport;
  cached: boolean;
}

export interface QuorumSimulationParameters {
  population_size: number;
  round_count: number;
  seed?: number | null;
  target_market?: string | null;
  competition_pressure: number;
  network_density: number;
  evidence_weight: number;
  scenario_label: string;
  channel_mix: Record<string, number>;
}

export interface QuorumAgentActivityConfig {
  evaluation_rate: number;
  discussion_rate: number;
  trial_rate: number;
  referral_rate: number;
  churn_sensitivity: number;
}

export interface QuorumLabAgentState {
  agent_id: string;
  display_name: string;
  segment: string;
  archetype: string;
  adoption_stage: string;
  need_intensity: number;
  trust_threshold: number;
  budget_fit: number;
  network_reach: number;
  referral_propensity: number;
  skepticism: number;
  price_sensitivity: number;
  preferred_channel: string;
  objections: string[];
  memory: string[];
  last_action_summary: string;
}

export interface QuorumAgentAction {
  action_id: string;
  round_index: number;
  agent_id: string;
  segment: string;
  action_type: string;
  channel: string;
  summary: string;
  adoption_stage_before: string;
  adoption_stage_after: string;
  influence_delta: number;
  conversion_delta: number;
  pain_relief_delta: number;
}

export interface QuorumRoundSummary {
  round_id: string;
  round_index: number;
  awareness_rate: number;
  consideration_rate: number;
  trial_rate: number;
  adoption_rate: number;
  retention_rate: number;
  virality_score: number;
  pain_relief_score: number;
  objection_pressure: number;
  channel_lift: Record<string, number>;
  top_objections: string[];
  key_events: string[];
}

export interface QuorumSimulationRunState {
  run_id: string;
  status: string;
  current_round: number;
  completed_rounds: number;
  world_state: Record<string, unknown>;
  round_summaries: QuorumRoundSummary[];
  agent_actions: QuorumAgentAction[];
}

export interface QuorumReportOutlineSection {
  title: string;
  bullets: string[];
}

export interface QuorumMarketSimulationReport {
  report_id: string;
  idea_id: string;
  parameters: QuorumSimulationParameters;
  activity_config: QuorumAgentActivityConfig;
  run_state: QuorumSimulationRunState;
  agents: QuorumLabAgentState[];
  executive_summary: string;
  verdict: string;
  adoption_rate: number;
  retention_rate: number;
  virality_score: number;
  pain_relief_score: number;
  objection_score: number;
  market_fit_score: number;
  build_priority_score: number;
  ranking_delta: Record<string, number>;
  strongest_segments: string[];
  weakest_segments: string[];
  channel_findings: string[];
  key_objections: string[];
  report_outline: QuorumReportOutlineSection[];
  recommended_actions: string[];
  created_at: string;
}

export interface QuorumMarketSimulationRunRequest {
  population_size?: number;
  round_count?: number;
  seed?: number | null;
  target_market?: string | null;
  competition_pressure?: number;
  network_density?: number;
  evidence_weight?: number;
  force_refresh?: boolean;
}

export interface QuorumMarketSimulationRunResponse {
  idea: QuorumDiscoveryIdea;
  report: QuorumMarketSimulationReport;
  cached: boolean;
}

export interface QuorumExecutionOutcome {
  outcome_id: string;
  brief_id: string;
  idea_id: string;
  status: string;
  verdict: string;
  total_cost_usd: number;
  total_duration_seconds: number;
  stories_attempted: number;
  stories_passed: number;
  stories_failed: number;
  bugs_found: number;
  critic_pass_rate: number;
  approvals_count: number;
  shipped_experiment_count: number;
  shipped_artifacts: string[];
  failure_modes: string[];
  lessons_learned: string[];
  autopilot_project_id?: string | null;
  autopilot_project_name?: string | null;
  autopilot_payload: Record<string, unknown>;
  created_at: string;
  ingested_at: string;
}

export interface QuorumIdeaDossierAuthoringSummary {
  observation_count: number;
  evidence_item_count: number;
  validation_count: number;
  decision_count: number;
  timeline_count: number;
  overall_confidence: string;
  last_updated_at?: string | null;
}

export interface QuorumIdeaDossierSummary {
  idea: QuorumDiscoveryIdea;
  authoring_summary: QuorumIdeaDossierAuthoringSummary;
  execution_brief_candidate?: QuorumExecutionBriefCandidate | null;
  execution_outcomes: QuorumExecutionOutcome[];
}

export interface QuorumIdeaDossier {
  idea: QuorumDiscoveryIdea;
  evidence_bundle?: QuorumEvidenceBundle | null;
  observations: QuorumSourceObservation[];
  validation_reports: QuorumValidationReport[];
  decisions: QuorumIdeaDecision[];
  archive_entries?: QuorumIdeaArchiveEntry[];
  timeline: QuorumDossierTimelineEvent[];
  execution_brief_candidate?: QuorumExecutionBriefCandidate | null;
  execution_outcomes: QuorumExecutionOutcome[];
  simulation_report?: QuorumSimulationFeedbackReport | null;
  market_simulation_report?: QuorumMarketSimulationReport | null;
  idea_graph_context?: {
    idea_id: string;
    related_idea_ids: string[];
    lineage_idea_ids: string[];
    domain_clusters: string[];
    buyer_segments: string[];
    evidence_highlights: string[];
    failure_patterns: string[];
    reusable_patterns: string[];
  } | null;
  memory_context?: {
    idea_id: string;
    semantic_highlights: string[];
    related_idea_ids: string[];
    preference_notes: string[];
  } | null;
  explainability_context?: {
    idea_id: string;
    generated_at: string;
    ranking_summary: string;
    ranking_drivers: string[];
    ranking_risks: string[];
    judge_summary: string;
    simulation_summary: string;
    supporting_sessions: string[];
    linked_protocols: string[];
  } | null;
}

export type QuorumDiscoveryInboxActionKind =
  | "accept"
  | "ignore"
  | "edit"
  | "compare"
  | "respond"
  | "resolve";

export interface QuorumDiscoveryInboxActionRequest {
  action: QuorumDiscoveryInboxActionKind;
  actor?: string;
  note?: string;
  response_text?: string | null;
  edited_fields?: Record<string, string>;
  compare_target_idea_id?: string | null;
  resolve?: boolean | null;
  metadata?: Record<string, unknown>;
}

export interface QuorumDiscoveryInboxItem {
  item_id: string;
  kind: string;
  status: "open" | "resolved" | string;
  subject_kind: "idea" | "debate" | "simulation" | "handoff" | "digest" | "daemon" | string;
  title: string;
  detail: string;
  created_at: string;
  due_at?: string | null;
  idea_id?: string | null;
  digest_id?: string | null;
  run_id?: string | null;
  priority_score: number;
  age_minutes: number;
  aging_bucket: "fresh" | "aging" | "stale" | string;
  interrupt?: {
    summary: string;
    description: string;
    config: {
      allow_ignore: boolean;
      allow_respond: boolean;
      allow_edit: boolean;
      allow_accept: boolean;
      allow_compare: boolean;
    };
  } | null;
  dossier_preview?: {
    headline: string;
    idea_summary: string;
    latest_stage: QuorumDiscoveryDossierStage;
    rank_score: number;
    belief_score: number;
    evidence: {
      observations: string[];
      validations: string[];
      timeline: string[];
    };
    debate_summary?: string | null;
    simulation_summary?: string | null;
    handoff_summary?: string | null;
    compare_options: Array<{
      idea_id: string;
      title: string;
      latest_stage: QuorumDiscoveryDossierStage;
      reason: string;
    }>;
    raw_trace: Record<string, unknown>;
  } | null;
  review_history: Array<{
    event_id: string;
    action: string;
    actor: string;
    note: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }>;
  resolution?: {
    event_id: string;
    action: string;
    actor: string;
    note: string;
    created_at: string;
    metadata: Record<string, unknown>;
  } | null;
  metadata: Record<string, unknown>;
}

export interface QuorumDiscoveryInboxFeed {
  items: QuorumDiscoveryInboxItem[];
  summary: {
    open_count: number;
    resolved_count: number;
    stale_count: number;
    action_required_count: number;
    kinds: Record<string, number>;
    subject_kinds: Record<string, number>;
  };
}

export interface QuorumObservabilityMetricRecord {
  key: string;
  label: string;
  value: number;
  unit: string;
  detail: string;
}

export interface QuorumIdeaEvaluationScorecard {
  idea_id: string;
  title: string;
  novelty_score: number;
  evidence_quality_score: number;
  anti_banality_score: number;
  judge_consistency_score: number;
  simulation_calibration_score: number;
  overall_health: number;
  flags: string[];
  rationales: string[];
}

export interface QuorumProtocolRegressionRecord {
  protocol_key: string;
  mode: string;
  session_count: number;
  completed_count: number;
  failed_count: number;
  avg_latency_sec: number;
  invalid_transition_rate: number;
  cache_hit_rate: number;
}

export interface QuorumDiscoveryObservabilityScoreboard {
  generated_at: string;
  idea_count: number;
  active_idea_count: number;
  session_count: number;
  stage_distribution: Record<string, number>;
  swipe_distribution: Record<string, number>;
  metrics: QuorumObservabilityMetricRecord[];
  evaluation_averages: Record<string, number>;
  weakest_ideas: QuorumIdeaEvaluationScorecard[];
  strongest_ideas: QuorumIdeaEvaluationScorecard[];
  protocol_regressions: QuorumProtocolRegressionRecord[];
  highlights: string[];
}

export type QuorumObservabilityTraceKind =
  | "evidence"
  | "validation"
  | "ranking"
  | "swipe"
  | "decision"
  | "simulation"
  | "timeline"
  | string;

export interface QuorumIdeaTraceStep {
  trace_id: string;
  trace_kind: QuorumObservabilityTraceKind;
  stage: string;
  title: string;
  detail: string;
  actor: string;
  created_at: string;
  score_delta: Record<string, number>;
  latency_sec: number;
  cost_usd: number;
  metadata: Record<string, unknown>;
}

export interface QuorumIdeaTraceBundle {
  idea_id: string;
  title: string;
  latest_stage: QuorumDiscoveryDossierStage;
  last_updated_at?: string | null;
  linked_session_ids: string[];
  steps: QuorumIdeaTraceStep[];
}

export interface QuorumSessionTraceSummary {
  session_id: string;
  mode: string;
  task: string;
  status: string;
  created_at: number;
  elapsed_sec?: number | null;
  selected_template?: string | null;
  execution_mode?: string | null;
  step_count: number;
  invalid_transition_count: number;
  generation_artifact_count: number;
}

export interface QuorumDiscoveryTraceSnapshot {
  snapshot_id: string;
  created_at: string;
  trace_count: number;
  idea_count: number;
  session_count: number;
  traces: QuorumIdeaTraceBundle[];
  recent_sessions: QuorumSessionTraceSummary[];
  metrics: Record<string, number>;
}

export interface QuorumDebateReplayStep {
  replay_id: string;
  timestamp: number;
  kind:
    | "session_event"
    | "checkpoint"
    | "protocol_transition"
    | "generation_artifact"
    | string;
  title: string;
  detail: string;
  agent_id?: string | null;
  checkpoint_id?: string | null;
  node_id?: string | null;
  status?: string | null;
  metadata: Record<string, unknown>;
}

export interface QuorumReplayParticipant {
  role: string;
  provider: string;
  tools: string[];
}

export interface QuorumDebateReplaySession {
  session_id: string;
  mode: string;
  task: string;
  status: string;
  created_at: number;
  elapsed_sec?: number | null;
  result?: string | null;
  selected_template?: string | null;
  execution_mode?: string | null;
  participants: QuorumReplayParticipant[];
  event_count: number;
  checkpoint_count: number;
  invalid_transition_count: number;
  generation_artifact_count: number;
  timeline: QuorumDebateReplayStep[];
  protocol_trace: Record<string, unknown>[];
}

export type QuorumPairwiseVerdict = "left" | "right" | "tie";

export interface QuorumRankedIdeaRecord {
  idea: QuorumDiscoveryIdea;
  rank_position: number;
  rating: number;
  merit_score: number;
  matches_played: number;
  wins: number;
  losses: number;
  ties: number;
  win_rate: number;
  stability_score: number;
  volatility_score: number;
  confidence_low: number;
  confidence_high: number;
  last_compared_at?: string | null;
}

export interface QuorumRankingJudgeBelievability {
  judge_key: string;
  judge_source: string;
  judge_model?: string | null;
  judge_agent_id?: string | null;
  domain_key?: string | null;
  comparisons_count: number;
  agreement_rate: number;
  believability_score: number;
}

export interface QuorumRankingMetrics {
  comparisons_count: number;
  unique_pairs: number;
  reliability_weighted: number;
  rank_stability: number;
  volatility_mean: number;
  average_ci_width: number;
}

export interface QuorumRankingLeaderboardResponse {
  items: QuorumRankedIdeaRecord[];
  judges: QuorumRankingJudgeBelievability[];
  metrics: QuorumRankingMetrics;
}

export interface QuorumNextPairResponse {
  left: QuorumRankedIdeaRecord;
  right: QuorumRankedIdeaRecord;
  utility_score: number;
  reason: string;
  direct_comparisons: number;
  candidate_pool_size: number;
}

export interface QuorumPairwiseComparisonRecord {
  comparison_id: string;
  left_idea_id: string;
  right_idea_id: string;
  verdict: QuorumPairwiseVerdict;
  winner_idea_id?: string | null;
  loser_idea_id?: string | null;
  rationale: string;
  judge_source: string;
  judge_model?: string | null;
  judge_agent_id?: string | null;
  domain_key?: string | null;
  judge_confidence: number;
  evidence_weight: number;
  agent_importance_score: number;
  believability_weight: number;
  comparison_weight: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface QuorumPairwiseComparisonResponse {
  comparison: QuorumPairwiseComparisonRecord;
  leaderboard: QuorumRankingLeaderboardResponse;
  next_pair?: QuorumNextPairResponse | null;
}

export interface QuorumFinalVoteBallot {
  voter_id: string;
  ranked_idea_ids: string[];
  weight: number;
  judge_source: string;
  judge_model?: string | null;
  judge_agent_id?: string | null;
  domain_key?: string | null;
  confidence: number;
  agent_importance_score: number;
}

export interface QuorumFinalVoteRound {
  round_number: number;
  tallies: Record<string, number>;
  eliminated_idea_id?: string | null;
  total_weight: number;
}

export interface QuorumFinalVoteResult {
  winner_idea_id?: string | null;
  rounds: QuorumFinalVoteRound[];
  aggregate_rankings: Array<{
    idea_id: string;
    average_rank: number;
    rankings_count: number;
  }>;
}

export interface QuorumPromptEvolutionProfile {
  profile_id: string;
  label: string;
  operator_kind: string;
  instruction: string;
  elo_rating: number;
  wins: number;
  losses: number;
  ties: number;
  usage_count: number;
  debate_influence: number;
  last_updated: string;
  metadata: Record<string, unknown>;
}

export interface QuorumIdeaGenome {
  genome_id: string;
  idea_id: string;
  title: string;
  lineage_idea_ids: string[];
  domain: string;
  complexity: string;
  distribution_strategy: string;
  buyer_type: string;
  fitness: number;
  novelty_score: number;
  rating: number;
  merit_score: number;
  stability_score: number;
  prompt_profile_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuorumIdeaArchiveCell {
  cell_id: string;
  key: string;
  domain: string;
  complexity: string;
  distribution_strategy: string;
  buyer_type: string;
  elite: QuorumIdeaGenome;
  replaced_genome_id?: string | null;
  occupied_at: string;
}

export interface QuorumEvolutionRecommendation {
  recommendation_id: string;
  operator_kind: string;
  headline: string;
  description: string;
  source_genome_ids: string[];
  target_axes: Record<string, string>;
  prompt_profile_id?: string | null;
}

export interface QuorumArchiveCheckpointDigest {
  checkpoint_id: string;
  generation: number;
  filled_cells: number;
  coverage: number;
  qd_score: number;
  created_at: string;
}

export interface QuorumIdeaArchiveSnapshot {
  archive_id: string;
  generation: number;
  total_possible_cells: number;
  filled_cells: number;
  coverage: number;
  qd_score: number;
  diversity_score: number;
  novelty_mean: number;
  cells: QuorumIdeaArchiveCell[];
  top_genomes: QuorumIdeaGenome[];
  prompt_profiles: QuorumPromptEvolutionProfile[];
  recommendations: QuorumEvolutionRecommendation[];
  checkpoints: QuorumArchiveCheckpointDigest[];
  checkpointed: boolean;
  created_at: string;
}

export type QuorumImprovementRole = "generator" | "judge" | "critic";

export interface QuorumReflectiveSignal {
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
  target_roles: QuorumImprovementRole[];
  suggested_patch: string;
}

export interface QuorumReflectiveEvalReport {
  reflection_id: string;
  source_kind: string;
  source_id?: string | null;
  task: string;
  role_focus: QuorumImprovementRole[];
  strengths: string[];
  failure_tags: string[];
  recommendations: string[];
  signals: QuorumReflectiveSignal[];
  score_hint: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type QuorumSelfPlaySignalKind =
  | "buyer"
  | "distribution"
  | "evidence"
  | "risk"
  | "scope"
  | "novelty"
  | "unsupported_claims"
  | "scorecard";

export interface QuorumSelfPlayChallengeCard {
  challenge_id: string;
  task: string;
  desired_signals: QuorumSelfPlaySignalKind[];
  pressure_tags: string[];
  role_focus: QuorumImprovementRole[];
}

export interface QuorumSelfPlayCaseResult {
  challenge_id: string;
  left_score: number;
  right_score: number;
  winner: "left" | "right" | "tie";
  rationale: string;
}

export interface QuorumPromptSelfPlayMatch {
  match_id: string;
  left_profile_id: string;
  right_profile_id: string;
  role_focus: QuorumImprovementRole[];
  challenge_cards: QuorumSelfPlayChallengeCard[];
  case_results: QuorumSelfPlayCaseResult[];
  left_score_total: number;
  right_score_total: number;
  winner_profile_id?: string | null;
  winner_reason: string;
  created_at: string;
}

export type QuorumRepoSourceType = "local" | "github";
export type QuorumRepoComplexity = "low" | "medium" | "high" | "very_high";

export interface QuorumRepoHotFile {
  path: string;
  language?: string | null;
  line_count: number;
  importance_score: number;
  reasons: string[];
}

export interface QuorumRepoIssueTheme {
  label: string;
  frequency: number;
  evidence: string[];
}

export interface QuorumRepoDigestSummary {
  digest_id: string;
  source: string;
  source_type: QuorumRepoSourceType;
  repo_name: string;
  repo_root?: string | null;
  branch?: string | null;
  commit_sha?: string | null;
  generated_at: number;
  tree_preview: string[];
  languages: Record<string, number>;
  tech_stack: string[];
  dominant_domains: string[];
  readme_claims: string[];
  issue_themes: QuorumRepoIssueTheme[];
  hot_files: QuorumRepoHotFile[];
  key_paths: string[];
  file_count: number;
}

export interface QuorumRepoDNAProfile {
  profile_id: string;
  source: string;
  repo_name: string;
  generated_at: number;
  languages: string[];
  domain_clusters: string[];
  preferred_complexity: QuorumRepoComplexity;
  recurring_pain_areas: string[];
  adjacent_product_opportunities: string[];
  repeated_builds: string[];
  avoids: string[];
  breaks_often: string[];
  adjacent_buyer_pain: string[];
  idea_generation_context: string;
  ranking_priors: string[];
  swipe_explanation_points: string[];
}

export interface QuorumRepoDigestResult {
  digest: QuorumRepoDigestSummary;
  profile: QuorumRepoDNAProfile;
  cache_hit: boolean;
  warnings: string[];
}

export interface QuorumRepoDigestAnalyzeRequest {
  source: string;
  branch?: string | null;
  include_patterns?: string[];
  exclude_patterns?: string[];
  issue_texts?: string[];
  issue_limit?: number;
  max_files?: number;
  hot_file_limit?: number;
  refresh?: boolean;
}

export type QuorumRepoGraphTrigger = "promoted" | "explicit" | "background";

export interface QuorumRepoGraphNodeRecord {
  node_id: string;
  kind: string;
  label: string;
  source_ref?: string | null;
  weight: number;
  metadata: Record<string, unknown>;
}

export interface QuorumRepoGraphEdgeRecord {
  edge_id: string;
  kind: string;
  source_node_id: string;
  target_node_id: string;
  weight: number;
  evidence: string[];
  metadata: Record<string, unknown>;
}

export interface QuorumRepoGraphCommunityRecord {
  community_id: string;
  title: string;
  summary: string;
  node_ids: string[];
  finding_points: string[];
  rank_score: number;
}

export interface QuorumRepoGraphEvidenceTrail {
  trail_id: string;
  thesis: string;
  explanation: string;
  supporting_node_ids: string[];
  supporting_edge_ids: string[];
}

export interface QuorumRepoDeepDiveRecord {
  deep_dive_id: string;
  graph_id: string;
  startup_territories: string[];
  architectural_focus: string[];
  risk_hotspots: string[];
  adjacency_opportunities: string[];
  why_now: string[];
  evidence_trails: QuorumRepoGraphEvidenceTrail[];
}

export interface QuorumRepoGraphStats {
  node_count: number;
  edge_count: number;
  community_count: number;
  api_count: number;
  package_count: number;
  problem_count: number;
  generated_at: number;
}

export interface QuorumRepoGraphResult {
  graph_id: string;
  source: string;
  source_type: QuorumRepoSourceType;
  repo_name: string;
  branch?: string | null;
  commit_sha?: string | null;
  trigger: QuorumRepoGraphTrigger;
  generated_at: number;
  repo_dna_profile?: QuorumRepoDNAProfile | null;
  nodes: QuorumRepoGraphNodeRecord[];
  edges: QuorumRepoGraphEdgeRecord[];
  communities: QuorumRepoGraphCommunityRecord[];
  deep_dive: QuorumRepoDeepDiveRecord;
  stats: QuorumRepoGraphStats;
  cache_hit: boolean;
  warnings: string[];
}

export interface QuorumRepoGraphAnalyzeRequest {
  source: string;
  branch?: string | null;
  issue_texts?: string[];
  max_files?: number;
  refresh?: boolean;
  trigger?: QuorumRepoGraphTrigger;
}

export interface QuorumImprovementArtifact {
  artifact_id?: string;
  role?: QuorumImprovementRole | string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface QuorumImprovementSessionReflectRequest {
  session_id?: string | null;
  task?: string;
  source_kind?: string;
  source_id?: string | null;
  role_focus?: QuorumImprovementRole[];
  failure_tags?: string[];
  notes?: string[];
  artifacts?: QuorumImprovementArtifact[];
  judge_scores?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface QuorumImprovementSelfPlayRequest {
  left_profile_id?: string | null;
  right_profile_id?: string | null;
  reflection_ids?: string[];
  task?: string;
  role_focus?: QuorumImprovementRole[];
  challenge_count?: number;
  activate_winner?: boolean;
}

export interface QuorumImprovementEvolutionRequest {
  seed_profile_id?: string | null;
  reflection_ids?: string[];
  task?: string;
  mutation_budget?: number;
  challenge_count?: number;
  activate_best?: boolean;
}

export interface QuorumImprovementEvolutionResult {
  seed_profile: QuorumPromptEvolutionProfile;
  reflections: QuorumReflectiveEvalReport[];
  generated_profiles: QuorumPromptEvolutionProfile[];
  matches: QuorumPromptSelfPlayMatch[];
  activated_profile_id?: string | null;
}

export type QuorumDiscoverySwipeAction = "pass" | "maybe" | "yes" | "now";

export interface QuorumFounderPreferenceProfile {
  profile_id: string;
  owner: string;
  swipe_count: number;
  action_counts: Record<string, number>;
  domain_weights: Record<string, number>;
  market_weights: Record<string, number>;
  buyer_preferences: Record<string, number>;
  ai_necessity_preference: number;
  preferred_complexity: number;
  complexity_tolerance: number;
  updated_at: string;
}

export interface QuorumMaybeQueueEntry {
  entry_id: string;
  idea_id: string;
  queued_at: string;
  due_at: string;
  last_seen_at?: string | null;
  last_rechecked_at?: string | null;
  metadata: Record<string, unknown>;
}

export interface QuorumIdeaQueueExplanation {
  headline: string;
  source_signals: string[];
  score_deltas: Record<string, number>;
  lineage: string[];
  newest_evidence: string[];
  repo_dna_match?: string | null;
  preference_signals: string[];
  change_summary: string[];
}

export interface QuorumIdeaQueueItem {
  queue_id: string;
  queue_kind: string;
  idea: QuorumDiscoveryIdea;
  priority_score: number;
  explanation: QuorumIdeaQueueExplanation;
  last_swipe_action?: QuorumDiscoverySwipeAction | null;
  last_swiped_at?: string | null;
  maybe_entry?: QuorumMaybeQueueEntry | null;
  has_new_evidence: boolean;
  repo_dna_match_score: number;
}

export interface QuorumSwipeQueueSummary {
  active_count: number;
  unseen_count: number;
  maybe_ready_count: number;
  maybe_waiting_count: number;
  pass_count: number;
  yes_count: number;
  now_count: number;
}

export interface QuorumSwipeQueueResponse {
  items: QuorumIdeaQueueItem[];
  preference_profile: QuorumFounderPreferenceProfile;
  summary: QuorumSwipeQueueSummary;
}

export interface QuorumIdeaSwipeResult {
  idea: QuorumDiscoveryIdea;
  decision: Record<string, unknown>;
  swipe_event: {
    event_id: string;
    idea_id: string;
    action: QuorumDiscoverySwipeAction;
    rationale: string;
    actor: string;
    created_at: string;
    metadata: Record<string, unknown>;
  };
  maybe_entry?: QuorumMaybeQueueEntry | null;
  preference_profile: QuorumFounderPreferenceProfile;
}

export type QuorumSessionStatus =
  | "running"
  | "pause_requested"
  | "paused"
  | "cancel_requested"
  | "cancelled"
  | "completed"
  | "failed";

export interface QuorumSessionSummary {
  id: string;
  mode: string;
  task: string;
  status: QuorumSessionStatus | string;
  created_at: number;
  active_scenario?: string | null;
  forked_from?: string | null;
  parallel_parent_id?: string | null;
  parallel_group_id?: string | null;
  parallel_slot_key?: string | null;
  parallel_stage?: string | null;
  parallel_label?: string | null;
}

export interface QuorumSession {
  id: string;
  mode: string;
  task: string;
  result: string | null;
  status: QuorumSessionStatus | string;
  active_scenario?: string | null;
  forked_from?: string | null;
  parallel_parent_id?: string | null;
  parallel_group_id?: string | null;
  parallel_slot_key?: string | null;
  parallel_stage?: string | null;
  parallel_label?: string | null;
  created_at: number;
  elapsed_sec: number | null;
  current_checkpoint_id?: string | null;
  pending_instructions?: number;
  active_node?: string | null;
  messages: QuorumMessage[];
  events?: QuorumSessionEvent[];
  runtime_state?: {
    can_pause?: boolean;
    can_resume?: boolean;
    can_send_message?: boolean;
    can_inject_instruction?: boolean;
    can_cancel?: boolean;
    can_continue_conversation?: boolean;
    can_branch_from_checkpoint?: boolean;
    reasons?: Record<string, { code: string; message: string } | null>;
  };
}

export interface QuorumExecutionBrief {
  version: string;
  title: string;
  thesis: string;
  summary: string;
  tags: string[];
  founder?: {
    mode?: string;
    strengths?: string[];
    interests?: string[];
    constraints?: string[];
    unfair_advantages?: string[];
    available_capital_usd?: number | null;
    weekly_hours?: number | null;
  };
  market?: {
    icp?: string;
    pain?: string;
    why_now?: string;
    wedge?: string;
  };
  execution?: {
    mvp_scope?: string[];
    non_goals?: string[];
    required_capabilities?: string[];
    required_connectors?: string[];
    existing_repos?: string[];
  };
  monetization?: {
    revenue_model?: string;
    pricing_hint?: string;
    time_to_first_dollar?: string;
  };
  evaluation?: {
    success_metrics?: string[];
    kill_criteria?: string[];
    open_questions?: string[];
    major_risks?: string[];
  };
  provenance?: {
    source_system?: string;
    source_session_id?: string;
    source_mode?: string;
    source_scenario_id?: string;
    ranking_rationale?: string;
  };
}

export interface QuorumAutopilotLaunchProfile {
  preset: string;
  story_execution_mode?: string | null;
  project_concurrency_mode?: string | null;
  max_parallel_stories?: number | null;
}

export interface QuorumAutopilotLaunchPreset {
  id: string;
  label: string;
  description: string;
  launch_profile: QuorumAutopilotLaunchProfile;
}

export interface QuorumTournamentPreparationCandidate {
  label: string;
  thesis: string;
  rationale: string;
  source_workspace_path: string;
  tags: string[];
}

export interface QuorumTournamentPreparation {
  version: string;
  title: string;
  scenario_id: string;
  mode: string;
  task: string;
  recommended_max_rounds: number;
  recommended_execution_mode: "sequential" | "parallel";
  contestants: QuorumTournamentPreparationCandidate[];
}

export interface QuorumSessionControlResult {
  status: string;
  pending_instructions?: number;
  new_session_id?: string;
}

export interface QuorumContinueResult {
  status: string;
  new_session_id?: string;
}

export interface QuorumSendToAutopilotResult {
  status: string;
  brief: QuorumExecutionBrief;
  autopilot: Record<string, unknown>;
}

function parseErrorPayload(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    if ("detail" in payload && typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
    if ("message" in payload && typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallback;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(parseErrorPayload(payload, `Request failed: ${response.status}`));
  }

  return payload as T;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

export async function fetchQuorumSessions(): Promise<QuorumSessionSummary[]> {
  const payload = await requestJson<{
    sessions: QuorumSessionSummary[];
    sessionsError: string | null;
  }>("/api/shell/discovery/sessions");

  if (payload.sessionsError) {
    throw new Error(payload.sessionsError);
  }

  return payload.sessions;
}

export async function fetchQuorumSession(
  sessionId: string
): Promise<QuorumSession> {
  const payload = await requestJson<{
    session: QuorumSession | null;
    sessionError: string | null;
  }>(`/api/shell/discovery/sessions?sessionId=${encodePathSegment(sessionId)}`);

  if (payload.session) {
    return payload.session;
  }

  throw new Error(payload.sessionError || `Quorum session ${sessionId} not found.`);
}

export async function fetchQuorumDiscoveryIdeas(
  limit: number = 30
): Promise<QuorumDiscoveryIdea[]> {
  const payload = await requestJson<{
    ideas: QuorumDiscoveryIdea[];
    ideasError: string | null;
  }>(
    `/api/shell/discovery/ideas?limit=${Math.max(1, Math.min(limit, 500))}`
  );

  if (payload.ideasError) {
    throw new Error(payload.ideasError);
  }

  return payload.ideas;
}

export async function fetchQuorumDiscoveryDossier(
  ideaId: string
): Promise<QuorumIdeaDossier> {
  const payload = await requestJson<{
    dossier: QuorumIdeaDossier | null;
    dossierError: string | null;
  }>(`/api/shell/discovery/ideas?ideaId=${encodePathSegment(ideaId)}`);

  if (payload.dossier) {
    return payload.dossier;
  }

  throw new Error(payload.dossierError || `Discovery dossier ${ideaId} not found.`);
}

export async function fetchQuorumDiscoveryInbox(
  limit: number = 50,
  status: "open" | "resolved" | null = "open"
): Promise<QuorumDiscoveryInboxFeed> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.max(1, Math.min(limit, 500))));
  if (status) {
    params.set("status", status);
  }
  return requestJson(`/api/shell/discovery/inbox?${params.toString()}`);
}

export async function runQuorumDiscoverySimulation(
  ideaId: string,
  body: QuorumSimulationRunRequest
): Promise<QuorumSimulationRunResponse> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/simulation`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function runQuorumDiscoveryMarketSimulation(
  ideaId: string,
  body: QuorumMarketSimulationRunRequest
): Promise<QuorumMarketSimulationRunResponse> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/simulation/lab`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function compareQuorumRankingIdeas(body: {
  leftIdeaId: string;
  rightIdeaId: string;
  verdict: QuorumPairwiseVerdict;
  rationale?: string;
  judgeSource?: string;
  judgeModel?: string | null;
  judgeAgentId?: string | null;
  domainKey?: string | null;
  judgeConfidence?: number;
  evidenceWeight?: number;
  agentImportanceScore?: number;
  metadata?: Record<string, unknown>;
}): Promise<QuorumPairwiseComparisonResponse> {
  return requestJson(
    "/api/shell/discovery/actions/orchestrate/ranking/compare",
    {
      method: "POST",
      body: JSON.stringify({
        left_idea_id: body.leftIdeaId,
        right_idea_id: body.rightIdeaId,
        verdict: body.verdict,
        rationale: body.rationale ?? "",
        judge_source: body.judgeSource ?? "human",
        judge_model: body.judgeModel ?? null,
        judge_agent_id: body.judgeAgentId ?? null,
        domain_key: body.domainKey ?? null,
        judge_confidence: body.judgeConfidence,
        evidence_weight: body.evidenceWeight,
        agent_importance_score: body.agentImportanceScore,
        metadata: body.metadata ?? {},
      }),
    }
  );
}

export async function resolveQuorumRankingFinals(body: {
  candidateIdeaIds?: string[];
  ballots: QuorumFinalVoteBallot[];
}): Promise<QuorumFinalVoteResult> {
  return requestJson(
    "/api/shell/discovery/actions/orchestrate/ranking/finals/resolve",
    {
      method: "POST",
      body: JSON.stringify({
        candidate_idea_ids: body.candidateIdeaIds,
        ballots: body.ballots,
      }),
    }
  );
}

export async function archiveQuorumDiscoveryIdea(
  ideaId: string,
  body: {
    reason: string;
    supersededByIdeaId?: string | null;
  }
): Promise<QuorumIdeaArchiveEntry> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/archive`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: body.reason,
        superseded_by_idea_id: body.supersededByIdeaId ?? null,
      }),
    }
  );
}

export async function addQuorumDiscoveryObservation(
  ideaId: string,
  body: QuorumSourceObservationCreateRequest
): Promise<QuorumSourceObservation> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/observations`,
    {
      method: "POST",
      body: JSON.stringify({
        source: body.source,
        entity: body.entity,
        url: body.url,
        raw_text: body.raw_text,
        topic_tags: body.topic_tags ?? [],
        pain_score: body.pain_score ?? 0,
        trend_score: body.trend_score ?? 0,
        evidence_confidence: body.evidence_confidence ?? "medium",
        freshness_deadline: body.freshness_deadline ?? null,
        metadata: body.metadata ?? {},
      }),
    }
  );
}

export async function addQuorumDiscoveryValidationReport(
  ideaId: string,
  body: QuorumValidationReportCreateRequest
): Promise<QuorumValidationReport> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/validation-reports`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: body.summary,
        verdict: body.verdict ?? "skip",
        findings: body.findings ?? [],
        confidence: body.confidence ?? "medium",
        evidence_bundle_id: body.evidence_bundle_id ?? null,
      }),
    }
  );
}

export async function addQuorumDiscoveryDecision(
  ideaId: string,
  body: QuorumIdeaDecisionCreateRequest
): Promise<QuorumIdeaDecision> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/decisions`,
    {
      method: "POST",
      body: JSON.stringify({
        decision_type: body.decision_type,
        rationale: body.rationale,
        actor: body.actor ?? "founder",
        metadata: body.metadata ?? {},
      }),
    }
  );
}

export async function addQuorumDiscoveryTimelineEvent(
  ideaId: string,
  body: QuorumDossierTimelineEventCreateRequest
): Promise<QuorumDossierTimelineEvent> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/timeline`,
    {
      method: "POST",
      body: JSON.stringify({
        stage: body.stage,
        title: body.title,
        detail: body.detail ?? "",
        metadata: body.metadata ?? {},
      }),
    }
  );
}

export async function upsertQuorumDiscoveryEvidenceBundle(
  ideaId: string,
  body: QuorumEvidenceBundleUpsertRequest
): Promise<QuorumEvidenceBundle> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/evidence-bundle`,
    {
      method: "PUT",
      body: JSON.stringify({
        items: body.items.map((item) => ({
          kind: item.kind,
          summary: item.summary,
          raw_content: item.raw_content ?? null,
          artifact_path: item.artifact_path ?? null,
          source: item.source ?? null,
          confidence: item.confidence,
          tags: item.tags ?? [],
        })),
        overall_confidence: body.overall_confidence ?? "medium",
      }),
    }
  );
}

export async function swipeQuorumDiscoveryIdea(
  ideaId: string,
  body: {
    action: QuorumDiscoverySwipeAction;
    rationale?: string;
    actor?: string;
    revisitAfterHours?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<QuorumIdeaSwipeResult> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/ideas/${encodePathSegment(ideaId)}/swipe`,
    {
      method: "POST",
      body: JSON.stringify({
        action: body.action,
        rationale: body.rationale ?? "",
        actor: body.actor ?? "founder",
        revisit_after_hours: body.revisitAfterHours,
        metadata: body.metadata ?? {},
      }),
    }
  );
}

export async function actOnQuorumDiscoveryInboxItem(
  itemId: string,
  request: QuorumDiscoveryInboxActionRequest
): Promise<QuorumDiscoveryInboxItem> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/inbox/${encodePathSegment(itemId)}/act`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
}

export async function resolveQuorumDiscoveryInboxItem(
  itemId: string,
  note?: string
): Promise<QuorumDiscoveryInboxItem> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/discovery/inbox/${encodePathSegment(itemId)}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: note ?? "",
      }),
    }
  );
}

export function getQuorumSessionEventsUrl(sessionId: string, since: number = 0) {
  const params = new URLSearchParams();
  if (since > 0) {
    params.set("since", String(since));
  }
  const suffix = params.toString();
  return `/api/shell/discovery/events/${encodePathSegment(sessionId)}${
    suffix ? `?${suffix}` : ""
  }`;
}

export async function sendQuorumSessionMessage(
  sessionId: string,
  content: string
): Promise<void> {
  await requestJson(
    `/api/shell/discovery/actions/orchestrate/session/${encodePathSegment(sessionId)}/message`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
}

export async function continueQuorumSession(
  sessionId: string,
  content: string
): Promise<QuorumContinueResult> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/session/${encodePathSegment(sessionId)}/continue`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
}

export async function controlQuorumSession(
  sessionId: string,
  action:
    | "pause"
    | "resume"
    | "inject_instruction"
    | "cancel"
    | "restart_from_checkpoint",
  content?: string,
  checkpointId?: string
): Promise<QuorumSessionControlResult> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/session/${encodePathSegment(sessionId)}/control`,
    {
      method: "POST",
      body: JSON.stringify({
        action,
        content: content ?? "",
        checkpoint_id: checkpointId ?? "",
      }),
    }
  );
}

export async function exportQuorumExecutionBrief(
  sessionId: string,
  provider?: string
): Promise<{ status: string; brief: QuorumExecutionBrief }> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/session/${encodePathSegment(sessionId)}/execution-brief`,
    {
      method: "POST",
      body: JSON.stringify({ provider: provider ?? null }),
    }
  );
}

export async function fetchQuorumAutopilotLaunchPresets(): Promise<
  QuorumAutopilotLaunchPreset[]
> {
  const payload = await requestJson<{
    launchPresets: QuorumAutopilotLaunchPreset[];
    launchPresetsError: string | null;
  }>("/api/shell/discovery/sessions");

  if (payload.launchPresetsError) {
    throw new Error(payload.launchPresetsError);
  }

  return payload.launchPresets;
}

export async function activateQuorumImprovementPromptProfile(
  profileId: string
): Promise<{ status: string; profile: QuorumPromptEvolutionProfile }> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/improvement/prompt-profiles/${encodePathSegment(profileId)}/activate`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function runQuorumRepoDigestAnalysis(
  body: QuorumRepoDigestAnalyzeRequest
): Promise<QuorumRepoDigestResult> {
  return requestJson(
    "/api/shell/discovery/actions/orchestrate/repo-digest/analyze",
    {
      method: "POST",
      body: JSON.stringify({
        source: body.source,
        branch: body.branch ?? null,
        include_patterns: body.include_patterns ?? [],
        exclude_patterns: body.exclude_patterns ?? [],
        issue_texts: body.issue_texts ?? [],
        issue_limit: body.issue_limit,
        max_files: body.max_files,
        hot_file_limit: body.hot_file_limit,
        refresh: body.refresh ?? false,
      }),
    }
  );
}

export async function runQuorumRepoGraphAnalysis(
  body: QuorumRepoGraphAnalyzeRequest
): Promise<QuorumRepoGraphResult> {
  return requestJson(
    "/api/shell/discovery/actions/orchestrate/repo-graph/analyze",
    {
      method: "POST",
      body: JSON.stringify({
        source: body.source,
        branch: body.branch ?? null,
        issue_texts: body.issue_texts ?? [],
        max_files: body.max_files,
        refresh: body.refresh ?? false,
        trigger: body.trigger ?? "explicit",
      }),
    }
  );
}

export async function runQuorumImprovementReflection(
  body: QuorumImprovementSessionReflectRequest
): Promise<{ status: string; reflection: QuorumReflectiveEvalReport }> {
  return requestJson("/api/shell/discovery/actions/orchestrate/improvement/reflect", {
    method: "POST",
    body: JSON.stringify({
      session_id: body.session_id ?? null,
      task: body.task ?? "",
      source_kind: body.source_kind ?? "manual",
      source_id: body.source_id ?? null,
      role_focus: body.role_focus ?? [],
      failure_tags: body.failure_tags ?? [],
      notes: body.notes ?? [],
      artifacts: body.artifacts ?? [],
      judge_scores: body.judge_scores ?? [],
      metadata: body.metadata ?? {},
    }),
  });
}

export async function runQuorumImprovementSelfPlay(
  body: QuorumImprovementSelfPlayRequest
): Promise<{ status: string; match: QuorumPromptSelfPlayMatch }> {
  return requestJson("/api/shell/discovery/actions/orchestrate/improvement/self-play", {
    method: "POST",
    body: JSON.stringify({
      left_profile_id: body.left_profile_id ?? null,
      right_profile_id: body.right_profile_id ?? null,
      reflection_ids: body.reflection_ids ?? [],
      task: body.task ?? "",
      role_focus: body.role_focus ?? [],
      challenge_count: body.challenge_count ?? 3,
      activate_winner: body.activate_winner ?? false,
    }),
  });
}

export async function runQuorumImprovementEvolution(
  body: QuorumImprovementEvolutionRequest
): Promise<{ status: string; result: QuorumImprovementEvolutionResult }> {
  return requestJson("/api/shell/discovery/actions/orchestrate/improvement/evolve", {
    method: "POST",
    body: JSON.stringify({
      seed_profile_id: body.seed_profile_id ?? null,
      reflection_ids: body.reflection_ids ?? [],
      task: body.task ?? "",
      mutation_budget: body.mutation_budget ?? 3,
      challenge_count: body.challenge_count ?? 3,
      activate_best: body.activate_best ?? true,
    }),
  });
}

export async function sendQuorumExecutionBriefToAutopilot(
  sessionId: string,
  body?: {
    provider?: string;
    autopilot_url?: string;
    project_name?: string;
    project_path?: string;
    priority?: string;
    launch?: boolean;
    launch_profile?: QuorumAutopilotLaunchProfile | null;
  }
): Promise<QuorumSendToAutopilotResult> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/session/${encodePathSegment(sessionId)}/send-to-autopilot`,
    {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }
  );
}

export async function prepareQuorumTournamentFromSession(
  sessionId: string,
  provider?: string
): Promise<{ status: string; tournament: QuorumTournamentPreparation }> {
  return requestJson(
    `/api/shell/discovery/actions/orchestrate/session/${encodePathSegment(sessionId)}/tournament-preparation`,
    {
      method: "POST",
      body: JSON.stringify({ provider: provider ?? null }),
    }
  );
}

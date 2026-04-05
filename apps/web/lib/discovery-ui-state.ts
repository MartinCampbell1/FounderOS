import type {
  QuorumAutopilotLaunchPreset,
  QuorumExecutionBrief,
  QuorumSession,
} from "@founderos/api-clients";

type DiscoveryMutationLike = {
  brief?: QuorumExecutionBrief | null;
  handoffId?: string | null;
  nextSessionId?: string | null;
  data?: {
    brief?: QuorumExecutionBrief | null;
    handoffId?: string | null;
    nextSessionId?: string | null;
  } | null;
};

export function resolveDiscoveryLaunchPresetId(
  launchPresets: QuorumAutopilotLaunchPreset[],
  currentPresetId: string,
  sessionMode: string
) {
  if (launchPresets.some((preset) => preset.id === currentPresetId)) {
    return currentPresetId;
  }

  const recommended =
    sessionMode === "tournament" || sessionMode === "debate" ? "team" : "fast";
  if (launchPresets.some((preset) => preset.id === recommended)) {
    return recommended;
  }

  return launchPresets[0]?.id ?? recommended;
}

export function resolveDiscoverySessionActionState(session: QuorumSession) {
  const isRunning = ["running", "pause_requested", "cancel_requested"].includes(
    session.status
  );
  const isPaused = session.status === "paused";
  const isTerminal = ["completed", "failed", "cancelled"].includes(session.status);
  const canContinueConversation =
    session.runtime_state?.can_continue_conversation ??
    Boolean(session.current_checkpoint_id);
  const canRestart =
    session.runtime_state?.can_branch_from_checkpoint ??
    Boolean(session.current_checkpoint_id);
  const canQueueInstruction = session.runtime_state?.can_send_message ?? true;
  const canResume = session.runtime_state?.can_resume ?? true;
  const canCancel = session.runtime_state?.can_cancel ?? true;
  const showTournamentPrep = session.active_scenario === "portfolio_pivot_lab";

  return {
    canCancel,
    canContinueConversation,
    canQueueInstruction,
    canRestart,
    canResume,
    isPaused,
    isRunning,
    isTerminal,
    showTournamentPrep,
  };
}

export function resolveDiscoveryInboxEditFieldKey(subjectKind: string) {
  return subjectKind === "handoff" ? "prd_summary" : "summary";
}

export function resolveDiscoveryMutationBrief(
  effect?: DiscoveryMutationLike | null
) {
  return effect?.data?.brief ?? effect?.brief ?? null;
}

export function resolveDiscoveryMutationHandoffId(
  effect?: DiscoveryMutationLike | null
) {
  return effect?.data?.handoffId ?? effect?.handoffId ?? null;
}

export function resolveDiscoveryMutationNextSessionId(
  effect?: DiscoveryMutationLike | null
) {
  return effect?.data?.nextSessionId ?? effect?.nextSessionId ?? null;
}

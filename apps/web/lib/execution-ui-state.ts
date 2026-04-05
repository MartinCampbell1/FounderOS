import type {
  AutopilotCreateProjectResult,
  AutopilotIntakeResponse,
  AutopilotIntakeSessionDetail,
  AutopilotLaunchPreset,
  AutopilotPrd,
  AutopilotSpecBootstrap,
} from "@founderos/api-clients";

export type ExecutionIntakeMessageView = {
  role: "user" | "assistant";
  content: string;
};

export function resolveExecutionLaunchPresetId(
  launchPresets: AutopilotLaunchPreset[],
  currentPresetId: string,
  preferredPresetId: string
) {
  if (launchPresets.some((preset) => preset.id === currentPresetId)) {
    return currentPresetId;
  }

  if (launchPresets.some((preset) => preset.id === preferredPresetId)) {
    return preferredPresetId;
  }

  return launchPresets[0]?.id ?? preferredPresetId;
}

export function normalizeExecutionIntakeMessages(
  messages: Array<{ role: string; content: string }>
): ExecutionIntakeMessageView[] {
  return messages.flatMap((message) => {
    if (message.role === "user" || message.role === "assistant") {
      return [
        {
          role: message.role,
          content: message.content,
        },
      ];
    }
    return [];
  });
}

export function reconcileExecutionIntakeSessionDetail(
  detail: AutopilotIntakeSessionDetail | null,
  sessionError: string | null
) {
  if (!detail) {
    return {
      sessionId: null as string | null,
      messages: [] as ExecutionIntakeMessageView[],
      bootstrap: null as AutopilotSpecBootstrap | null,
      canGeneratePrd: false,
      prd: null as AutopilotPrd | null,
      linkedProjectId: "",
      linkedProjectName: "",
      sessionLoadError: sessionError,
    };
  }

  return {
    sessionId: detail.session_id,
    messages: normalizeExecutionIntakeMessages(detail.messages),
    bootstrap: detail.spec_bootstrap,
    canGeneratePrd: detail.can_generate_prd,
    prd: detail.prd,
    linkedProjectId: detail.linked_project_id || "",
    linkedProjectName: detail.linked_project_name || "",
    sessionLoadError: sessionError,
  };
}

export function reconcileExecutionIntakeResponse(
  response: AutopilotIntakeResponse,
  previousSessionId: string | null
) {
  return {
    sessionId: response.session_id,
    bootstrap: response.spec_bootstrap,
    canGeneratePrd: response.can_generate_prd,
    prd: response.prd_ready ? response.prd : null,
    linkedProjectId: response.session_id !== previousSessionId ? "" : null,
    linkedProjectName: response.session_id !== previousSessionId ? "" : null,
    assistantMessage: response.response.trim()
      ? {
          role: "assistant" as const,
          content: response.response,
        }
      : null,
  };
}

export function reconcileExecutionCreatedProject(
  createdProject: AutopilotCreateProjectResult,
  hasNavigationTarget: boolean
) {
  return {
    linkedProjectId: createdProject.project_id,
    linkedProjectName: createdProject.project_name,
    createdProjectId: hasNavigationTarget ? null : createdProject.project_id,
  };
}

export function resolveExecutionDraftValue(
  draftValue: string,
  fallbackValue?: string | null
) {
  return draftValue || (fallbackValue || "");
}

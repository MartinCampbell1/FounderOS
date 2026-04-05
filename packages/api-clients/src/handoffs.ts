export interface ExecutionBriefHandoff {
  id: string;
  source_plane: "discovery" | string;
  source_session_id?: string | null;
  brief_kind: "quorum_execution_brief" | "shared_execution_brief" | string;
  brief: Record<string, unknown>;
  default_project_name?: string | null;
  recommended_launch_preset_id?: string | null;
  launch_intent?: "create" | "launch" | string | null;
  created_at: string;
  expires_at: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

export async function createExecutionBriefHandoff(input: {
  sourcePlane: "discovery" | string;
  sourceSessionId?: string | null;
  briefKind: "quorum_execution_brief" | "shared_execution_brief" | string;
  brief: Record<string, unknown>;
  defaultProjectName?: string | null;
  recommendedLaunchPresetId?: string | null;
  launchIntent?: "create" | "launch" | string | null;
}): Promise<ExecutionBriefHandoff> {
  const payload = await requestJson<{ handoff: ExecutionBriefHandoff }>(
    `/api/shell/handoffs/execution-brief`,
    {
      method: "POST",
      body: JSON.stringify({
        source_plane: input.sourcePlane,
        source_session_id: input.sourceSessionId ?? null,
        brief_kind: input.briefKind,
        brief: input.brief,
        default_project_name: input.defaultProjectName ?? null,
        recommended_launch_preset_id: input.recommendedLaunchPresetId ?? null,
        launch_intent: input.launchIntent ?? null,
      }),
    }
  );
  return payload.handoff;
}

export async function fetchExecutionBriefHandoff(
  handoffId: string
): Promise<ExecutionBriefHandoff> {
  const payload = await requestJson<{ handoff: ExecutionBriefHandoff }>(
    `/api/shell/handoffs/execution-brief/${encodeURIComponent(handoffId)}`
  );
  return payload.handoff;
}

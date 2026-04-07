import type { AutopilotExecutionRuntimeAgentDetail } from "@founderos/api-clients";

export interface ShellExecutionAgentSnapshot {
  generatedAt: string;
  runtimeAgentId: string;
  agent: AutopilotExecutionRuntimeAgentDetail | null;
  agentError: string | null;
  agentLoadState: "ready" | "error";
}

export function emptyShellExecutionAgentSnapshot(): ShellExecutionAgentSnapshot {
  return {
    generatedAt: "",
    runtimeAgentId: "",
    agent: null,
    agentError: null,
    agentLoadState: "ready",
  };
}

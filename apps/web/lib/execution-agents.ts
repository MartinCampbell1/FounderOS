import type { AutopilotProjectSummary } from "@founderos/api-clients";

import { formatUpstreamErrorMessage, requestUpstreamJson } from "@/lib/upstream";

export interface ShellExecutionAgentsSnapshot {
  generatedAt: string;
  projects: AutopilotProjectSummary[];
  projectsError: string | null;
  projectsLoadState: "ready" | "error";
}

export function emptyShellExecutionAgentsSnapshot(): ShellExecutionAgentsSnapshot {
  return {
    generatedAt: "",
    projects: [],
    projectsError: null,
    projectsLoadState: "ready",
  };
}

export async function buildExecutionAgentsSnapshot(): Promise<ShellExecutionAgentsSnapshot> {
  const [projectsResult] = await Promise.allSettled([
    requestUpstreamJson<{ projects: AutopilotProjectSummary[] }>("autopilot", "projects/"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    projects:
      projectsResult.status === "fulfilled" ? projectsResult.value.projects : [],
    projectsError:
      projectsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Autopilot projects", projectsResult.reason),
    projectsLoadState: projectsResult.status === "fulfilled" ? "ready" : "error",
  };
}

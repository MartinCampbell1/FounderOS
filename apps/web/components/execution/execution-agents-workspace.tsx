"use client";

import type { AutopilotProjectSummary } from "@founderos/api-clients";
import { Badge } from "@founderos/ui/components/badge";
import { Bot } from "lucide-react";
import { useCallback } from "react";

import type { ShellExecutionAgentsSnapshot } from "@/lib/execution-agents";
import { emptyShellExecutionAgentsSnapshot } from "@/lib/execution-agents";
import { fetchShellExecutionAgentsSnapshot } from "@/lib/shell-snapshot-client";
import {
  getShellPollInterval,
  useShellPreferences,
} from "@/lib/shell-preferences";
import { useShellManualRefresh } from "@/lib/use-shell-manual-refresh";
import { useShellPolledSnapshot } from "@/lib/use-shell-polled-snapshot";
import {
  ShellEmptyState,
  ShellHero,
  ShellPage,
  ShellRefreshButton,
  ShellSectionCard,
  ShellStatusBanner,
} from "@/components/shell/shell-screen-primitives";

const EMPTY_AGENTS_SNAPSHOT: ShellExecutionAgentsSnapshot =
  emptyShellExecutionAgentsSnapshot();

function statusBadgeTone(
  status: string
): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "running") return "success";
  if (status === "paused") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

function AgentRow({ project }: { project: AutopilotProjectSummary }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium text-foreground">
          {project.name}
        </span>
        {project.runtime_session_id ? (
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {project.runtime_session_id}
          </span>
        ) : null}
        {project.last_message ? (
          <span className="line-clamp-1 text-[12px] text-muted-foreground">
            {project.last_message}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={statusBadgeTone(project.status)}>
          {project.status}
        </Badge>
      </div>
    </div>
  );
}

export function ExecutionAgentsWorkspace() {
  const { preferences } = useShellPreferences();
  const pollIntervalMs = getShellPollInterval(
    "execution_projects",
    preferences.refreshProfile
  );

  const { isRefreshing, refresh, refreshNonce } = useShellManualRefresh();

  const loadSnapshot = useCallback(
    () => fetchShellExecutionAgentsSnapshot(),
    []
  );

  const selectLoadState = useCallback(
    (snapshot: ShellExecutionAgentsSnapshot) => snapshot.projectsLoadState,
    []
  );

  const { loadState, snapshot } = useShellPolledSnapshot({
    emptySnapshot: EMPTY_AGENTS_SNAPSHOT,
    refreshNonce,
    pollIntervalMs,
    loadSnapshot,
    selectLoadState,
  });

  const activeProjects = snapshot.projects.filter(
    (p) => p.status === "running" && !p.archived
  );

  return (
    <ShellPage>
      <ShellHero
        title="Agents"
        description="Active agent runtimes across all execution projects."
        actions={
          <ShellRefreshButton
            busy={isRefreshing || loadState === "loading"}
            onClick={refresh}
            compact
          />
        }
      />

      {snapshot.projectsError ? (
        <ShellStatusBanner tone="danger">{snapshot.projectsError}</ShellStatusBanner>
      ) : null}

      {loadState !== "loading" && activeProjects.length === 0 ? (
        <ShellEmptyState
          icon={<Bot className="h-5 w-5" />}
          title="No active agents"
          description="Agents start running when execution projects are launched."
        />
      ) : null}

      {activeProjects.length > 0 ? (
        <ShellSectionCard title="Running agents">
          <div className="divide-y divide-border">
            {activeProjects.map((project) => (
              <AgentRow key={project.id} project={project} />
            ))}
          </div>
        </ShellSectionCard>
      ) : null}
    </ShellPage>
  );
}

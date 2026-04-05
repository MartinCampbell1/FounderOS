export type ShellRefreshProfile = "focused" | "balanced" | "minimal";

export type ShellReviewLane =
  | "all"
  | "discovery"
  | "execution"
  | "authoring"
  | "trace"
  | "handoff"
  | "followthrough"
  | "issues"
  | "approvals"
  | "runtimes"
  | "decisions"
  | "critical"
  | "linked"
  | "intake";

export type ShellReviewPreset =
  | "discovery-pass"
  | "critical-pass"
  | "decision-pass"
  | "chain-pass";

export type ShellReviewMemoryBucket =
  | "global"
  | "linked"
  | "intakeLinked"
  | "orphanProject";

export interface ShellReviewPassPreference {
  lane: ShellReviewLane;
  preset: ShellReviewPreset | null;
}

export interface ShellReviewMemoryPreferences {
  global: ShellReviewPassPreference;
  linked: ShellReviewPassPreference;
  intakeLinked: ShellReviewPassPreference;
  orphanProject: ShellReviewPassPreference;
}

export interface ShellPreferences {
  refreshProfile: ShellRefreshProfile;
  sidebarCollapsed: boolean;
  reviewMemory: ShellReviewMemoryPreferences;
}

export type ShellPollSurface =
  | "health_strip"
  | "dashboard"
  | "review_center"
  | "inbox"
  | "portfolio"
  | "settings"
  | "discovery_authoring_queue"
  | "discovery_review"
  | "discovery_board"
  | "discovery_archive"
  | "discovery_finals"
  | "discovery_trace"
  | "discovery_replay"
  | "discovery_sessions"
  | "discovery_session_detail"
  | "discovery_ideas"
  | "discovery_authoring"
  | "discovery_dossier"
  | "execution_projects"
  | "execution_review"
  | "execution_project_detail";

export type ShellPreferencesSource = "cookie" | "default";

export interface ShellPollIntervalRecord {
  surface: ShellPollSurface;
  label: string;
  intervalMs: number;
}

export interface ShellOperatorPreferencesSnapshot {
  generatedAt: string;
  source: ShellPreferencesSource;
  preferences: ShellPreferences;
  intervals: ShellPollIntervalRecord[];
}

export async function fetchShellOperatorPreferences(
  input: RequestInfo | URL = "/api/shell/operator-preferences",
  init?: RequestInit
): Promise<ShellOperatorPreferencesSnapshot> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Operator preferences request failed: ${response.status}`);
  }

  return (await response.json()) as ShellOperatorPreferencesSnapshot;
}

export async function updateShellOperatorPreferences(
  patch: Partial<ShellPreferences>,
  input: RequestInfo | URL = "/api/shell/operator-preferences",
  init?: RequestInit
): Promise<ShellOperatorPreferencesSnapshot> {
  const response = await fetch(input, {
    ...init,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Operator preferences update failed: ${response.status}`);
  }

  return (await response.json()) as ShellOperatorPreferencesSnapshot;
}

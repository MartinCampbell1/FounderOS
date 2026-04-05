import type {
  ShellOperatorPreferencesSnapshot,
  ShellPollSurface,
  ShellPreferences,
  ShellPreferencesSource,
  ShellRefreshProfile,
  ShellReviewLane,
  ShellReviewMemoryBucket,
  ShellReviewMemoryPreferences,
  ShellReviewPassPreference,
  ShellReviewPreset,
} from "@founderos/api-clients";

export const DEFAULT_SHELL_REVIEW_PASS_PREFERENCES: Record<
  ShellReviewMemoryBucket,
  ShellReviewPassPreference
> = {
  global: {
    lane: "all",
    preset: null,
  },
  linked: {
    lane: "linked",
    preset: "chain-pass",
  },
  intakeLinked: {
    lane: "intake",
    preset: "decision-pass",
  },
  orphanProject: {
    lane: "execution",
    preset: "critical-pass",
  },
};

export const DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES: ShellReviewMemoryPreferences = {
  global: DEFAULT_SHELL_REVIEW_PASS_PREFERENCES.global,
  linked: DEFAULT_SHELL_REVIEW_PASS_PREFERENCES.linked,
  intakeLinked: DEFAULT_SHELL_REVIEW_PASS_PREFERENCES.intakeLinked,
  orphanProject: DEFAULT_SHELL_REVIEW_PASS_PREFERENCES.orphanProject,
};

export const DEFAULT_SHELL_PREFERENCES: ShellPreferences = {
  refreshProfile: "balanced",
  sidebarCollapsed: false,
  reviewMemory: DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES,
};

export const SHELL_REFRESH_PROFILE_OPTIONS: Array<{
  value: ShellRefreshProfile;
  label: string;
  detail: string;
}> = [
  {
    value: "focused",
    label: "Focused",
    detail: "Faster refresh cadence for active operator sessions.",
  },
  {
    value: "balanced",
    label: "Balanced",
    detail: "Current default shell polling profile.",
  },
  {
    value: "minimal",
    label: "Minimal",
    detail: "Longer polling intervals for lighter background monitoring.",
  },
];

export const SHELL_PREFERENCES_STORAGE_KEY = "founderos-shell-preferences";
export const SHELL_PREFERENCES_CHANGE_EVENT = "founderos-shell-preferences-change";
export const SHELL_PREFERENCES_COOKIE_NAME = "founderos-shell-preferences";

export const SHELL_POLL_INTERVALS: Record<
  ShellPollSurface,
  Record<ShellRefreshProfile, number>
> = {
  health_strip: {
    focused: 8000,
    balanced: 15000,
    minimal: 30000,
  },
  dashboard: {
    focused: 10000,
    balanced: 15000,
    minimal: 30000,
  },
  review_center: {
    focused: 8000,
    balanced: 12000,
    minimal: 24000,
  },
  inbox: {
    focused: 8000,
    balanced: 12000,
    minimal: 24000,
  },
  portfolio: {
    focused: 10000,
    balanced: 15000,
    minimal: 30000,
  },
  settings: {
    focused: 12000,
    balanced: 20000,
    minimal: 40000,
  },
  discovery_authoring_queue: {
    focused: 10000,
    balanced: 15000,
    minimal: 30000,
  },
  discovery_review: {
    focused: 10000,
    balanced: 15000,
    minimal: 30000,
  },
  discovery_board: {
    focused: 8000,
    balanced: 12000,
    minimal: 24000,
  },
  discovery_archive: {
    focused: 10000,
    balanced: 15000,
    minimal: 30000,
  },
  discovery_finals: {
    focused: 10000,
    balanced: 15000,
    minimal: 30000,
  },
  discovery_trace: {
    focused: 8000,
    balanced: 12000,
    minimal: 24000,
  },
  discovery_replay: {
    focused: 4000,
    balanced: 8000,
    minimal: 16000,
  },
  discovery_sessions: {
    focused: 3000,
    balanced: 5000,
    minimal: 10000,
  },
  discovery_session_detail: {
    focused: 2500,
    balanced: 4000,
    minimal: 8000,
  },
  discovery_ideas: {
    focused: 8000,
    balanced: 15000,
    minimal: 30000,
  },
  discovery_authoring: {
    focused: 8000,
    balanced: 12000,
    minimal: 24000,
  },
  discovery_dossier: {
    focused: 8000,
    balanced: 15000,
    minimal: 30000,
  },
  execution_projects: {
    focused: 5000,
    balanced: 8000,
    minimal: 16000,
  },
  execution_review: {
    focused: 5000,
    balanced: 8000,
    minimal: 16000,
  },
  execution_project_detail: {
    focused: 4000,
    balanced: 8000,
    minimal: 16000,
  },
};

export const SHELL_POLL_SURFACE_LABELS: Record<ShellPollSurface, string> = {
  health_strip: "Gateway health",
  dashboard: "Dashboard",
  review_center: "Unified review",
  inbox: "Inbox",
  portfolio: "Portfolio",
  settings: "Settings",
  discovery_authoring_queue: "Discovery authoring queue",
  discovery_review: "Discovery review",
  discovery_board: "Discovery board",
  discovery_archive: "Discovery archive",
  discovery_finals: "Discovery finals",
  discovery_trace: "Discovery traces",
  discovery_replay: "Discovery replay",
  discovery_sessions: "Discovery sessions",
  discovery_session_detail: "Discovery detail",
  discovery_ideas: "Discovery ideas",
  discovery_authoring: "Discovery authoring",
  discovery_dossier: "Discovery dossier",
  execution_projects: "Execution projects",
  execution_review: "Execution review",
  execution_project_detail: "Execution detail",
};

const SHELL_POLL_SURFACE_ORDER: ShellPollSurface[] = [
  "health_strip",
  "dashboard",
  "review_center",
  "inbox",
  "portfolio",
  "settings",
  "discovery_authoring_queue",
  "discovery_review",
  "discovery_board",
  "discovery_archive",
  "discovery_finals",
  "discovery_trace",
  "discovery_replay",
  "discovery_sessions",
  "discovery_session_detail",
  "discovery_ideas",
  "discovery_authoring",
  "discovery_dossier",
  "execution_projects",
  "execution_review",
  "execution_project_detail",
];

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isShellRefreshProfile(value: unknown): value is ShellRefreshProfile {
  return value === "focused" || value === "balanced" || value === "minimal";
}

export function isShellReviewLane(value: unknown): value is ShellReviewLane {
  return (
    value === "all" ||
    value === "discovery" ||
    value === "execution" ||
    value === "authoring" ||
    value === "trace" ||
    value === "handoff" ||
    value === "followthrough" ||
    value === "issues" ||
    value === "approvals" ||
    value === "runtimes" ||
    value === "decisions" ||
    value === "critical" ||
    value === "linked" ||
    value === "intake"
  );
}

export function isShellReviewPreset(value: unknown): value is ShellReviewPreset {
  return (
    value === "discovery-pass" ||
    value === "critical-pass" ||
    value === "decision-pass" ||
    value === "chain-pass"
  );
}

export function normalizeShellReviewPassPreference(
  input: Partial<ShellReviewPassPreference> | null | undefined,
  fallback: ShellReviewPassPreference
): ShellReviewPassPreference {
  return {
    lane: isShellReviewLane(input?.lane) ? input.lane : fallback.lane,
    preset:
      input?.preset === null
        ? null
        : isShellReviewPreset(input?.preset)
          ? input.preset
          : fallback.preset,
  };
}

export function normalizeShellReviewMemoryPreferences(
  input: Partial<ShellReviewMemoryPreferences> | null | undefined
): ShellReviewMemoryPreferences {
  return {
    global: normalizeShellReviewPassPreference(
      input?.global,
      DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES.global
    ),
    linked: normalizeShellReviewPassPreference(
      input?.linked,
      DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES.linked
    ),
    intakeLinked: normalizeShellReviewPassPreference(
      input?.intakeLinked,
      DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES.intakeLinked
    ),
    orphanProject: normalizeShellReviewPassPreference(
      input?.orphanProject,
      DEFAULT_SHELL_REVIEW_MEMORY_PREFERENCES.orphanProject
    ),
  };
}

export function normalizeShellPreferences(
  input: Partial<ShellPreferences> | null | undefined
): ShellPreferences {
  return {
    refreshProfile: isShellRefreshProfile(input?.refreshProfile)
      ? input.refreshProfile
      : DEFAULT_SHELL_PREFERENCES.refreshProfile,
    sidebarCollapsed:
      typeof input?.sidebarCollapsed === "boolean"
        ? input.sidebarCollapsed
        : DEFAULT_SHELL_PREFERENCES.sidebarCollapsed,
    reviewMemory: normalizeShellReviewMemoryPreferences(input?.reviewMemory),
  };
}

export function getShellPollInterval(
  surface: ShellPollSurface,
  refreshProfile: ShellRefreshProfile
) {
  return SHELL_POLL_INTERVALS[surface][refreshProfile];
}

export function serializeShellPreferencesCookie(preferences: ShellPreferences) {
  return encodeURIComponent(JSON.stringify(normalizeShellPreferences(preferences)));
}

export function parseShellPreferencesCookie(raw: string | null | undefined): {
  source: ShellPreferencesSource;
  preferences: ShellPreferences;
} {
  if (!raw) {
    return {
      source: "default",
      preferences: DEFAULT_SHELL_PREFERENCES,
    };
  }

  const decoded = decodeCookieValue(raw);

  if (decoded.startsWith("{")) {
    try {
      return {
        source: "cookie",
        preferences: normalizeShellPreferences(
          JSON.parse(decoded) as Partial<ShellPreferences>
        ),
      };
    } catch {
      return {
        source: "default",
        preferences: DEFAULT_SHELL_PREFERENCES,
      };
    }
  }

  const [refreshProfile, sidebarCollapsed] = decoded.split(":");
  if (!isShellRefreshProfile(refreshProfile)) {
    return {
      source: "default",
      preferences: DEFAULT_SHELL_PREFERENCES,
    };
  }

  return {
    source: "cookie",
    preferences: normalizeShellPreferences({
      refreshProfile,
      sidebarCollapsed:
        sidebarCollapsed === "1"
          ? true
          : sidebarCollapsed === "0"
            ? false
            : undefined,
    }),
  };
}

export function buildShellOperatorPreferencesSnapshot(
  preferences: ShellPreferences,
  source: ShellPreferencesSource,
  generatedAt = new Date().toISOString()
): ShellOperatorPreferencesSnapshot {
  return {
    generatedAt,
    source,
    preferences,
    intervals: SHELL_POLL_SURFACE_ORDER.map((surface) => ({
      surface,
      label: SHELL_POLL_SURFACE_LABELS[surface],
      intervalMs: getShellPollInterval(surface, preferences.refreshProfile),
    })),
  };
}

export function resolveShellOperatorPreferencesSnapshot(
  raw: string | null | undefined,
  generatedAt = new Date().toISOString()
) {
  const { source, preferences } = parseShellPreferencesCookie(raw);
  return buildShellOperatorPreferencesSnapshot(preferences, source, generatedAt);
}

export function buildShellPreferencesBootstrapScript() {
  const storageKey = JSON.stringify(SHELL_PREFERENCES_STORAGE_KEY);
  const cookieName = JSON.stringify(SHELL_PREFERENCES_COOKIE_NAME);
  const defaultCollapsed = DEFAULT_SHELL_PREFERENCES.sidebarCollapsed ? "true" : "false";

  return `(() => {
  const root = document.documentElement;
  const storageKey = ${storageKey};
  const cookieName = ${cookieName};
  let sidebarCollapsed = ${defaultCollapsed};

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.sidebarCollapsed === "boolean") {
        sidebarCollapsed = parsed.sidebarCollapsed;
      }
    } else {
      const prefix = cookieName + "=";
      const cookieEntry = document.cookie
        .split("; ")
        .find((entry) => entry.indexOf(prefix) === 0);

      if (cookieEntry) {
        const encoded = cookieEntry.slice(prefix.length);
        const decoded = decodeURIComponent(encoded);
        if (decoded.startsWith("{")) {
          const parsed = JSON.parse(decoded);
          if (typeof parsed?.sidebarCollapsed === "boolean") {
            sidebarCollapsed = parsed.sidebarCollapsed;
          }
        } else {
          const parts = decoded.split(":");
          if (parts[1] === "1") {
            sidebarCollapsed = true;
          } else if (parts[1] === "0") {
            sidebarCollapsed = false;
          }
        }
      }
    }
  } catch (_error) {
    sidebarCollapsed = ${defaultCollapsed};
  }

  root.dataset.shellSidebarCollapsed = sidebarCollapsed ? "true" : "false";
})();`;
}

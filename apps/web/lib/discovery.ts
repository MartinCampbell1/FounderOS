import type {
  QuorumAutopilotLaunchPreset,
  QuorumDiscoveryIdea,
  QuorumIdeaDossier,
  QuorumSession,
  QuorumSessionEvent,
  QuorumSessionSummary,
} from "@founderos/api-clients";
import type { LinkedShellChainRecord, ShellChainGraphStats } from "@/lib/chain-graph";

import { buildShellChainGraphStats } from "@/lib/chain-graph";
import { loadShellChainGraphSnapshotData } from "@/lib/chain-graph-data";
import {
  buildUpstreamQuery,
  formatUpstreamErrorMessage,
  requestUpstreamJson,
} from "@/lib/upstream";

export interface ShellDiscoverySessionsSnapshot {
  generatedAt: string;
  sessions: QuorumSessionSummary[];
  sessionsError: string | null;
  sessionsLoadState: "ready" | "error";
  linkedIdeas: LinkedShellChainRecord[];
  chainStats: ShellChainGraphStats;
  chainsError: string | null;
  chainsLoadState: "ready" | "error";
  launchPresets: QuorumAutopilotLaunchPreset[];
  launchPresetsError: string | null;
  launchPresetsLoadState: "ready" | "error";
  session: QuorumSession | null;
  events: QuorumSessionEvent[];
  sessionError: string | null;
  sessionLoadState: "idle" | "ready" | "error";
}

export interface ShellDiscoveryIdeasSnapshot {
  generatedAt: string;
  ideas: QuorumDiscoveryIdea[];
  ideasError: string | null;
  ideasLoadState: "ready" | "error";
  chains: LinkedShellChainRecord[];
  chainsError: string | null;
  chainsLoadState: "ready" | "error";
  dossier: QuorumIdeaDossier | null;
  dossierError: string | null;
  dossierLoadState: "idle" | "ready" | "error";
}

function sortSessions(items: QuorumSessionSummary[]) {
  return [...items].sort((left, right) => right.created_at - left.created_at);
}

function sortIdeas(items: QuorumDiscoveryIdea[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || "") || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || "") || 0;
    return rightTime - leftTime;
  });
}

function sortEvents(items: QuorumSessionEvent[]) {
  return [...items].sort((left, right) => left.id - right.id);
}

export function emptyShellDiscoverySessionsSnapshot(): ShellDiscoverySessionsSnapshot {
  return {
    generatedAt: "",
    sessions: [],
    sessionsError: null,
    sessionsLoadState: "ready",
    linkedIdeas: [],
    chainStats: {
      activeExecutionCount: 0,
      authoringGapCount: 0,
      authoringReadyCount: 0,
      brokenIntakeCount: 0,
      chainsWithAttentionCount: 0,
      intakeLinkedCount: 0,
      linkedCount: 0,
      orphanCount: 0,
      validatedCount: 0,
    },
    chainsError: null,
    chainsLoadState: "ready",
    launchPresets: [],
    launchPresetsError: null,
    launchPresetsLoadState: "ready",
    session: null,
    events: [],
    sessionError: null,
    sessionLoadState: "idle",
  };
}

export function emptyShellDiscoveryIdeasSnapshot(): ShellDiscoveryIdeasSnapshot {
  return {
    generatedAt: "",
    ideas: [],
    ideasError: null,
    ideasLoadState: "ready",
    chains: [],
    chainsError: null,
    chainsLoadState: "ready",
    dossier: null,
    dossierError: null,
    dossierLoadState: "idle",
  };
}

export async function buildDiscoverySessionsSnapshot(
  sessionId: string | null
): Promise<ShellDiscoverySessionsSnapshot> {
  const [sessionsResult, chainDataResult, launchPresetsResult, sessionResult] =
    await Promise.allSettled([
      requestUpstreamJson<QuorumSessionSummary[]>("quorum", "orchestrate/sessions"),
      loadShellChainGraphSnapshotData({
        discoveryIdeaLimit: 24,
        includeArchivedProjects: true,
      }),
      requestUpstreamJson<{ launch_presets: QuorumAutopilotLaunchPreset[] }>(
        "quorum",
        "orchestrate/autopilot/launch-presets"
      ),
      sessionId
        ? requestUpstreamJson<QuorumSession>(
            "quorum",
            `orchestrate/session/${encodeURIComponent(sessionId)}`
          )
        : Promise.resolve(null),
    ]);
  const chainData = chainDataResult.status === "fulfilled" ? chainDataResult.value : null;
  const linkedIdeas =
    chainData?.chains.filter(
      (record): record is LinkedShellChainRecord => record.kind === "linked"
    ) ?? [];
  const chainStats = buildShellChainGraphStats(chainData?.chains ?? []);
  const chainsError =
    chainDataResult.status === "fulfilled"
      ? chainData && chainData.errors.length > 0
        ? chainData.errors.join(" ")
        : null
      : formatUpstreamErrorMessage("Discovery chain graph", chainDataResult.reason);
  const chainsLoadState =
    chainDataResult.status === "fulfilled" && chainData
      ? chainData.loadState
      : "error";

  return {
    generatedAt: new Date().toISOString(),
    sessions:
      sessionsResult.status === "fulfilled" ? sortSessions(sessionsResult.value) : [],
    sessionsError:
      sessionsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Quorum sessions", sessionsResult.reason),
    sessionsLoadState: sessionsResult.status === "fulfilled" ? "ready" : "error",
    linkedIdeas,
    chainStats,
    chainsError,
    chainsLoadState,
    launchPresets:
      launchPresetsResult.status === "fulfilled"
        ? launchPresetsResult.value.launch_presets
        : [],
    launchPresetsError:
      launchPresetsResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage(
            "Quorum launch presets",
            launchPresetsResult.reason
          ),
    launchPresetsLoadState:
      launchPresetsResult.status === "fulfilled" ? "ready" : "error",
    session:
      sessionResult.status === "fulfilled" && sessionResult.value
        ? sessionResult.value
        : null,
    events:
      sessionResult.status === "fulfilled" && sessionResult.value
        ? sortEvents(sessionResult.value.events ?? [])
        : [],
    sessionError:
      sessionResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Quorum session", sessionResult.reason),
    sessionLoadState:
      !sessionId ? "idle" : sessionResult.status === "fulfilled" ? "ready" : "error",
  };
}

export async function buildDiscoveryIdeasSnapshot(
  ideaId: string | null,
  options?: {
    limit?: number | null;
  }
): Promise<ShellDiscoveryIdeasSnapshot> {
  const limit =
    typeof options?.limit === "number"
      ? Math.max(1, Math.min(Math.trunc(options.limit), 500))
      : null;
  const [ideasResult, chainDataResult, dossierResult] = await Promise.allSettled([
    requestUpstreamJson<{ ideas: QuorumDiscoveryIdea[] }>(
      "quorum",
      "orchestrate/discovery/ideas",
      buildUpstreamQuery({ limit })
    ),
    loadShellChainGraphSnapshotData({
      discoveryIdeaLimit: limit ?? 100,
      includeArchivedProjects: true,
    }),
    ideaId
      ? requestUpstreamJson<QuorumIdeaDossier>(
          "quorum",
          `orchestrate/discovery/ideas/${encodeURIComponent(ideaId)}/dossier`
        )
      : Promise.resolve(null),
  ]);
  const ideas =
    ideasResult.status === "fulfilled" ? sortIdeas(ideasResult.value.ideas) : [];
  const linkedIdeaIds = new Set(ideas.map((idea) => idea.idea_id));
  const chainData =
    chainDataResult.status === "fulfilled"
      ? chainDataResult.value
      : null;
  const chains =
    chainData?.chains.filter(
      (record): record is LinkedShellChainRecord =>
        record.kind === "linked" && linkedIdeaIds.has(record.idea.idea_id)
      ) ?? [];
  const chainsError =
    chainDataResult.status === "fulfilled"
      ? chainData && chainData.errors.length > 0
        ? chainData.errors.join(" ")
        : null
      : formatUpstreamErrorMessage("Discovery chain graph", chainDataResult.reason);
  const chainsLoadState =
    chainDataResult.status === "fulfilled" && chainData
      ? chainData.loadState
      : "error";

  return {
    generatedAt: new Date().toISOString(),
    ideas,
    ideasError:
      ideasResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Discovery ideas", ideasResult.reason),
    ideasLoadState: ideasResult.status === "fulfilled" ? "ready" : "error",
    chains,
    chainsError,
    chainsLoadState,
    dossier:
      dossierResult.status === "fulfilled" && dossierResult.value
        ? dossierResult.value
        : null,
    dossierError:
      dossierResult.status === "fulfilled"
        ? null
        : formatUpstreamErrorMessage("Discovery dossier", dossierResult.reason),
    dossierLoadState:
      !ideaId ? "idle" : dossierResult.status === "fulfilled" ? "ready" : "error",
  };
}

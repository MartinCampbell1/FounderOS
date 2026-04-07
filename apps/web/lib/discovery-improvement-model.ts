import type {
  QuorumPromptEvolutionProfile,
  QuorumPromptSelfPlayMatch,
  QuorumReflectiveEvalReport,
} from "@founderos/api-clients";

export interface ShellDiscoveryImprovementSnapshot {
  generatedAt: string;
  profiles: QuorumPromptEvolutionProfile[];
  profilesError: string | null;
  profilesLoadState: "ready" | "error";
  reflections: QuorumReflectiveEvalReport[];
  reflectionsError: string | null;
  reflectionsLoadState: "ready" | "error";
  matches: QuorumPromptSelfPlayMatch[];
  matchesError: string | null;
  matchesLoadState: "ready" | "error";
  selectedProfileId: string | null;
  selectedProfile: QuorumPromptEvolutionProfile | null;
  selectedProfileError: string | null;
  selectedProfileLoadState: "idle" | "ready" | "error";
}

export function emptyShellDiscoveryImprovementSnapshot(): ShellDiscoveryImprovementSnapshot {
  return {
    generatedAt: "",
    profiles: [],
    profilesError: null,
    profilesLoadState: "ready",
    reflections: [],
    reflectionsError: null,
    reflectionsLoadState: "ready",
    matches: [],
    matchesError: null,
    matchesLoadState: "ready",
    selectedProfileId: null,
    selectedProfile: null,
    selectedProfileError: null,
    selectedProfileLoadState: "idle",
  };
}

export interface ShellParityTargetRecord {
  key: "project" | "intakeSession" | "discoverySession" | "discoveryIdea";
  label: string;
  value: string;
  available: boolean;
  source: string;
  shellSurfaceHref: string;
}

export interface ShellParityTargetCoverage {
  chosenCandidateKind: "chain" | "fallback" | "none";
  chosenCandidateScore: number;
  candidateCount: number;
  linkedChainCandidateCount: number;
  completeLinkedChainCount: number;
  completeLinkedScenarioVariantCount: number;
  completeLinkedScenarioLabels: string[];
  projectCandidateCount: number;
  intakeCandidateCount: number;
  discoverySessionCandidateCount: number;
  discoveryIdeaCandidateCount: number;
  operatorAttentionChainCount: number;
  cleanExecutionChainCount: number;
  pausedProjectChainCount: number;
  idleProjectChainCount: number;
  founderCommittedChainCount: number;
  founderReviewChainCount: number;
}

export interface ShellParityTargetsSnapshot {
  generatedAt: string;
  routeScope: {
    projectId: string;
    intakeSessionId: string;
  };
  parityTargets: {
    discoverySessionId: string;
    discoveryIdeaId: string;
  };
  records: ShellParityTargetRecord[];
  coverage: ShellParityTargetCoverage;
  errors: string[];
  loadState: "ready" | "error";
}

export async function fetchShellParityTargetsSnapshot(
  input: RequestInfo | URL = "/api/shell/parity-targets",
  init?: RequestInit
): Promise<ShellParityTargetsSnapshot> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shell parity targets request failed: ${response.status}`);
  }

  return (await response.json()) as ShellParityTargetsSnapshot;
}

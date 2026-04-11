import type { ExecutionBriefHandoff } from "@founderos/api-clients";

export interface ShellExecutionHandoffsSnapshot {
  generatedAt: string;
  handoffs: ExecutionBriefHandoff[];
  handoffsError: string | null;
  handoffsLoadState: "ready" | "error";
}

export function emptyShellExecutionHandoffsSnapshot(): ShellExecutionHandoffsSnapshot {
  return {
    generatedAt: "",
    handoffs: [],
    handoffsError: null,
    handoffsLoadState: "ready",
  };
}

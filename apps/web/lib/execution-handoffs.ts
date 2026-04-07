import { listExecutionBriefHandoffs } from "@/lib/execution-brief-handoffs";
import type { ShellExecutionHandoffsSnapshot } from "@/lib/execution-handoffs-model";

export async function buildExecutionHandoffsSnapshot(): Promise<ShellExecutionHandoffsSnapshot> {
  try {
    return {
      generatedAt: new Date().toISOString(),
      handoffs: listExecutionBriefHandoffs(),
      handoffsError: null,
      handoffsLoadState: "ready",
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      handoffs: [],
      handoffsError:
        error instanceof Error
          ? `Execution handoffs: ${error.message}`
          : "Execution handoffs: request failed.",
      handoffsLoadState: "error",
    };
  }
}

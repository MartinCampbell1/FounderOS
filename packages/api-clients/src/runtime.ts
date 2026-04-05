import type { GatewayHealthSnapshot } from "./health";
import type { ShellSettingsSnapshot } from "./settings";

export interface ShellRuntimeSnapshot {
  generatedAt: string;
  settings: ShellSettingsSnapshot | null;
  health: GatewayHealthSnapshot | null;
  errors: string[];
  loadState: "ready" | "error";
}

export async function fetchShellRuntimeSnapshot(
  input: RequestInfo | URL = "/api/shell/runtime",
  init?: RequestInit
): Promise<ShellRuntimeSnapshot> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shell runtime request failed: ${response.status}`);
  }

  return (await response.json()) as ShellRuntimeSnapshot;
}

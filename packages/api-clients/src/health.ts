export interface UpstreamHealthRecord {
  status: "ok" | "degraded" | "offline";
  label: string;
  baseUrl: string;
  details?: string;
  latencyMs?: number;
}

export interface GatewayHealthSnapshot {
  status: "ok" | "degraded";
  generatedAt: string;
  services: {
    quorum: UpstreamHealthRecord;
    autopilot: UpstreamHealthRecord;
  };
}

export async function fetchGatewayHealth(
  input: RequestInfo | URL = "/api/shell/runtime",
  init?: RequestInit
): Promise<GatewayHealthSnapshot> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Health request failed: ${response.status}`);
  }

  const payload = (await response.json()) as
    | GatewayHealthSnapshot
    | { health: GatewayHealthSnapshot | null };

  if ("health" in payload) {
    if (!payload.health) {
      throw new Error("Shell runtime did not include a health snapshot.");
    }
    return payload.health;
  }

  return payload;
}

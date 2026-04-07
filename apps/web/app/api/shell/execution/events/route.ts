import { NextResponse } from "next/server";

import { buildExecutionEventsSnapshot } from "@/lib/execution-events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const snapshot = await buildExecutionEventsSnapshot({
    projectId: url.searchParams.get("project_id"),
    initiativeId: url.searchParams.get("initiative_id"),
    orchestrator: url.searchParams.get("orchestrator"),
    runtimeAgentId: url.searchParams.get("runtime_agent_id"),
    orchestratorSessionId: url.searchParams.get("orchestrator_session_id"),
    limit: Number(url.searchParams.get("limit") ?? 250) || 250,
  });

  return NextResponse.json(snapshot);
}

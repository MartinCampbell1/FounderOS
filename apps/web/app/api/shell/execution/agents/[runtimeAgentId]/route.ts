import { NextResponse } from "next/server";

import { buildExecutionAgentSnapshot } from "@/lib/execution-agent";

export const dynamic = "force-dynamic";

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ runtimeAgentId: string }> }
) {
  const { runtimeAgentId: rawRuntimeAgentId } = await context.params;
  const runtimeAgentId = decodeRouteParam(rawRuntimeAgentId);
  const url = new URL(request.url);
  const eventLimit = Number(url.searchParams.get("event_limit") ?? 200) || 200;
  const snapshot = await buildExecutionAgentSnapshot(runtimeAgentId, {
    eventLimit,
  });

  return NextResponse.json(snapshot);
}

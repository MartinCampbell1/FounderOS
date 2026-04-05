import { NextResponse } from "next/server";

import { buildExecutionIntakeSnapshot } from "@/lib/execution";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const snapshot = await buildExecutionIntakeSnapshot(sessionId);
  return NextResponse.json(snapshot);
}

import { NextRequest, NextResponse } from "next/server";

import { buildDiscoveryReplaySnapshot } from "@/lib/discovery-history";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const snapshot = await buildDiscoveryReplaySnapshot(sessionId);
  return NextResponse.json(snapshot);
}

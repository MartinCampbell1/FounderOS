import { NextRequest, NextResponse } from "next/server";

import { buildDiscoverySimulationSnapshot } from "@/lib/discovery-board-detail";

export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get("ideaId");
  const snapshot = await buildDiscoverySimulationSnapshot(ideaId);
  return NextResponse.json(snapshot);
}

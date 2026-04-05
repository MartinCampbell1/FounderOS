import { NextRequest, NextResponse } from "next/server";

import { buildDiscoveryTracesSnapshot } from "@/lib/discovery-history";

export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get("ideaId");
  const snapshot = await buildDiscoveryTracesSnapshot(ideaId);
  return NextResponse.json(snapshot);
}

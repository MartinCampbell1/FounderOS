import { NextResponse } from "next/server";

import { buildDiscoverySessionsSnapshot } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const snapshot = await buildDiscoverySessionsSnapshot(sessionId);
  return NextResponse.json(snapshot);
}

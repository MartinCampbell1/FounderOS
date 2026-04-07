import { NextResponse } from "next/server";

import { buildDiscoveryIntelligenceSnapshot } from "@/lib/discovery-intelligence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get("profileId");
  const snapshot = await buildDiscoveryIntelligenceSnapshot(profileId);
  return NextResponse.json(snapshot);
}

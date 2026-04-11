import { NextResponse } from "next/server";

import { buildDiscoveryImprovementSnapshot } from "@/lib/discovery-improvement";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get("profileId");
  const snapshot = await buildDiscoveryImprovementSnapshot(profileId);
  return NextResponse.json(snapshot);
}

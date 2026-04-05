import { NextResponse } from "next/server";

import { buildDiscoveryRankingSnapshot } from "@/lib/discovery-board-detail";

export async function GET() {
  const snapshot = await buildDiscoveryRankingSnapshot();
  return NextResponse.json(snapshot);
}

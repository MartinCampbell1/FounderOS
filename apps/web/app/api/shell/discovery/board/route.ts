import { NextResponse } from "next/server";

import { buildDiscoveryBoardSnapshot } from "@/lib/discovery-board";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildDiscoveryBoardSnapshot();
  return NextResponse.json(snapshot);
}

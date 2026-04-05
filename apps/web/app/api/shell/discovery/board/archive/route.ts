import { NextResponse } from "next/server";

import { buildDiscoveryArchiveSnapshot } from "@/lib/discovery-board-history";

export async function GET() {
  const snapshot = await buildDiscoveryArchiveSnapshot();
  return NextResponse.json(snapshot);
}

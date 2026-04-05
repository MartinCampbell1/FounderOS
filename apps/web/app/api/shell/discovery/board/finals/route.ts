import { NextResponse } from "next/server";

import { buildDiscoveryFinalsSnapshot } from "@/lib/discovery-board-history";

export async function GET() {
  const snapshot = await buildDiscoveryFinalsSnapshot();
  return NextResponse.json(snapshot);
}

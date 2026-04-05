import { NextResponse } from "next/server";

import { buildDiscoveryAuthoringQueueSnapshot } from "@/lib/discovery-authoring-queue";

export async function GET() {
  const snapshot = await buildDiscoveryAuthoringQueueSnapshot();
  return NextResponse.json(snapshot);
}

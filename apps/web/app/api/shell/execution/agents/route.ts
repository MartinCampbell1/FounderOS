import { NextResponse } from "next/server";

import { buildExecutionAgentsSnapshot } from "@/lib/execution-agents";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildExecutionAgentsSnapshot();
  return NextResponse.json(snapshot);
}

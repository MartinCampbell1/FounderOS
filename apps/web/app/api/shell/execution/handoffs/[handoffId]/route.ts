import { NextResponse } from "next/server";

import { buildExecutionHandoffSnapshot } from "@/lib/execution";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handoffId: string }> }
) {
  const { handoffId } = await params;
  const snapshot = await buildExecutionHandoffSnapshot(handoffId);
  return NextResponse.json(snapshot);
}

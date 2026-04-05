import { NextResponse } from "next/server";

import { getExecutionBriefHandoff } from "@/lib/execution-brief-handoffs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handoffId: string }> }
) {
  const { handoffId } = await context.params;
  const handoff = getExecutionBriefHandoff(handoffId);

  if (!handoff) {
    return NextResponse.json(
      { detail: `Execution brief handoff ${handoffId} not found or expired.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ status: "ok", handoff });
}

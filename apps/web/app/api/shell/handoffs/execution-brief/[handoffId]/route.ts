import { NextResponse } from "next/server";

import { getExecutionBriefHandoff } from "@/lib/execution-brief-handoffs";
import { enforceShellAdminRequest } from "@/lib/shell-security";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handoffId: string }> },
) {
  const denial = enforceShellAdminRequest(_request);
  if (denial) {
    return denial;
  }

  const { handoffId } = await context.params;
  let handoff = null;

  try {
    handoff = getExecutionBriefHandoff(handoffId);
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Execution brief handoff store is unavailable.",
      },
      { status: 503 },
    );
  }

  if (!handoff) {
    return NextResponse.json(
      { detail: `Execution brief handoff ${handoffId} not found or expired.` },
      { status: 404 },
    );
  }

  return NextResponse.json({ status: "ok", handoff });
}

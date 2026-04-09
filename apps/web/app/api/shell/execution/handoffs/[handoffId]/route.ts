import { NextResponse } from "next/server";

import { buildExecutionHandoffSnapshot } from "@/lib/execution";
import { enforceShellAdminRequest } from "@/lib/shell-security";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handoffId: string }> },
) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  const { handoffId } = await params;
  const snapshot = await buildExecutionHandoffSnapshot(handoffId);
  return NextResponse.json(snapshot);
}

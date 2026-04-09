import { NextResponse } from "next/server";

import { buildExecutionHandoffsSnapshot } from "@/lib/execution-handoffs";
import { enforceShellAdminRequest } from "@/lib/shell-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  const snapshot = await buildExecutionHandoffsSnapshot();
  return NextResponse.json(snapshot);
}

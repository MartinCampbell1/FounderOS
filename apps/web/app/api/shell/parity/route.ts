import { NextResponse } from "next/server";

import { buildShellParityAuditSnapshot } from "@/lib/shell-parity-audit";
import { readShellRouteScopeFromSearchParams } from "@/lib/route-scope";
import { enforceShellAdminRequest } from "@/lib/shell-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  const url = new URL(request.url);
  const snapshot = await buildShellParityAuditSnapshot({
    routeScope: readShellRouteScopeFromSearchParams(url.searchParams),
    discoverySessionId: url.searchParams.get("session_id"),
    discoveryIdeaId: url.searchParams.get("idea_id"),
  });
  return NextResponse.json(snapshot);
}

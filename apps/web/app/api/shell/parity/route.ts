import { NextResponse } from "next/server";

import { buildShellParityAuditSnapshot } from "@/lib/shell-parity-audit";
import { readShellRouteScopeFromSearchParams } from "@/lib/route-scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const snapshot = await buildShellParityAuditSnapshot({
    routeScope: readShellRouteScopeFromSearchParams(url.searchParams),
    discoverySessionId: url.searchParams.get("session_id"),
    discoveryIdeaId: url.searchParams.get("idea_id"),
  });
  return NextResponse.json(snapshot);
}

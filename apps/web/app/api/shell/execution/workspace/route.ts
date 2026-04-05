import { NextResponse } from "next/server";

import { buildExecutionWorkspaceSnapshot } from "@/lib/execution";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const snapshot = await buildExecutionWorkspaceSnapshot(projectId, {
    includeArchived,
  });
  return NextResponse.json(snapshot);
}

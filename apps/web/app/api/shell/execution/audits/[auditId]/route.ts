import { NextResponse } from "next/server";

import { buildExecutionAuditSnapshot } from "@/lib/execution-audits";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ auditId: string }> }
) {
  const { auditId } = await context.params;
  const snapshot = await buildExecutionAuditSnapshot(auditId);
  return NextResponse.json(snapshot);
}

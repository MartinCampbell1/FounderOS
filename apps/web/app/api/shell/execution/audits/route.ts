import { NextResponse } from "next/server";

import { buildExecutionAuditsSnapshot } from "@/lib/execution-audits";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildExecutionAuditsSnapshot();
  return NextResponse.json(snapshot);
}

import { NextResponse } from "next/server";

import { buildExecutionHandoffsSnapshot } from "@/lib/execution-handoffs";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildExecutionHandoffsSnapshot();
  return NextResponse.json(snapshot);
}

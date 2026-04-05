import { NextResponse } from "next/server";

import { buildExecutionReviewSnapshot } from "@/lib/execution-review";

export async function GET() {
  const snapshot = await buildExecutionReviewSnapshot();
  return NextResponse.json(snapshot);
}

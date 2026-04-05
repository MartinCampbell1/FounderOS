import { NextResponse } from "next/server";

import { buildShellReviewCenterSnapshot } from "@/lib/review-center";

export async function GET() {
  const snapshot = await buildShellReviewCenterSnapshot();
  return NextResponse.json(snapshot);
}

import { NextResponse } from "next/server";

import { buildShellReviewCenterSnapshot } from "@/lib/review-center";

function readLimit(request: Request, fallback: number) {
  const raw = new URL(request.url).searchParams.get("limit");
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const snapshot = await buildShellReviewCenterSnapshot({
    limit: readLimit(request, 100),
  });
  return NextResponse.json(snapshot);
}

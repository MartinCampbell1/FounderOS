import { NextResponse } from "next/server";

import { buildDashboardSnapshot } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

function readLimit(request: Request, fallback: number) {
  const raw = new URL(request.url).searchParams.get("limit");
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  const snapshot = await buildDashboardSnapshot({
    limit: readLimit(request, 24),
  });
  return NextResponse.json(snapshot);
}

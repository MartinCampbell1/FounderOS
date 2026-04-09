import { NextResponse } from "next/server";

import { buildPortfolioSnapshot } from "@/lib/portfolio";

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
  const snapshot = await buildPortfolioSnapshot({
    limit: readLimit(request, 100),
  });
  return NextResponse.json(snapshot);
}

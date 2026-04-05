import { NextResponse } from "next/server";

import { buildDiscoveryIdeasSnapshot } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ideaId = url.searchParams.get("ideaId");
  const rawLimit = url.searchParams.get("limit");
  const parsedLimit =
    rawLimit && Number.isFinite(Number(rawLimit)) ? Number(rawLimit) : null;
  const snapshot = await buildDiscoveryIdeasSnapshot(ideaId, {
    limit: parsedLimit,
  });
  return NextResponse.json(snapshot);
}

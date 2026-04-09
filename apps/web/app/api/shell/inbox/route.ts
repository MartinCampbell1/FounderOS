import { NextResponse } from "next/server";

import { buildInboxSnapshot } from "@/lib/inbox";

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
  const snapshot = await buildInboxSnapshot({
    limit: readLimit(request, 50),
  });
  return NextResponse.json(snapshot);
}

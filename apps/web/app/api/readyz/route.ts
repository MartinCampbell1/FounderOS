import { NextResponse } from "next/server";

import { buildGatewayHealthSnapshot } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await buildGatewayHealthSnapshot();
  return NextResponse.json(
    {
      status: health.status === "ok" ? "ready" : "degraded",
      generatedAt: health.generatedAt,
      services: health.services,
    },
    {
      status: health.status === "ok" ? 200 : 503,
    },
  );
}

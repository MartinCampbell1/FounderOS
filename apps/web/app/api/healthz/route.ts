import { NextResponse } from "next/server";

import { buildGatewayHealthSnapshot } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await buildGatewayHealthSnapshot();
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
  });
}

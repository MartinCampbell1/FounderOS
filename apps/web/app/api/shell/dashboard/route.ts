import { NextResponse } from "next/server";

import { buildDashboardSnapshot } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildDashboardSnapshot();
  return NextResponse.json(snapshot);
}

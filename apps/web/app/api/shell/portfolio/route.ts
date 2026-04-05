import { NextResponse } from "next/server";

import { buildPortfolioSnapshot } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildPortfolioSnapshot();
  return NextResponse.json(snapshot);
}

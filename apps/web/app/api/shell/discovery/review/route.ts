import { NextResponse } from "next/server";

import { buildDiscoveryReviewSnapshot } from "@/lib/discovery-review";

export async function GET() {
  const snapshot = await buildDiscoveryReviewSnapshot();
  return NextResponse.json(snapshot);
}

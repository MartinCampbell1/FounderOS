import { NextResponse } from "next/server";

import { buildCapabilitiesSnapshot } from "@/lib/capabilities";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildCapabilitiesSnapshot();
  return NextResponse.json(snapshot);
}

import { NextResponse } from "next/server";

import { buildInboxSnapshot } from "@/lib/inbox";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildInboxSnapshot();
  return NextResponse.json(snapshot);
}

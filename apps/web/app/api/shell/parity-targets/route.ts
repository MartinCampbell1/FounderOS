import { NextResponse } from "next/server";

import { buildShellParityTargetsSnapshot } from "@/lib/shell-parity-targets";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await buildShellParityTargetsSnapshot();
  return NextResponse.json(snapshot);
}

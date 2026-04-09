import { NextResponse } from "next/server";

import { buildShellParityTargetsSnapshot } from "@/lib/shell-parity-targets";
import { enforceShellAdminRequest } from "@/lib/shell-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  const snapshot = await buildShellParityTargetsSnapshot();
  return NextResponse.json(snapshot);
}

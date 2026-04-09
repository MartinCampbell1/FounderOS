import { NextResponse } from "next/server";

import { buildShellObservabilitySnapshot } from "@/lib/observability";
import { enforceShellAdminRequest } from "@/lib/shell-security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  return NextResponse.json(buildShellObservabilitySnapshot());
}

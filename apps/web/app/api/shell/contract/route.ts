import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildShellContractAuditSnapshot } from "@/lib/shell-contract-audit";
import { enforceShellAdminRequest } from "@/lib/shell-security";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value,
  );
  const snapshot = await buildShellContractAuditSnapshot(operatorControls);
  return NextResponse.json(snapshot);
}

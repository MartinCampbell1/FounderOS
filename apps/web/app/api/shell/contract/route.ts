import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildShellContractAuditSnapshot } from "@/lib/shell-contract-audit";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const snapshot = await buildShellContractAuditSnapshot(operatorControls);
  return NextResponse.json(snapshot);
}

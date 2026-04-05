import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildShellRuntimeSnapshot } from "@/lib/runtime";
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
  const snapshot = await buildShellRuntimeSnapshot(operatorControls);
  return NextResponse.json(snapshot);
}

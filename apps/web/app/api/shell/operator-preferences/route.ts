import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ShellPreferences } from "@founderos/api-clients";

import {
  buildShellOperatorPreferencesSnapshot,
  normalizeShellPreferences,
  parseShellPreferencesCookie,
  serializeShellPreferencesCookie,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";
import {
  isSameOriginMutation,
  isShellAdminTokenAuthorized,
  isShellBodyTooLarge,
  readShellAdminTokenFromRequest,
} from "@/lib/shell-security";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

async function readCurrentPreferences() {
  const cookieStore = await cookies();
  return parseShellPreferencesCookie(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value,
  );
}

function isPreferencePatch(value: unknown): value is Partial<ShellPreferences> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const { source, preferences } = await readCurrentPreferences();
  return NextResponse.json(
    buildShellOperatorPreferencesSnapshot(preferences, source),
  );
}

export async function PUT(request: Request) {
  const shellAdminToken = readShellAdminTokenFromRequest(request);
  const allowAdminAutomation = isShellAdminTokenAuthorized(shellAdminToken);

  if (!isSameOriginMutation(request) && !allowAdminAutomation) {
    return NextResponse.json(
      { error: "Cross-site shell preference updates are not allowed." },
      { status: 403 },
    );
  }

  if (isShellBodyTooLarge(request)) {
    return NextResponse.json(
      { error: "Shell preference payload is too large." },
      { status: 413 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const current = await readCurrentPreferences();
  const nextPreferences = normalizeShellPreferences({
    ...current.preferences,
    ...(isPreferencePatch(payload) ? payload : {}),
  });
  const requestUrl = new URL(request.url);
  const isSecureRequest =
    request.headers.get("x-forwarded-proto") === "https" ||
    requestUrl.protocol === "https:";

  const response = NextResponse.json(
    buildShellOperatorPreferencesSnapshot(nextPreferences, "cookie"),
  );

  response.cookies.set(
    SHELL_PREFERENCES_COOKIE_NAME,
    serializeShellPreferencesCookie(nextPreferences),
    {
      path: "/",
      sameSite: "strict",
      httpOnly: true,
      secure: isSecureRequest,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    },
  );

  return response;
}

import type { ShellPreferences } from "@founderos/api-clients";
import { cookies } from "next/headers";

import {
  readShellRouteScopeFromQueryRecord,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

export type ShellPageQueryRecord = Record<string, string | string[] | undefined>;
export type ShellPageSearchParams = Promise<ShellPageQueryRecord>;

export type ShellRoutePageBootstrap = {
  query?: ShellPageQueryRecord;
  routeScope: ShellRouteScope;
  initialPreferences: ShellPreferences;
};

export async function resolveShellRoutePageBootstrap(
  searchParams?: ShellPageSearchParams
): Promise<ShellRoutePageBootstrap> {
  const query = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );

  return {
    query,
    routeScope: readShellRouteScopeFromQueryRecord(query),
    initialPreferences: operatorControls.preferences,
  };
}

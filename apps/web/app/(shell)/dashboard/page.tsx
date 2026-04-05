import { cookies } from "next/headers";

import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type DashboardSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: DashboardSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <DashboardWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}

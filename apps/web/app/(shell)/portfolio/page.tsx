import { cookies } from "next/headers";

import { PortfolioWorkspace } from "@/components/portfolio/portfolio-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type PortfolioSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams?: PortfolioSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  return (
    <PortfolioWorkspace
      initialSnapshot={null}
      initialPreferences={operatorControls.preferences}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}

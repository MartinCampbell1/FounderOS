import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { buildShellParityAuditSnapshot } from "@/lib/shell-parity-audit";
import { buildShellParityTargetsSnapshot } from "@/lib/shell-parity-targets";
import {
  normalizeShellRouteScope,
  normalizeShellSettingsParityTargets,
  readShellRouteScopeFromQueryRecord,
  readShellSettingsParityTargetsFromQueryRecord,
} from "@/lib/route-scope";
import { buildShellContractAuditSnapshot } from "@/lib/shell-contract-audit";
import { buildShellRuntimeSnapshot } from "@/lib/runtime";
import {
  isShellAdminTokenAuthorized,
  requiresShellAdminAccess,
} from "@/lib/shell-security";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type SettingsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: SettingsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const parityTargets = readShellSettingsParityTargetsFromQueryRecord(params);
  const cookieStore = await cookies();
  const headerStore = await headers();
  const authorization = headerStore.get("authorization") || "";
  const headerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : headerStore.get("x-founderos-shell-admin-token") || "";
  const cookieToken =
    cookieStore.get("founderos-shell-admin-token")?.value || "";
  if (
    requiresShellAdminAccess() &&
    !isShellAdminTokenAuthorized(headerToken || cookieToken)
  ) {
    notFound();
  }
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value,
  );
  const [
    initialRuntimeSnapshot,
    initialContractAuditSnapshot,
    initialParityTargetSnapshot,
  ] = await Promise.all([
    buildShellRuntimeSnapshot(operatorControls),
    buildShellContractAuditSnapshot(operatorControls),
    buildShellParityTargetsSnapshot(),
  ]);
  const effectiveRouteScope = normalizeShellRouteScope({
    projectId:
      routeScope.projectId || initialParityTargetSnapshot.routeScope.projectId,
    intakeSessionId:
      routeScope.intakeSessionId ||
      initialParityTargetSnapshot.routeScope.intakeSessionId,
  });
  const effectiveParityTargets = normalizeShellSettingsParityTargets({
    discoverySessionId:
      parityTargets.discoverySessionId ||
      initialParityTargetSnapshot.parityTargets.discoverySessionId,
    discoveryIdeaId:
      parityTargets.discoveryIdeaId ||
      initialParityTargetSnapshot.parityTargets.discoveryIdeaId,
  });
  const resolvedParityAuditSnapshot = await buildShellParityAuditSnapshot({
    routeScope: effectiveRouteScope,
    discoverySessionId: effectiveParityTargets.discoverySessionId,
    discoveryIdeaId: effectiveParityTargets.discoveryIdeaId,
  });
  return (
    <SettingsWorkspace
      initialRuntimeSnapshot={initialRuntimeSnapshot}
      initialContractAuditSnapshot={initialContractAuditSnapshot}
      initialParityTargetSnapshot={initialParityTargetSnapshot}
      initialParityAuditSnapshot={resolvedParityAuditSnapshot}
      routeScope={routeScope}
      parityTargets={parityTargets}
    />
  );
}

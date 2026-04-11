import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { buildShellParityAuditSnapshot } from "@/lib/shell-parity-audit";
import { buildShellParityTargetsSnapshot } from "@/lib/shell-parity-targets";
import {
  resolveShellRoutePageBootstrap,
  type ShellPageSearchParams,
} from "@/lib/shell-route-page-bootstrap";
import {
  normalizeShellRouteScope,
  normalizeShellSettingsParityTargets,
  readShellSettingsParityTargetsFromQueryRecord,
} from "@/lib/route-scope";
import { buildShellContractAuditSnapshot } from "@/lib/shell-contract-audit";
import { buildShellRuntimeSnapshot } from "@/lib/runtime";
import {
  buildShellOperatorPreferencesSnapshot,
} from "@/lib/shell-preferences-contract";

type SettingsSearchParams = ShellPageSearchParams;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: SettingsSearchParams;
}) {
  const bootstrap = await resolveShellRoutePageBootstrap(searchParams);
  const routeScope = bootstrap.routeScope;
  const parityTargets = readShellSettingsParityTargetsFromQueryRecord(
    bootstrap.query
  );
  const operatorControls = buildShellOperatorPreferencesSnapshot(
    bootstrap.initialPreferences,
    "cookie"
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
    projectId: routeScope.projectId || initialParityTargetSnapshot.routeScope.projectId,
    intakeSessionId:
      routeScope.intakeSessionId || initialParityTargetSnapshot.routeScope.intakeSessionId,
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

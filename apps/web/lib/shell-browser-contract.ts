import contract from "./shell-browser-contract.json";

interface ShellBrowserContractRoute {
  legacyPath: string;
  method: string;
  shellNamespace: string;
}

interface ShellBrowserContract {
  liveRoutes: {
    runtime: string;
    contractAudit: string;
    parityAudit: string;
    parityTargets: string;
    operatorPreferences: string;
    handoffBase: string;
    dashboard: string;
    review: string;
  };
  deprecatedRoutes: ShellBrowserContractRoute[];
}

export const SHELL_BROWSER_CONTRACT =
  contract as ShellBrowserContract;

export const SHELL_RUNTIME_ROUTE = SHELL_BROWSER_CONTRACT.liveRoutes.runtime;
export const SHELL_CONTRACT_AUDIT_ROUTE =
  SHELL_BROWSER_CONTRACT.liveRoutes.contractAudit;
export const SHELL_PARITY_AUDIT_ROUTE =
  SHELL_BROWSER_CONTRACT.liveRoutes.parityAudit;
export const SHELL_PARITY_TARGETS_ROUTE =
  SHELL_BROWSER_CONTRACT.liveRoutes.parityTargets;
export const SHELL_OPERATOR_PREFERENCES_ROUTE =
  SHELL_BROWSER_CONTRACT.liveRoutes.operatorPreferences;
export const SHELL_EXECUTION_BRIEF_HANDOFF_ROUTE =
  SHELL_BROWSER_CONTRACT.liveRoutes.handoffBase;

export function buildShellExecutionBriefHandoffRoute(handoffId: string) {
  return `${SHELL_EXECUTION_BRIEF_HANDOFF_ROUTE}/${encodeURIComponent(handoffId)}`;
}

export function buildLegacyExecutionBriefHandoffRoute(handoffId: string) {
  return `/api/handoffs/execution-brief/${encodeURIComponent(handoffId)}`;
}

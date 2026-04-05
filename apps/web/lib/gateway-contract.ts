export type UpstreamId = "quorum" | "autopilot";

export const SHELL_UPSTREAM_NAMESPACES: Record<UpstreamId, string> = {
  quorum: "/api/shell/discovery/*",
  autopilot: "/api/shell/execution/*",
};

export function getShellNamespaceForUpstream(upstream: UpstreamId) {
  return SHELL_UPSTREAM_NAMESPACES[upstream];
}

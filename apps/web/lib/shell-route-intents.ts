import type {
  QuorumDiscoveryIdea,
  QuorumSessionSummary,
} from "@founderos/api-clients";

import {
  buildDiscoveryIdeaScopeHref,
  buildDiscoverySessionScopeHref,
  buildExecutionIntakeScopeHref,
  buildExecutionProjectScopeHref,
  hasShellRouteScope,
  routeScopeFromIntakeSessionRef,
  routeScopeFromProjectRef,
  type ShellRouteScope,
} from "@/lib/route-scope";

export function resolveDiscoverySessionAutoOpenHref(args: {
  activeSessionId: string | null;
  sessions: QuorumSessionSummary[];
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  if (
    args.activeSessionId ||
    args.sessions.length === 0 ||
    hasShellRouteScope(args.routeScope)
  ) {
    return null;
  }

  const firstSession = args.sessions[0];
  return firstSession ? buildDiscoverySessionScopeHref(firstSession.id) : null;
}

export function resolveDiscoverySessionMutationHref(
  sessionId?: string | null,
  routeScope?: Partial<ShellRouteScope> | null
) {
  return sessionId ? buildDiscoverySessionScopeHref(sessionId, routeScope) : null;
}

export function resolveDiscoveryIdeaAutoOpenHref(args: {
  activeIdeaId: string | null;
  ideas: QuorumDiscoveryIdea[];
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  if (
    args.activeIdeaId ||
    args.ideas.length === 0 ||
    hasShellRouteScope(args.routeScope)
  ) {
    return null;
  }

  const firstIdea = args.ideas[0];
  return firstIdea ? buildDiscoveryIdeaScopeHref(firstIdea.idea_id) : null;
}

export function resolveExecutionProjectHref(args: {
  projectId: string;
  intakeSessionId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  return buildExecutionProjectScopeHref(
    args.projectId,
    routeScopeFromProjectRef(
      args.projectId,
      args.intakeSessionId,
      args.routeScope
    )
  );
}

export function resolveExecutionIntakeSessionHref(args: {
  sessionId: string;
  linkedProjectId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  return buildExecutionIntakeScopeHref(
    args.sessionId,
    routeScopeFromIntakeSessionRef(
      args.sessionId,
      args.linkedProjectId,
      args.routeScope
    )
  );
}

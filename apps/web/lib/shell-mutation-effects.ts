import type {
  ShellRouteMutationInvalidation,
  ShellRouteMutationOptions,
} from "@/lib/use-shell-route-mutation";

export type ShellMutationEffect<T = unknown> = {
  statusMessage: string;
  errorMessage?: string | null;
  invalidation?: ShellRouteMutationInvalidation | false;
  href?: string | null;
  navigation?: "push" | "replace";
  refreshClient?: boolean;
  refreshServer?: boolean;
  data?: T;
};

export function shellMutationEffectToRouteOptions(
  effect?: Partial<ShellMutationEffect<unknown>> | null
): ShellRouteMutationOptions {
  return {
    href: effect?.href ?? null,
    navigation: effect?.navigation,
    refreshClient: effect?.refreshClient,
    refreshServer: effect?.refreshServer,
    invalidation:
      effect && "invalidation" in effect ? effect.invalidation : undefined,
  };
}

export function shellMutationEffectError(
  effect?: Partial<ShellMutationEffect<unknown>> | null
) {
  return effect?.errorMessage ?? null;
}

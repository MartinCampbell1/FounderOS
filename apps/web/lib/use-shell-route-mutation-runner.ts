"use client";

import { useCallback } from "react";

import {
  shellMutationEffectToRouteOptions,
  type ShellMutationEffect,
} from "@/lib/shell-mutation-effects";
import {
  useShellMutationRunner,
  type ShellMutationRunnerOptions,
} from "@/lib/use-shell-mutation-runner";
import {
  useShellRouteMutation,
  type ShellRouteMutationInvalidation,
} from "@/lib/use-shell-route-mutation";

type AnyShellMutationEffect = ShellMutationEffect<unknown>;

export function useShellRouteMutationRunner<
  TBase extends AnyShellMutationEffect = AnyShellMutationEffect,
>(
  defaultInvalidation?: ShellRouteMutationInvalidation,
  runnerOptions?: Omit<ShellMutationRunnerOptions<TBase>, "applyEffect">
) {
  const routeMutation = useShellRouteMutation(defaultInvalidation);
  const { applyMutation } = routeMutation;
  const applyEffect = useCallback(
    (effect: TBase) => {
      applyMutation(shellMutationEffectToRouteOptions(effect));
    },
    [applyMutation]
  );
  const runner = useShellMutationRunner<TBase>({
    ...runnerOptions,
    applyEffect,
  });

  return {
    ...routeMutation,
    ...runner,
    applyEffect,
  };
}

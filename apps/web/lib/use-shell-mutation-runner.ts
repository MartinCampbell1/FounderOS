"use client";

import { useCallback, useState } from "react";

import type { ShellMutationEffect } from "@/lib/shell-mutation-effects";
import type { ShellRouteMutationInvalidation } from "@/lib/use-shell-route-mutation";

type AnyShellMutationEffect = ShellMutationEffect<unknown>;

export type ShellMutationRunOptions<T extends AnyShellMutationEffect> = {
  applyEffect?: (effect: T) => void;
  fallbackInvalidation?: ShellRouteMutationInvalidation | false;
  fallbackErrorMessage?: string;
  onError?: (error: unknown) => void;
  onSuccess?: (effect: T) => void;
  shouldApplyEffect?: (effect: T) => boolean;
};

export type ShellMutationRunnerOptions<T extends AnyShellMutationEffect> = {
  applyEffect?: (effect: T) => void;
  fallbackErrorMessage?: string;
  onError?: (error: unknown) => void;
  shouldApplyEffect?: (effect: T) => boolean;
};

function defaultShouldApplyEffect(effect: AnyShellMutationEffect) {
  return Boolean(
    effect.href ||
      effect.refreshClient ||
      effect.refreshServer ||
      effect.invalidation
  );
}

export function useShellMutationRunner<
  TBase extends AnyShellMutationEffect = AnyShellMutationEffect,
>(options?: ShellMutationRunnerOptions<TBase>) {
  const [busyActionKey, setBusyActionKey] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runMutation = useCallback(
    async <T extends TBase>(
      actionKey: string,
      action: () => Promise<T>,
      runOptions?: ShellMutationRunOptions<T>
    ) => {
      setBusyActionKey(actionKey);
      setStatusMessage(null);
      setErrorMessage(null);

      try {
        const effect = await action();
        const normalizedEffect = (
          runOptions?.fallbackInvalidation !== undefined &&
          effect.invalidation === undefined
            ? {
                ...effect,
                invalidation: runOptions.fallbackInvalidation,
              }
            : effect
        ) as T;

        setStatusMessage(normalizedEffect.statusMessage);
        setErrorMessage(normalizedEffect.errorMessage ?? null);
        runOptions?.onSuccess?.(normalizedEffect);

        const shouldApply =
          runOptions?.shouldApplyEffect ||
          options?.shouldApplyEffect ||
          defaultShouldApplyEffect;
        if (shouldApply(normalizedEffect)) {
          (runOptions?.applyEffect || options?.applyEffect)?.(normalizedEffect);
        }

        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : runOptions?.fallbackErrorMessage ||
                options?.fallbackErrorMessage ||
                "Action failed."
        );
        (runOptions?.onError || options?.onError)?.(error);
        return false;
      } finally {
        setBusyActionKey("");
      }
    },
    [
      options?.applyEffect,
      options?.fallbackErrorMessage,
      options?.onError,
      options?.shouldApplyEffect,
    ]
  );

  return {
    busyActionKey,
    errorMessage,
    runMutation,
    setErrorMessage,
    setStatusMessage,
    statusMessage,
  };
}

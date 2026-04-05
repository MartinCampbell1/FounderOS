"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  emitShellDataInvalidation,
  type ShellDataResource,
  type ShellDataPlane,
} from "@/lib/shell-data-sync";
import type { ShellRouteScope } from "@/lib/route-scope";

export type ShellRouteMutationInvalidation = {
  planes?: ShellDataPlane[];
  scope?: Partial<ShellRouteScope> | null;
  resource?: Partial<ShellDataResource> | null;
  source?: string;
  reason?: string;
};

export type ShellRouteMutationOptions = {
  href?: string | null;
  navigation?: "push" | "replace";
  refreshClient?: boolean;
  refreshServer?: boolean;
  invalidation?: ShellRouteMutationInvalidation | false;
};

export function useShellRouteMutation(
  defaultInvalidation?: ShellRouteMutationInvalidation
) {
  const router = useRouter();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isPending, startTransition] = useTransition();

  const refreshClient = useCallback(() => {
    startTransition(() => {
      setRefreshNonce((value) => value + 1);
    });
  }, [startTransition]);

  const applyMutation = useCallback(
    (options?: ShellRouteMutationOptions) => {
      const invalidation =
        options?.invalidation === false
          ? null
          : {
              ...defaultInvalidation,
              ...options?.invalidation,
            };

      if (invalidation?.planes?.length) {
        emitShellDataInvalidation({
          planes: invalidation.planes,
          scope: invalidation.scope,
          resource: invalidation.resource,
          source: invalidation.source,
          reason: invalidation.reason,
        });
      }

      if (options?.refreshClient !== false) {
        refreshClient();
      }

      if (options?.href) {
        if (options.navigation === "replace") {
          router.replace(options.href);
        } else {
          router.push(options.href);
        }
      }

      if (options?.refreshServer) {
        router.refresh();
      }
    },
    [defaultInvalidation, refreshClient, router]
  );

  return {
    isPending,
    refreshNonce,
    refreshClient,
    applyMutation,
  };
}

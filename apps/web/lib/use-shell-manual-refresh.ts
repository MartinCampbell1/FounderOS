"use client";

import { useCallback, useState, useTransition } from "react";

import { emitShellDataInvalidation } from "@/lib/shell-data-sync";

type ShellManualRefreshOptions = {
  invalidation?: Parameters<typeof emitShellDataInvalidation>[0] | null;
};

export function useShellManualRefresh(
  options: ShellManualRefreshOptions = {}
) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRefreshing, startRefreshTransition] = useTransition();

  const refresh = useCallback(() => {
    startRefreshTransition(() => {
      setRefreshNonce((value) => value + 1);
    });

    if (options.invalidation) {
      emitShellDataInvalidation(options.invalidation);
    }
  }, [options.invalidation, startRefreshTransition]);

  return {
    isRefreshing,
    refresh,
    refreshNonce,
  };
}

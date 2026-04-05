"use client";

import { useShellDataInvalidationNonce } from "@/lib/shell-data-sync";

type UseShellSnapshotRefreshNonceOptions = {
  additionalRefreshNonce?: number;
  baseRefreshNonce?: number;
  invalidation: Parameters<typeof useShellDataInvalidationNonce>[0];
  invalidationOptions?: Parameters<typeof useShellDataInvalidationNonce>[1];
};

export function useShellSnapshotRefreshNonce({
  additionalRefreshNonce = 0,
  baseRefreshNonce = 0,
  invalidation,
  invalidationOptions,
}: UseShellSnapshotRefreshNonceOptions) {
  const invalidationNonce = useShellDataInvalidationNonce(
    invalidation,
    invalidationOptions
  );

  return baseRefreshNonce + invalidationNonce + additionalRefreshNonce;
}

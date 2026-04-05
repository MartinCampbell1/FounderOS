"use client";

import { useEffect, useState } from "react";

export type ShellSnapshotLoadState = "loading" | "ready" | "error";

interface UseShellPolledSnapshotOptions<TSnapshot> {
  emptySnapshot: TSnapshot;
  initialSnapshot?: TSnapshot | null;
  refreshNonce: number;
  pollIntervalMs: number;
  loadSnapshot: () => Promise<TSnapshot>;
  selectLoadState: (snapshot: TSnapshot) => Exclude<ShellSnapshotLoadState, "loading">;
}

export function useShellPolledSnapshot<TSnapshot>({
  emptySnapshot,
  initialSnapshot,
  refreshNonce,
  pollIntervalMs,
  loadSnapshot,
  selectLoadState,
}: UseShellPolledSnapshotOptions<TSnapshot>) {
  const [snapshot, setSnapshot] = useState<TSnapshot>(initialSnapshot ?? emptySnapshot);
  const [loadState, setLoadState] = useState<ShellSnapshotLoadState>(
    initialSnapshot ? selectLoadState(initialSnapshot) : "loading"
  );
  const hasInitialSnapshot = Boolean(initialSnapshot);

  useEffect(() => {
    let active = true;
    // AbortController signals intent to cancel on cleanup. The network request
    // itself cannot be cancelled because loadSnapshot() does not accept a signal
    // — callers own the fetch implementation. State updates are already guarded
    // by the `active` flag below.
    const controller = new AbortController();

    async function reload() {
      setLoadState((current) => (current === "ready" ? "ready" : "loading"));

      try {
        const nextSnapshot = await loadSnapshot();
        if (!active) {
          return;
        }
        setSnapshot(nextSnapshot);
        setLoadState(selectLoadState(nextSnapshot));
      } catch {
        if (!active) {
          return;
        }
        setSnapshot(emptySnapshot);
        setLoadState("error");
      }
    }

    if (!hasInitialSnapshot || refreshNonce > 0) {
      void reload();
    }

    const intervalId = window.setInterval(() => {
      void reload();
    }, pollIntervalMs);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [
    emptySnapshot,
    hasInitialSnapshot,
    loadSnapshot,
    pollIntervalMs,
    refreshNonce,
    selectLoadState,
  ]);

  return {
    loadState,
    snapshot,
  };
}

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

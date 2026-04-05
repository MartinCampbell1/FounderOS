"use client";

import { useCallback, useMemo, useState } from "react";

type SelectionState = {
  selectionViewKey: string;
  selectedKeys: string[];
};

export function useScopedSelection(selectionViewKey: string) {
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectionViewKey,
    selectedKeys: [],
  });

  const selectedKeySet = useMemo(
    () =>
      new Set(
        selectionState.selectionViewKey === selectionViewKey
          ? selectionState.selectedKeys
          : []
      ),
    [selectionState, selectionViewKey]
  );

  const replaceSelectedKeys = useCallback(
    (keys: string[]) => {
      setSelectionState({
        selectionViewKey,
        selectedKeys: [...new Set(keys)],
      });
    },
    [selectionViewKey]
  );

  const toggleSelectedKey = useCallback(
    (recordKey: string) => {
      setSelectionState((current) => {
        const activeKeys =
          current.selectionViewKey === selectionViewKey
            ? current.selectedKeys
            : [];
        const nextKeys = new Set(activeKeys);

        if (nextKeys.has(recordKey)) {
          nextKeys.delete(recordKey);
        } else {
          nextKeys.add(recordKey);
        }

        return {
          selectionViewKey,
          selectedKeys: Array.from(nextKeys),
        };
      });
    },
    [selectionViewKey]
  );

  const clearSelection = useCallback(() => {
    replaceSelectedKeys([]);
  }, [replaceSelectedKeys]);

  const clearProcessedSelection = useCallback(
    (processedKeys: string[]) => {
      if (processedKeys.length === 0) {
        return;
      }

      setSelectionState((current) => {
        const activeKeys =
          current.selectionViewKey === selectionViewKey
            ? current.selectedKeys
            : [];
        const processedKeySet = new Set(processedKeys);

        return {
          selectionViewKey,
          selectedKeys: activeKeys.filter((key) => !processedKeySet.has(key)),
        };
      });
    },
    [selectionViewKey]
  );

  return {
    clearProcessedSelection,
    clearSelection,
    replaceSelectedKeys,
    selectedKeySet,
    toggleSelectedKey,
  };
}

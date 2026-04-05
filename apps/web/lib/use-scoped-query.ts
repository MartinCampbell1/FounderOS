"use client";

import { useCallback, useMemo, useState } from "react";

type ScopedQueryState = {
  scopeKey: string;
  query: string;
};

export function useScopedQuery(scopeKey: string, initialQuery: string = "") {
  const [queryState, setQueryState] = useState<ScopedQueryState>({
    scopeKey,
    query: initialQuery,
  });

  const query = queryState.scopeKey === scopeKey ? queryState.query : initialQuery;
  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  const setQuery = useCallback(
    (nextQuery: string) => {
      setQueryState({
        scopeKey,
        query: nextQuery,
      });
    },
    [scopeKey]
  );

  return {
    normalizedQuery,
    query,
    setQuery,
  };
}

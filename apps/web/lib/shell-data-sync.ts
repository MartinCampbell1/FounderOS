"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  hasShellRouteScope,
  normalizeShellRouteScope,
  type ShellRouteScope,
} from "@/lib/route-scope";

export type ShellDataPlane = "discovery" | "execution";

export type ShellDataResource = {
  discoverySessionId: string;
  discoveryIdeaId: string;
  executionProjectId: string;
  executionIntakeSessionId: string;
};

export type ShellDataInvalidation = {
  eventId: string;
  planes: ShellDataPlane[];
  scope: ShellRouteScope;
  resource: ShellDataResource;
  source: string;
  reason: string;
  issuedAt: string;
};

type ShellDataInvalidationFilter = {
  planes?: ShellDataPlane[];
  scope?: Partial<ShellRouteScope> | null;
  resource?: Partial<ShellDataResource> | null;
};

type ShellDataInvalidationHookOptions = {
  ignoreSources?: string[];
  since?: string | null;
};

const SHELL_DATA_INVALIDATION_EVENT = "founderos:shell-data-invalidation";
const SHELL_DATA_INVALIDATION_STORAGE_KEY =
  "founderos-shell-data-invalidation";

function uniquePlanes(planes: ShellDataPlane[]) {
  return [...new Set(planes)];
}

export function normalizeShellDataResource(
  input?: Partial<ShellDataResource> | null
): ShellDataResource {
  return {
    discoverySessionId: input?.discoverySessionId?.trim() || "",
    discoveryIdeaId: input?.discoveryIdeaId?.trim() || "",
    executionProjectId: input?.executionProjectId?.trim() || "",
    executionIntakeSessionId: input?.executionIntakeSessionId?.trim() || "",
  };
}

function hasShellDataResource(resource?: Partial<ShellDataResource> | null) {
  const normalized = normalizeShellDataResource(resource);
  return Boolean(
    normalized.discoverySessionId ||
      normalized.discoveryIdeaId ||
      normalized.executionProjectId ||
      normalized.executionIntakeSessionId
  );
}

function parseInvalidationRecord(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ShellDataInvalidation>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.planes) ||
      typeof parsed.eventId !== "string"
    ) {
      return null;
    }

    return {
      eventId: parsed.eventId,
      planes: uniquePlanes(
        parsed.planes.filter(
          (plane): plane is ShellDataPlane =>
            plane === "discovery" || plane === "execution"
        )
      ),
      scope: normalizeShellRouteScope(parsed.scope),
      resource: normalizeShellDataResource(parsed.resource),
      source: typeof parsed.source === "string" ? parsed.source : "shell",
      reason: typeof parsed.reason === "string" ? parsed.reason : "mutation",
      issuedAt:
        typeof parsed.issuedAt === "string"
          ? parsed.issuedAt
          : new Date().toISOString(),
    } satisfies ShellDataInvalidation;
  } catch {
    return null;
  }
}

function issuedAtIsNewer(issuedAt: string, since?: string | null) {
  if (!since) {
    return true;
  }

  const issuedAtTime = Date.parse(issuedAt);
  const sinceTime = Date.parse(since);

  if (!Number.isFinite(issuedAtTime) || !Number.isFinite(sinceTime)) {
    return true;
  }

  return issuedAtTime > sinceTime;
}

function planesMatch(
  filterPlanes: ShellDataPlane[] | undefined,
  invalidationPlanes: ShellDataPlane[]
) {
  if (!filterPlanes || filterPlanes.length === 0) {
    return true;
  }

  return filterPlanes.some((plane) => invalidationPlanes.includes(plane));
}

function scopeMatches(
  listenerScope?: Partial<ShellRouteScope> | null,
  invalidationScope?: Partial<ShellRouteScope> | null
) {
  const normalizedListenerScope = normalizeShellRouteScope(listenerScope);
  const normalizedInvalidationScope =
    normalizeShellRouteScope(invalidationScope);

  if (
    !hasShellRouteScope(normalizedListenerScope) ||
    !hasShellRouteScope(normalizedInvalidationScope)
  ) {
    return true;
  }

  const projectMatch =
    normalizedListenerScope.projectId &&
    normalizedInvalidationScope.projectId &&
    normalizedListenerScope.projectId === normalizedInvalidationScope.projectId;
  const intakeMatch =
    normalizedListenerScope.intakeSessionId &&
    normalizedInvalidationScope.intakeSessionId &&
    normalizedListenerScope.intakeSessionId ===
      normalizedInvalidationScope.intakeSessionId;

  return Boolean(projectMatch || intakeMatch);
}

function resourceMatches(
  listenerResource?: Partial<ShellDataResource> | null,
  invalidationResource?: Partial<ShellDataResource> | null
) {
  const normalizedListenerResource = normalizeShellDataResource(listenerResource);
  const normalizedInvalidationResource =
    normalizeShellDataResource(invalidationResource);

  if (!hasShellDataResource(normalizedListenerResource)) {
    return true;
  }

  if (!hasShellDataResource(normalizedInvalidationResource)) {
    return true;
  }

  const comparableMatches = [
    normalizedListenerResource.discoverySessionId &&
    normalizedInvalidationResource.discoverySessionId
      ? normalizedListenerResource.discoverySessionId ===
        normalizedInvalidationResource.discoverySessionId
      : null,
    normalizedListenerResource.discoveryIdeaId &&
    normalizedInvalidationResource.discoveryIdeaId
      ? normalizedListenerResource.discoveryIdeaId ===
        normalizedInvalidationResource.discoveryIdeaId
      : null,
    normalizedListenerResource.executionProjectId &&
    normalizedInvalidationResource.executionProjectId
      ? normalizedListenerResource.executionProjectId ===
        normalizedInvalidationResource.executionProjectId
      : null,
    normalizedListenerResource.executionIntakeSessionId &&
    normalizedInvalidationResource.executionIntakeSessionId
      ? normalizedListenerResource.executionIntakeSessionId ===
        normalizedInvalidationResource.executionIntakeSessionId
      : null,
  ].filter((value): value is boolean => typeof value === "boolean");

  if (comparableMatches.length === 0) {
    return false;
  }

  return comparableMatches.some(Boolean);
}

function shouldApplyShellDataInvalidation(
  invalidation: ShellDataInvalidation | null,
  filter?: ShellDataInvalidationFilter | null,
  options?: ShellDataInvalidationHookOptions
) {
  if (!invalidation) {
    return false;
  }

  if (
    options?.ignoreSources?.length &&
    options.ignoreSources.includes(invalidation.source)
  ) {
    return false;
  }

  if (!planesMatch(filter?.planes, invalidation.planes)) {
    return false;
  }

  if (!scopeMatches(filter?.scope, invalidation.scope)) {
    return false;
  }

  if (!resourceMatches(filter?.resource, invalidation.resource)) {
    return false;
  }

  return issuedAtIsNewer(invalidation.issuedAt, options?.since);
}

export function readLatestShellDataInvalidation() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseInvalidationRecord(
      window.localStorage.getItem(SHELL_DATA_INVALIDATION_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function emitShellDataInvalidation(args: {
  planes: ShellDataPlane[];
  scope?: Partial<ShellRouteScope> | null;
  resource?: Partial<ShellDataResource> | null;
  source?: string;
  reason?: string;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const invalidation: ShellDataInvalidation = {
    eventId: `${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
    planes: uniquePlanes(args.planes),
    scope: normalizeShellRouteScope(args.scope),
    resource: normalizeShellDataResource(args.resource),
    source: (args.source || "shell").trim() || "shell",
    reason: (args.reason || "mutation").trim() || "mutation",
    issuedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(
      SHELL_DATA_INVALIDATION_STORAGE_KEY,
      JSON.stringify(invalidation)
    );
  } catch {
    // Ignore localStorage failures and still notify the current tab.
  }

  window.dispatchEvent(
    new CustomEvent<ShellDataInvalidation>(SHELL_DATA_INVALIDATION_EVENT, {
      detail: invalidation,
    })
  );
}

export function useShellDataInvalidationNonce(
  filter?: ShellDataInvalidationFilter | null,
  options?: ShellDataInvalidationHookOptions
) {
  const [nonce, setNonce] = useState(0);
  const lastAppliedEventIdRef = useRef("");
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        planes: filter?.planes ?? [],
        scope: normalizeShellRouteScope(filter?.scope),
        resource: normalizeShellDataResource(filter?.resource),
        ignoreSources: options?.ignoreSources ?? [],
        since: options?.since ?? "",
      }),
    [
      filter?.planes,
      filter?.resource,
      filter?.scope,
      options?.ignoreSources,
      options?.since,
    ]
  );
  const normalizedConfig = useMemo(() => {
    const parsed = JSON.parse(filterKey) as {
      planes: ShellDataPlane[];
      scope: ShellRouteScope;
      resource: ShellDataResource;
      ignoreSources: string[];
      since: string;
    };

    return {
      filter: {
        planes: parsed.planes,
        resource: parsed.resource,
        scope: parsed.scope,
      } satisfies ShellDataInvalidationFilter,
      options: {
        ignoreSources: parsed.ignoreSources,
        since: parsed.since || null,
      } satisfies ShellDataInvalidationHookOptions,
    };
  }, [filterKey]);

  useEffect(() => {
    const { filter: effectiveFilter, options: effectiveOptions } = normalizedConfig;

    function applyInvalidation(invalidation: ShellDataInvalidation | null) {
      if (
        !shouldApplyShellDataInvalidation(
          invalidation,
          effectiveFilter,
          effectiveOptions
        ) ||
        !invalidation
      ) {
        return;
      }

      if (lastAppliedEventIdRef.current === invalidation.eventId) {
        return;
      }

      lastAppliedEventIdRef.current = invalidation.eventId;
      setNonce((value) => value + 1);
    }

    if (effectiveOptions.since) {
      applyInvalidation(readLatestShellDataInvalidation());
    }

    function handleInvalidationEvent(event: Event) {
      applyInvalidation(
        (event as CustomEvent<ShellDataInvalidation>).detail ?? null
      );
    }

    function handleStorageEvent(event: StorageEvent) {
      if (event.key !== SHELL_DATA_INVALIDATION_STORAGE_KEY) {
        return;
      }
      applyInvalidation(parseInvalidationRecord(event.newValue));
    }

    window.addEventListener(
      SHELL_DATA_INVALIDATION_EVENT,
      handleInvalidationEvent as EventListener
    );
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(
        SHELL_DATA_INVALIDATION_EVENT,
        handleInvalidationEvent as EventListener
      );
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [normalizedConfig]);

  return nonce;
}

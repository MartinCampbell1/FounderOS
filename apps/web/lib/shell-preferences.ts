"use client";

import { updateShellOperatorPreferences } from "@founderos/api-clients";
import { useMemo, useSyncExternalStore } from "react";

export type {
  ShellPollSurface,
  ShellPreferences,
  ShellRefreshProfile,
  ShellReviewLane,
  ShellReviewMemoryBucket,
  ShellReviewMemoryPreferences,
  ShellReviewPassPreference,
  ShellReviewPreset,
} from "@founderos/api-clients";
export {
  DEFAULT_SHELL_PREFERENCES,
  SHELL_REFRESH_PROFILE_OPTIONS,
  getShellPollInterval,
} from "@/lib/shell-preferences-contract";
import type { ShellPreferences } from "@founderos/api-clients";
import {
  DEFAULT_SHELL_PREFERENCES,
  SHELL_PREFERENCES_CHANGE_EVENT,
  SHELL_PREFERENCES_COOKIE_NAME,
  SHELL_PREFERENCES_STORAGE_KEY,
  normalizeShellPreferences,
  parseShellPreferencesCookie,
} from "@/lib/shell-preferences-contract";

function canUseWindow() {
  return typeof window !== "undefined";
}

function canUseBrowserStorage() {
  return canUseWindow() && typeof window.localStorage !== "undefined";
}

let cachedPreferenceSource: string | null = null;
let cachedPreferences: ShellPreferences | null = null;

function cachePreferences(source: string, resolve: () => ShellPreferences) {
  if (cachedPreferences && cachedPreferenceSource === source) {
    return cachedPreferences;
  }

  const nextPreferences = resolve();
  cachedPreferenceSource = source;
  cachedPreferences = nextPreferences;
  return nextPreferences;
}

function readCookiePreferences() {
  if (!canUseWindow()) {
    return DEFAULT_SHELL_PREFERENCES;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${SHELL_PREFERENCES_COOKIE_NAME}=`));

  if (!cookie) {
    return cachePreferences("cookie:default", () => DEFAULT_SHELL_PREFERENCES);
  }

  const cookieValue = cookie.slice(SHELL_PREFERENCES_COOKIE_NAME.length + 1);
  return cachePreferences(`cookie:${cookieValue}`, () =>
    parseShellPreferencesCookie(cookieValue).preferences
  );
}

function readStoredPreferences(): ShellPreferences {
  if (canUseBrowserStorage()) {
    try {
      const raw = window.localStorage.getItem(SHELL_PREFERENCES_STORAGE_KEY);
      if (raw) {
        return cachePreferences(`storage:${raw}`, () =>
          normalizeShellPreferences(JSON.parse(raw) as Partial<ShellPreferences>)
        );
      }
    } catch {
      return readCookiePreferences();
    }
  }

  return readCookiePreferences();
}

function writeStoredPreferences(nextPreferences: ShellPreferences) {
  if (canUseBrowserStorage()) {
    try {
      window.localStorage.setItem(
        SHELL_PREFERENCES_STORAGE_KEY,
        JSON.stringify(nextPreferences)
      );
    } catch {
      // Ignore storage failures and keep the cookie sync path active.
    }
  }

  if (canUseWindow()) {
    window.dispatchEvent(new Event(SHELL_PREFERENCES_CHANGE_EVENT));
    void updateShellOperatorPreferences(nextPreferences).catch(() => undefined);
  }

  return nextPreferences;
}

function subscribe(listener: () => void) {
  if (!canUseWindow()) {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === SHELL_PREFERENCES_STORAGE_KEY) {
      listener();
    }
  };
  const onChange = () => {
    listener();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SHELL_PREFERENCES_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SHELL_PREFERENCES_CHANGE_EVENT, onChange);
  };
}

function getClientSnapshot() {
  return readStoredPreferences();
}

export function updateShellPreferences(
  patch: Partial<ShellPreferences>
): ShellPreferences {
  const current = readStoredPreferences();
  const next = normalizeShellPreferences({
    ...current,
    ...patch,
  });
  return writeStoredPreferences(next);
}

export function useShellPreferences(initialPreferences?: ShellPreferences) {
  const serverSnapshot = useMemo(
    () =>
      normalizeShellPreferences(
        initialPreferences ?? DEFAULT_SHELL_PREFERENCES
      ),
    [initialPreferences]
  );
  const getServerSnapshot = () => serverSnapshot;
  const preferences = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  return {
    preferences,
    updatePreferences: updateShellPreferences,
  };
}

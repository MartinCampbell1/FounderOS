import type {
  ShellPreferences,
  ShellReviewMemoryBucket,
} from "@founderos/api-clients";

import type { ShellExecutionAttentionRecord } from "@/lib/attention-records";
import {
  intakeSessionIdFromExecutionSourceContext,
  routeScopeFromExecutionSourceContext,
  type ShellExecutionSourceContext,
} from "@/lib/execution-source";
import {
  buildExecutionIntakeScopeHref,
  buildSettingsScopeHref,
  type ShellRouteScope,
  type ShellSettingsParityTargets,
} from "@/lib/route-scope";
import {
  buildRememberedDiscoveryReviewScopeHref,
  buildRememberedExecutionReviewScopeHref,
  buildRememberedReviewScopeHref,
} from "@/lib/review-memory";
import {
  mergeShellSettingsParityTargets,
  shellSettingsParityTargetsFromExecutionAttentionRecord,
  shellSettingsParityTargetsFromExecutionSourceContext,
} from "@/lib/settings-parity-targets";

type RememberedShellReviewEntryHrefArgs = {
  scope?: Partial<ShellRouteScope> | null;
  preferences: Pick<ShellPreferences, "reviewMemory">;
  bucket?: ShellReviewMemoryBucket | null;
};

export function buildRememberedShellReviewEntryHrefs(
  args: RememberedShellReviewEntryHrefArgs
) {
  return {
    reviewHref: buildRememberedReviewScopeHref(args),
    discoveryReviewHref: buildRememberedDiscoveryReviewScopeHref(args),
    executionReviewHref: buildRememberedExecutionReviewScopeHref(args),
  };
}

export function buildShellEntrySettingsHref(
  scope?: Partial<ShellRouteScope> | null,
  ...targets: Array<Partial<ShellSettingsParityTargets> | null | undefined>
) {
  return buildSettingsScopeHref(scope, mergeShellSettingsParityTargets(...targets));
}

export function buildExecutionSourceSettingsHref(
  source: ShellExecutionSourceContext,
  fallback?: Partial<ShellRouteScope> | null
) {
  return buildShellEntrySettingsHref(
    routeScopeFromExecutionSourceContext(source, fallback),
    shellSettingsParityTargetsFromExecutionSourceContext(source)
  );
}

export function buildExecutionAttentionSettingsHref(
  record?: ShellExecutionAttentionRecord | null,
  fallback?: Partial<ShellRouteScope> | null
) {
  if (!record) {
    return buildShellEntrySettingsHref(fallback);
  }

  return buildShellEntrySettingsHref(
    routeScopeFromExecutionSourceContext(record.source, fallback),
    shellSettingsParityTargetsFromExecutionAttentionRecord(record)
  );
}

export function buildExecutionSourceIntakeHref(
  source: ShellExecutionSourceContext,
  fallback?: Partial<ShellRouteScope> | null
) {
  const intakeSessionId = intakeSessionIdFromExecutionSourceContext(source);
  if (!intakeSessionId) {
    return null;
  }

  return buildExecutionIntakeScopeHref(
    intakeSessionId,
    routeScopeFromExecutionSourceContext(source, fallback)
  );
}

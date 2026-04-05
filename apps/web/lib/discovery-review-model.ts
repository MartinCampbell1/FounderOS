import type {
  ShellDiscoveryReviewKind,
  ShellDiscoveryReviewRecord,
  ShellDiscoveryReviewStats,
} from "@/lib/discovery-review";

export type DiscoveryReviewFilter =
  | "all"
  | "authoring"
  | "trace"
  | "handoff"
  | "execution"
  | "linked"
  | "replay";

type QueryRecord = Record<string, string | string[] | undefined>;

const DISCOVERY_REVIEW_FILTERS = new Set<DiscoveryReviewFilter>([
  "all",
  "authoring",
  "trace",
  "handoff",
  "execution",
  "linked",
  "replay",
]);

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function normalizeDiscoveryReviewFilter(
  value?: string | null
): DiscoveryReviewFilter {
  const normalized = (value || "").trim().toLowerCase();
  return DISCOVERY_REVIEW_FILTERS.has(normalized as DiscoveryReviewFilter)
    ? (normalized as DiscoveryReviewFilter)
    : "all";
}

export function readDiscoveryReviewFilterFromQueryRecord(
  params?: QueryRecord | null
) {
  return normalizeDiscoveryReviewFilter(firstParam(params?.filter));
}

export function matchesDiscoveryReviewFilter(
  record: ShellDiscoveryReviewRecord,
  filter: DiscoveryReviewFilter
) {
  if (filter === "all") return true;
  if (filter === "authoring") return record.kind === "authoring";
  if (filter === "trace") return record.kind === "trace-review";
  if (filter === "handoff") return record.kind === "handoff-ready";
  if (filter === "execution") return record.kind === "execution-followthrough";
  if (filter === "linked") return Boolean(record.chain);
  return (record.trace?.linkedSessionIds.length ?? 0) > 0;
}

export function discoveryReviewFilterFromKind(
  kind: ShellDiscoveryReviewKind
): DiscoveryReviewFilter {
  if (kind === "trace-review") return "trace";
  if (kind === "handoff-ready") return "handoff";
  if (kind === "execution-followthrough") return "execution";
  return "authoring";
}

export function buildDiscoveryReviewStatsFromRecords(
  records: ShellDiscoveryReviewRecord[]
): ShellDiscoveryReviewStats {
  return records.reduce<ShellDiscoveryReviewStats>(
    (stats, record) => {
      stats.totalCount += 1;
      if (record.kind === "authoring") stats.authoringCount += 1;
      if (record.kind === "trace-review") stats.traceReviewCount += 1;
      if (record.kind === "handoff-ready") stats.handoffReadyCount += 1;
      if (record.kind === "execution-followthrough") {
        stats.executionFollowthroughCount += 1;
      }
      if (record.chain) stats.linkedCount += 1;
      if ((record.trace?.linkedSessionIds.length ?? 0) > 0) {
        stats.replayLinkedCount += 1;
      }
      return stats;
    },
    {
      totalCount: 0,
      authoringCount: 0,
      traceReviewCount: 0,
      handoffReadyCount: 0,
      executionFollowthroughCount: 0,
      linkedCount: 0,
      replayLinkedCount: 0,
    }
  );
}

export type { ShellReviewPreset } from "@founderos/api-clients";
import type { ShellReviewPreset } from "@founderos/api-clients";
import type {
  ApprovalAttentionRecord,
  IssueAttentionRecord,
  RuntimeAttentionRecord,
} from "@/lib/attention-records";
import type { ShellReviewPressureHotspot } from "@/lib/review-pressure";
import type { ShellDiscoveryReviewRecord } from "@/lib/discovery-review";

type QueryRecord = Record<string, string | string[] | undefined>;

export interface ReviewPresetBuckets {
  discoveryRecords: ShellDiscoveryReviewRecord[];
  issueRecords: IssueAttentionRecord[];
  criticalIssueRecords: IssueAttentionRecord[];
  approvalRecords: ApprovalAttentionRecord[];
  runtimeRecords: RuntimeAttentionRecord[];
}

export interface ShellReviewPresetDefinition {
  key: ShellReviewPreset;
  label: string;
  detail: string;
  steps: string[];
}

const REVIEW_PRESET_DEFINITIONS: ShellReviewPresetDefinition[] = [
  {
    key: "discovery-pass",
    label: "Discovery pass",
    detail:
      "Confirm the visible discovery review set in one operator pass.",
    steps: ["Confirm discovery review records"],
  },
  {
    key: "critical-pass",
    label: "Critical pass",
    detail: "Resolve only the visible critical execution issues first.",
    steps: ["Resolve critical execution issues"],
  },
  {
    key: "decision-pass",
    label: "Decision pass",
    detail:
      "Approve visible approvals and allow visible tool-permission requests.",
    steps: ["Approve approvals", "Allow tool permissions"],
  },
  {
    key: "chain-pass",
    label: "Chain pass",
    detail:
      "Run the full visible operator pass across discovery confirmations, issue resolution, approvals, and tool permissions.",
    steps: [
      "Confirm discovery review records",
      "Resolve execution issues",
      "Approve approvals",
      "Allow tool permissions",
    ],
  },
];

const REVIEW_PRESETS = new Set<ShellReviewPreset>(
  REVIEW_PRESET_DEFINITIONS.map((preset) => preset.key)
);

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function reviewPresetDefinitions() {
  return REVIEW_PRESET_DEFINITIONS;
}

export function normalizeReviewPreset(
  value?: string | null
): ShellReviewPreset | null {
  const normalized = (value || "").trim().toLowerCase();
  return REVIEW_PRESETS.has(normalized as ShellReviewPreset)
    ? (normalized as ShellReviewPreset)
    : null;
}

export function readReviewPresetFromQueryRecord(
  params?: QueryRecord | null
) {
  return normalizeReviewPreset(firstParam(params?.preset));
}

export function reviewPresetDefinition(
  preset?: ShellReviewPreset | null
) {
  if (!preset) {
    return null;
  }
  return REVIEW_PRESET_DEFINITIONS.find((option) => option.key === preset) ?? null;
}

export function countReviewPresetMatches(
  preset: ShellReviewPreset,
  buckets: ReviewPresetBuckets
) {
  if (preset === "discovery-pass") {
    return buckets.discoveryRecords.length;
  }
  if (preset === "critical-pass") {
    return buckets.criticalIssueRecords.length;
  }
  if (preset === "decision-pass") {
    return buckets.approvalRecords.length + buckets.runtimeRecords.length;
  }
  return (
    buckets.discoveryRecords.length +
    buckets.issueRecords.length +
    buckets.approvalRecords.length +
    buckets.runtimeRecords.length
  );
}

export function recommendedReviewPresetForHotspot(
  hotspot: Pick<
    ShellReviewPressureHotspot,
    | "discoveryCount"
    | "issueCount"
    | "approvalCount"
    | "runtimeCount"
    | "criticalIssueCount"
  >
): ShellReviewPreset {
  if (
    hotspot.discoveryCount > 0 &&
    (hotspot.issueCount > 0 || hotspot.approvalCount > 0 || hotspot.runtimeCount > 0)
  ) {
    return "chain-pass";
  }
  if (hotspot.criticalIssueCount > 0) {
    return "critical-pass";
  }
  if (hotspot.discoveryCount > 0) {
    return "discovery-pass";
  }
  if (hotspot.approvalCount > 0 || hotspot.runtimeCount > 0) {
    return "decision-pass";
  }
  return hotspot.issueCount > 0 ? "critical-pass" : "chain-pass";
}

import type { QuorumIdeaDossier } from "@founderos/api-clients";

export type ShellDiscoveryAuthoringGap =
  | "evidence"
  | "validation"
  | "decision"
  | "timeline";

export type ShellDiscoveryAuthoringStatus = "ready" | "partial" | "thin";

export interface ShellDiscoveryAuthoringSummary {
  status: ShellDiscoveryAuthoringStatus;
  coverageScore: number;
  gapCount: number;
  gaps: ShellDiscoveryAuthoringGap[];
  headline: string;
  detail: string;
  observationCount: number;
  evidenceCount: number;
  validationCount: number;
  decisionCount: number;
  timelineCount: number;
  overallConfidence: string;
  lastUpdatedAt: string | null;
}

function humanizeToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function maxIso(values: Array<string | null | undefined>) {
  let latestValue = "";
  let latestTimestamp = 0;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || timestamp <= latestTimestamp) {
      continue;
    }

    latestValue = value;
    latestTimestamp = timestamp;
  }

  return latestValue || null;
}

export function discoveryAuthoringStatusTone(status: ShellDiscoveryAuthoringStatus) {
  if (status === "ready") return "success" as const;
  if (status === "partial") return "warning" as const;
  return "danger" as const;
}

export function discoveryAuthoringGapLabel(gap: ShellDiscoveryAuthoringGap) {
  return gap === "timeline" ? "timeline coverage" : humanizeToken(gap);
}

export function buildShellDiscoveryAuthoringSummary(
  dossier: QuorumIdeaDossier
): ShellDiscoveryAuthoringSummary {
  const observationCount = dossier.observations.length;
  const evidenceCount = dossier.evidence_bundle?.items.length ?? 0;
  const validationCount = dossier.validation_reports.length;
  const decisionCount = dossier.decisions.length;
  const timelineCount = dossier.timeline.length;
  const stage = (dossier.idea.latest_stage || "").trim().toLowerCase();
  const hasEvidence = observationCount > 0 || evidenceCount > 0;
  const needsEvidence = !hasEvidence;
  const needsValidation = validationCount === 0 && stage !== "sourced";
  const needsDecision =
    decisionCount === 0 && !["sourced", "ranked"].includes(stage);
  const needsTimeline = timelineCount === 0 && stage !== "sourced";
  const gaps: ShellDiscoveryAuthoringGap[] = [];

  if (needsEvidence) {
    gaps.push("evidence");
  }
  if (needsValidation) {
    gaps.push("validation");
  }
  if (needsDecision) {
    gaps.push("decision");
  }
  if (needsTimeline) {
    gaps.push("timeline");
  }

  const coveredDimensions = [
    hasEvidence,
    validationCount > 0,
    decisionCount > 0,
    timelineCount > 0,
  ].filter(Boolean).length;
  const coverageScore = coveredDimensions / 4;
  const status: ShellDiscoveryAuthoringStatus =
    gaps.length === 0
      ? "ready"
      : coverageScore >= 0.5
        ? "partial"
        : "thin";
  const headline =
    gaps.length === 0
      ? "Authoring coverage ready inside the shell."
      : `Needs ${gaps.map(discoveryAuthoringGapLabel).join(", ")}.`;
  const detail = `${observationCount} observations · ${evidenceCount} evidence items · ${validationCount} validations · ${decisionCount} decisions · ${timelineCount} timeline events`;

  return {
    status,
    coverageScore,
    gapCount: gaps.length,
    gaps,
    headline,
    detail,
    observationCount,
    evidenceCount,
    validationCount,
    decisionCount,
    timelineCount,
    overallConfidence:
      dossier.evidence_bundle?.overall_confidence ||
      dossier.validation_reports[0]?.confidence ||
      "unknown",
    lastUpdatedAt: maxIso([
      dossier.evidence_bundle?.updated_at,
      ...dossier.observations.map((item) => item.captured_at),
      ...dossier.validation_reports.map((item) => item.updated_at || item.created_at),
      ...dossier.decisions.map((item) => item.created_at),
      ...dossier.timeline.map((item) => item.created_at),
    ]),
  };
}

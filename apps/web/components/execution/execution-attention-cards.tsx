"use client";

import { Badge } from "@founderos/ui/components/badge";
import {
  CheckCheck,
  ShieldAlert,
} from "lucide-react";
import type * as React from "react";

import {
  ShellRecordAccessory,
  ShellRecordActionBar,
  ShellRecordBody,
  ShellRecordCard,
  ShellRecordHeader,
  ShellRecordLinkButton,
  ShellRecordMeta,
  ShellRecordSection,
  ShellRecordSelectionButton,
} from "@/components/shell/shell-record-primitives";
import {
  ShellActionStateLabel,
  ShellPillButton,
} from "@/components/shell/shell-screen-primitives";
import {
  executionIssueSeverityTone,
  executionSourceLabel,
  executionSourceTone,
  executionStatusTone,
  humanizeAttentionToken as humanizeToken,
  type ApprovalAttentionRecord,
  type IssueAttentionRecord,
  type RuntimeAttentionRecord,
} from "@/lib/attention-records";
import {
  type ShellExecutionSourceContext,
} from "@/lib/execution-source";
import {
  buildExecutionSourceIntakeHref,
  buildExecutionSourceSettingsHref,
} from "@/lib/shell-entry-hrefs";

function formatDate(value?: string | null) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncate(value: string, limit: number = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 1).trimEnd()}...`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

const PREVIEW_PRIORITY_KEYS = [
  "message",
  "summary",
  "title",
  "command",
  "reason",
  "detail",
  "path",
  "target_path",
  "cwd",
  "branch",
  "repo",
  "endpoint",
  "mode",
  "status",
  "event",
  "tool_name",
  "tool_use_id",
];

function formatPreviewValue(value: unknown, depth: number = 0): string {
  if (depth > 2 || value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const parts = value
      .slice(0, 3)
      .map((entry) => formatPreviewValue(entry, depth + 1))
      .filter(Boolean);
    return parts.join(", ");
  }

  const record = asRecord(value);
  if (!record) {
    return "";
  }

  for (const key of PREVIEW_PRIORITY_KEYS) {
    const preview = formatPreviewValue(record[key], depth + 1);
    if (preview) {
      return preview;
    }
  }

  const entries = Object.entries(record)
    .map(([key, entry]) => {
      const preview = formatPreviewValue(entry, depth + 1);
      if (!preview) {
        return null;
      }
      return `${humanizeToken(key)} ${preview}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 2);

  return entries.join(" · ");
}

function extractPreviewRows(
  source: Record<string, unknown> | null,
  fields: Array<{ label: string; key: string }>
) {
  if (!source) {
    return [];
  }

  return fields
    .map((field) => {
      const value = formatPreviewValue(source[field.key]);
      if (!value) {
        return null;
      }
      return {
        label: field.label,
        value,
      };
    })
    .filter((row): row is { label: string; value: string } => row !== null);
}

function formatToolPermissionStage(value?: string | null): string {
  const normalized = (value || "").trim();
  if (normalized === "pending_user") return "Waiting for user";
  if (normalized === "pending_hook") return "Waiting for hook";
  if (normalized === "pending_classifier") return "Waiting for classifier";
  return normalized ? humanizeToken(normalized) : "Pending";
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return <ShellRecordLinkButton href={href} label={label} />;
}

function SelectionToggleButton({
  busyActionKey,
  onToggleSelected,
  selected,
}: {
  busyActionKey: string;
  onToggleSelected?: (() => void) | undefined;
  selected?: boolean | undefined;
}) {
  if (!onToggleSelected) {
    return null;
  }

  return (
    <ShellRecordSelectionButton
      selected={Boolean(selected)}
      onClick={onToggleSelected}
      disabled={busyActionKey.length > 0}
    />
  );
}

function PreviewPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <ShellRecordSection title={title}>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <div
            key={`${title}:${row.label}`}
            className="rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-panel-muted)]/38 px-3 py-2.5"
          >
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {row.label}
            </div>
            <div className="mt-1.5 break-words text-[12px] leading-5 text-foreground/84">
              {truncate(row.value, 160)}
            </div>
          </div>
        ))}
      </div>
    </ShellRecordSection>
  );
}

function SnapshotField({
  label,
  value,
  detail,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[13px] font-medium leading-5 text-foreground">{value}</div>
      {detail ? (
        <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</div>
      ) : null}
    </div>
  );
}

function SnapshotGrid({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ShellRecordSection title={title} className="bg-[color:var(--shell-panel-muted)]/34">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </ShellRecordSection>
  );
}

function ExecutionProvenancePanel({
  source,
}: {
  source: ShellExecutionSourceContext;
}) {
  const rows = [
    source.project
      ? {
          label: "Project",
          value: source.project.name,
        }
      : null,
    {
      label: "Source",
      value: executionSourceLabel(source.sourceKind),
    },
    source.sourceExternalId
      ? {
          label: "Source ref",
          value: source.sourceExternalId,
        }
      : null,
    source.intakeSession
      ? {
          label: "Intake session",
          value: source.intakeSession.title,
        }
      : null,
    source.discoveryIdeaTitle
      ? {
          label: "Discovery idea",
          value: source.discoveryIdeaTitle,
        }
      : null,
    source.briefId
      ? {
          label: "Brief id",
          value: source.briefId,
        }
      : null,
    source.chainKind !== "unlinked"
      ? {
          label: "Chain record",
          value: humanizeToken(source.chainKind),
        }
      : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  if (rows.length === 0) {
    return null;
  }

  return <PreviewPanel title="Execution provenance" rows={rows} />;
}

export function IssueAttentionCard({
  record,
  busyActionKey,
  onResolve,
  onToggleSelected,
  selected,
}: {
  record: IssueAttentionRecord;
  busyActionKey: string;
  onResolve: (record: IssueAttentionRecord) => Promise<void>;
  onToggleSelected?: (record: IssueAttentionRecord) => void;
  selected?: boolean;
}) {
  const resolveActionKey = `${record.key}:resolve`;
  const issueLinkRows = [
    {
      label: "Related command",
      value: formatPreviewValue(record.issue.related_command),
    },
    {
      label: "Source event",
      value: formatPreviewValue(record.issue.source_event),
    },
    {
      label: "Runtime agent",
      value: formatPreviewValue(record.issue.runtime_agent_id || record.issue.runtime_agent_ids),
    },
    {
      label: "Linked approval",
      value: formatPreviewValue(record.issue.approval_id),
    },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  const issueContextRows = extractPreviewRows(asRecord(record.issue.context), [
    { label: "Command", key: "command" },
    { label: "Message", key: "message" },
    { label: "Path", key: "path" },
    { label: "Branch", key: "branch" },
    { label: "Tool", key: "tool_name" },
    { label: "Tool use", key: "tool_use_id" },
    { label: "Story", key: "story_title" },
    { label: "Workspace", key: "cwd" },
  ]);
  const settingsHref = buildExecutionSourceSettingsHref(record.source);
  const intakeHref = buildExecutionSourceIntakeHref(record.source);

  return (
    <ShellRecordCard selected={selected}>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone="neutral">execution</Badge>
            <Badge tone="danger">issue</Badge>
            <Badge tone={executionIssueSeverityTone(record.issue.severity)}>
              {record.issue.severity}
            </Badge>
            <Badge tone={executionSourceTone(record.source.sourceKind)}>
              {executionSourceLabel(record.source.sourceKind)}
            </Badge>
            <Badge tone={executionStatusTone(record.status)}>{record.status}</Badge>
          </>
        }
        title={record.title}
        description={truncate(record.detail, 280)}
        accessory={
          <div className="flex flex-col items-end gap-2">
            <SelectionToggleButton
              busyActionKey={busyActionKey}
              selected={selected}
              onToggleSelected={
                onToggleSelected ? () => onToggleSelected(record) : undefined
              }
            />
            <ShellRecordAccessory
              label="Project"
              value={record.issue.project_name}
              detail={`Updated ${formatDate(record.issue.updated_at)}`}
            />
          </div>
        }
      />

      <ShellRecordBody>
        <SnapshotGrid title="Issue snapshot">
          <SnapshotField
            label="Severity"
            value={
              <Badge tone={executionIssueSeverityTone(record.issue.severity)}>
                {record.issue.severity}
              </Badge>
            }
            detail={record.issue.category}
          />
          <SnapshotField
            label="Project"
            value={record.issue.project_name}
            detail={`Updated ${formatDate(record.issue.updated_at)}`}
          />
          <SnapshotField
            label="Status"
            value={<Badge tone={executionStatusTone(record.status)}>{record.status}</Badge>}
            detail={record.issue.orchestrator}
          />
          <SnapshotField
            label="Story"
            value={
              typeof record.issue.story_id === "number"
                ? `#${record.issue.story_id}`
                : "Not linked"
            }
            detail={record.issue.category}
          />
        </SnapshotGrid>
        <ShellRecordSection title="Root cause">
          <p className="text-[13px] leading-6 text-muted-foreground">
            {truncate(record.issue.root_cause || "Not recorded.", 220)}
          </p>
        </ShellRecordSection>
        <ExecutionProvenancePanel source={record.source} />
        <PreviewPanel title="Linked execution context" rows={issueLinkRows} />
        <PreviewPanel title="Issue context preview" rows={issueContextRows} />

        <ShellRecordMeta>
          <span>{record.issue.category}</span>
          {typeof record.issue.story_id === "number" ? (
            <span>story #{record.issue.story_id}</span>
          ) : null}
          <span>{record.issue.orchestrator}</span>
          <span>updated {formatDate(record.issue.updated_at)}</span>
        </ShellRecordMeta>

        <ShellRecordActionBar>
          <ActionLink href={record.href} label={record.hrefLabel} />
          <ActionLink href={settingsHref} label="Open scoped settings" />
          {intakeHref ? (
            <ActionLink
              href={intakeHref}
              label={
                record.source.intakeSession ? "Open intake session" : "Open intake route"
              }
            />
          ) : null}
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onResolve(record)}
            disabled={busyActionKey.length > 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === resolveActionKey}
              idleLabel="Resolve issue"
              busyLabel="Resolve issue"
              icon={<CheckCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

export function ApprovalAttentionCard({
  record,
  busyActionKey,
  onApprove,
  onReject,
  onToggleSelected,
  selected,
}: {
  record: ApprovalAttentionRecord;
  busyActionKey: string;
  onApprove: (record: ApprovalAttentionRecord) => Promise<void>;
  onReject: (record: ApprovalAttentionRecord) => Promise<void>;
  onToggleSelected?: (record: ApprovalAttentionRecord) => void;
  selected?: boolean;
}) {
  const approveActionKey = `${record.key}:approve`;
  const rejectActionKey = `${record.key}:reject`;
  const approvalContextRows = [
    {
      label: "Linked issue",
      value: formatPreviewValue(record.approval.issue_id),
    },
    {
      label: "Runtime agents",
      value: formatPreviewValue(record.approval.runtime_agent_ids),
    },
    {
      label: "Orchestrator",
      value: formatPreviewValue(record.approval.orchestrator),
    },
    {
      label: "Run id",
      value: formatPreviewValue(record.approval.orchestration_run_id),
    },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  const approvalPayloadRows = extractPreviewRows(asRecord(record.approval.payload), [
    { label: "Command", key: "command" },
    { label: "Summary", key: "summary" },
    { label: "Message", key: "message" },
    { label: "Path", key: "path" },
    { label: "Target path", key: "target_path" },
    { label: "Workspace", key: "cwd" },
    { label: "Mode", key: "mode" },
    { label: "Endpoint", key: "endpoint" },
    { label: "Branch", key: "branch" },
  ]);
  const settingsHref = buildExecutionSourceSettingsHref(record.source);
  const intakeHref = buildExecutionSourceIntakeHref(record.source);

  return (
    <ShellRecordCard selected={selected}>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone="neutral">execution</Badge>
            <Badge tone="warning">approval</Badge>
            <Badge tone="neutral">{humanizeToken(record.approval.action)}</Badge>
            <Badge tone={executionSourceTone(record.source.sourceKind)}>
              {executionSourceLabel(record.source.sourceKind)}
            </Badge>
            <Badge tone={executionStatusTone(record.status)}>{record.status}</Badge>
          </>
        }
        title={record.title}
        description={truncate(record.detail, 280)}
        accessory={
          <div className="flex flex-col items-end gap-2">
            <SelectionToggleButton
              busyActionKey={busyActionKey}
              selected={selected}
              onToggleSelected={
                onToggleSelected ? () => onToggleSelected(record) : undefined
              }
            />
            <ShellRecordAccessory
              label="Requested by"
              value={record.approval.requested_by || "unknown"}
              detail={`Created ${formatDate(record.approval.created_at)}`}
            />
          </div>
        }
      />

      <ShellRecordBody>
        <SnapshotGrid title="Approval snapshot">
          <SnapshotField
            label="Action"
            value={<Badge tone="neutral">{humanizeToken(record.approval.action)}</Badge>}
            detail={record.approval.project_name}
          />
          <SnapshotField
            label="Requested by"
            value={record.approval.requested_by || "unknown"}
            detail={`Created ${formatDate(record.approval.created_at)}`}
          />
          <SnapshotField
            label="Status"
            value={<Badge tone={executionStatusTone(record.status)}>{record.status}</Badge>}
            detail={`${record.approval.runtime_agent_ids.length} runtime agents`}
          />
          <SnapshotField
            label="Linked issue"
            value={formatPreviewValue(record.approval.issue_id) || "None"}
            detail={record.approval.orchestrator}
          />
        </SnapshotGrid>
        {record.approval.policy_reasons.length > 0 ? (
          <ShellRecordSection title="Policy reasons">
            <div className="mt-3 flex flex-wrap gap-2">
              {record.approval.policy_reasons.slice(0, 4).map((reason) => (
                <Badge key={reason} tone="neutral">
                  {truncate(reason, 42)}
                </Badge>
              ))}
            </div>
          </ShellRecordSection>
        ) : null}

        <ExecutionProvenancePanel source={record.source} />
        <PreviewPanel title="Approval context" rows={approvalContextRows} />
        <PreviewPanel title="Approval payload preview" rows={approvalPayloadRows} />

        <ShellRecordMeta>
          <span>{record.approval.project_name}</span>
          <span>{record.approval.runtime_agent_ids.length} runtime agents</span>
          <span>created {formatDate(record.approval.created_at)}</span>
        </ShellRecordMeta>

        <ShellRecordActionBar>
          <ActionLink href={record.href} label={record.hrefLabel} />
          <ActionLink href={settingsHref} label="Open scoped settings" />
          {intakeHref ? (
            <ActionLink
              href={intakeHref}
              label={
                record.source.intakeSession ? "Open intake session" : "Open intake route"
              }
            />
          ) : null}
          <ShellPillButton
            type="button"
            tone="primary"
            onClick={() => void onApprove(record)}
            disabled={busyActionKey.length > 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === approveActionKey}
              idleLabel="Approve"
              busyLabel="Approve"
              icon={<CheckCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onReject(record)}
            disabled={busyActionKey.length > 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === rejectActionKey}
              idleLabel="Reject"
              busyLabel="Reject"
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </ShellPillButton>
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

export function RuntimeAttentionCard({
  record,
  busyActionKey,
  onAllow,
  onDeny,
  onToggleSelected,
  selected,
}: {
  record: RuntimeAttentionRecord;
  busyActionKey: string;
  onAllow: (record: RuntimeAttentionRecord) => Promise<void>;
  onDeny: (record: RuntimeAttentionRecord) => Promise<void>;
  onToggleSelected?: (record: RuntimeAttentionRecord) => void;
  selected?: boolean;
}) {
  const allowActionKey = `${record.key}:allow`;
  const denyActionKey = `${record.key}:deny`;
  const stagePayload = asRecord(
    record.runtime.pending_stage ? record.runtime.payload?.[record.runtime.pending_stage] : null
  );
  const runtimeContextRows = [
    {
      label: "Stage",
      value: formatToolPermissionStage(record.runtime.pending_stage),
    },
    {
      label: "Linked approval",
      value: formatPreviewValue(record.runtime.approval_id),
    },
    {
      label: "Linked issue",
      value: formatPreviewValue(record.runtime.issue_id),
    },
    {
      label: "Runtime agents",
      value: formatPreviewValue(record.runtime.runtime_agent_ids),
    },
    {
      label: "Resolved source",
      value: formatPreviewValue(record.runtime.resolved_source || record.runtime.winner_source),
    },
    {
      label: "Behavior",
      value: formatPreviewValue(record.runtime.resolved_behavior),
    },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  const runtimePayloadRows = extractPreviewRows(stagePayload, [
    { label: "Message", key: "message" },
    { label: "Command", key: "command" },
    { label: "Reason", key: "reason" },
    { label: "Path", key: "path" },
    { label: "Workspace", key: "cwd" },
    { label: "Tool", key: "tool_name" },
  ]);
  const settingsHref = buildExecutionSourceSettingsHref(record.source);
  const intakeHref = buildExecutionSourceIntakeHref(record.source);

  return (
    <ShellRecordCard selected={selected}>
      <ShellRecordHeader
        badges={
          <>
            <Badge tone="neutral">execution</Badge>
            <Badge tone="warning">tool permission</Badge>
            <Badge tone="neutral">{formatToolPermissionStage(record.runtime.pending_stage)}</Badge>
            <Badge tone={executionSourceTone(record.source.sourceKind)}>
              {executionSourceLabel(record.source.sourceKind)}
            </Badge>
            <Badge tone={executionStatusTone(record.status)}>{record.status}</Badge>
          </>
        }
        title={record.title}
        description={truncate(record.detail, 280)}
        accessory={
          <div className="flex flex-col items-end gap-2">
            <SelectionToggleButton
              busyActionKey={busyActionKey}
              selected={selected}
              onToggleSelected={
                onToggleSelected ? () => onToggleSelected(record) : undefined
              }
            />
            <ShellRecordAccessory
              label="Winner source"
              value={record.runtime.winner_source || "pending"}
              detail={`Updated ${formatDate(record.runtime.updated_at)}`}
            />
          </div>
        }
      />

      <ShellRecordBody>
        <SnapshotGrid title="Permission snapshot">
          <SnapshotField
            label="Stage"
            value={<Badge tone="neutral">{formatToolPermissionStage(record.runtime.pending_stage)}</Badge>}
            detail={record.runtime.tool_name}
          />
          <SnapshotField
            label="Outcome"
            value={record.runtime.outcome || "pending"}
            detail={record.runtime.resolved_behavior || "Behavior unresolved"}
          />
          <SnapshotField
            label="Winner source"
            value={record.runtime.winner_source || "pending"}
            detail={`Updated ${formatDate(record.runtime.updated_at)}`}
          />
          <SnapshotField
            label="Linked approval"
            value={formatPreviewValue(record.runtime.approval_id) || "None"}
            detail={`${record.runtime.runtime_agent_ids.length} runtime agents`}
          />
        </SnapshotGrid>
        <ShellRecordSection title="Permission context">
          <p className="text-[13px] leading-6 text-muted-foreground">
            Tool use {record.runtime.tool_use_id || "n/a"} · outcome{" "}
            {record.runtime.outcome || "pending"} · resolved behavior{" "}
            {record.runtime.resolved_behavior || "n/a"}.
          </p>
        </ShellRecordSection>

        <ExecutionProvenancePanel source={record.source} />
        <PreviewPanel title="Tool permission context" rows={runtimeContextRows} />
        <PreviewPanel title="Pending stage payload" rows={runtimePayloadRows} />

        <ShellRecordMeta>
          <span>{record.runtime.tool_name}</span>
          <span>{record.runtime.runtime_agent_ids.length} runtime agents</span>
          <span>updated {formatDate(record.runtime.updated_at)}</span>
        </ShellRecordMeta>

        <ShellRecordActionBar>
          <ActionLink href={record.href} label={record.hrefLabel} />
          <ActionLink href={settingsHref} label="Open scoped settings" />
          {intakeHref ? (
            <ActionLink
              href={intakeHref}
              label={
                record.source.intakeSession ? "Open intake session" : "Open intake route"
              }
            />
          ) : null}
          <ShellPillButton
            type="button"
            tone="primary"
            onClick={() => void onAllow(record)}
            disabled={busyActionKey.length > 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === allowActionKey}
              idleLabel="Allow"
              busyLabel="Allow"
              icon={<CheckCheck className="h-4 w-4" />}
            />
          </ShellPillButton>
          <ShellPillButton
            type="button"
            tone="outline"
            onClick={() => void onDeny(record)}
            disabled={busyActionKey.length > 0}
          >
            <ShellActionStateLabel
              busy={busyActionKey === denyActionKey}
              idleLabel="Deny"
              busyLabel="Deny"
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </ShellPillButton>
        </ShellRecordActionBar>
      </ShellRecordBody>
    </ShellRecordCard>
  );
}

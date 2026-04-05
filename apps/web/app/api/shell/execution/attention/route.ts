import { NextResponse } from "next/server";
import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotToolPermissionRuntimeRecord,
} from "@founderos/api-clients";

import { buildUpstreamQuery, requestUpstreamJson } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "all";

  const query = buildUpstreamQuery({
    project_id: url.searchParams.get("project_id"),
    initiative_id: url.searchParams.get("initiative_id"),
    orchestrator: url.searchParams.get("orchestrator"),
    status: url.searchParams.get("status"),
    category: url.searchParams.get("category"),
    action: url.searchParams.get("action"),
    runtime_agent_id: url.searchParams.get("runtime_agent_id"),
    pending_stage: url.searchParams.get("pending_stage"),
  });

  try {
    if (kind === "issues") {
      const payload = await requestUpstreamJson<{
        issues: AutopilotExecutionIssueRecord[];
      }>(
        "autopilot",
        "execution-plane/issues",
        query
      );
      return NextResponse.json(payload);
    }

    if (kind === "approvals") {
      const payload = await requestUpstreamJson<{
        approvals: AutopilotExecutionApprovalRecord[];
      }>(
        "autopilot",
        "execution-plane/approvals",
        query
      );
      return NextResponse.json(payload);
    }

    if (kind === "runtimes") {
      const payload = await requestUpstreamJson<{
        runtimes: AutopilotToolPermissionRuntimeRecord[];
      }>(
        "autopilot",
        "execution-plane/tool-permission-runtimes",
        query
      );
      return NextResponse.json(payload);
    }

    const [issues, approvals, runtimes] = await Promise.all([
      requestUpstreamJson<{ issues: AutopilotExecutionIssueRecord[] }>(
        "autopilot",
        "execution-plane/issues",
        query
      ),
      requestUpstreamJson<{ approvals: AutopilotExecutionApprovalRecord[] }>(
        "autopilot",
        "execution-plane/approvals",
        query
      ),
      requestUpstreamJson<{ runtimes: AutopilotToolPermissionRuntimeRecord[] }>(
        "autopilot",
        "execution-plane/tool-permission-runtimes",
        query
      ),
    ]);

    return NextResponse.json({
      issues: issues.issues,
      approvals: approvals.approvals,
      runtimes: runtimes.runtimes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Execution attention request failed.",
      },
      { status: 502 }
    );
  }
}

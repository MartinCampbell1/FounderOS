import { NextResponse } from "next/server";

import {
  createExecutionBriefHandoff,
  listExecutionBriefHandoffs,
} from "@/lib/execution-brief-handoffs";
import {
  enforceShellAdminRequest,
  isSameOriginMutation,
  isShellBodyTooLarge,
  maxShellBodyBytes,
} from "@/lib/shell-security";

const ALLOWED_SOURCE_PLANES = new Set(["discovery", "execution"]);
const ALLOWED_BRIEF_KINDS = new Set([
  "quorum_execution_brief",
  "shared_execution_brief",
  "execution_brief_v2",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  try {
    const handoffs = listExecutionBriefHandoffs();
    return NextResponse.json({ status: "ok", handoffs });
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Execution brief handoff store is unavailable.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const denial = enforceShellAdminRequest(request);
  if (denial) {
    return denial;
  }

  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { detail: "Cross-site execution brief handoff writes are not allowed." },
      { status: 403 },
    );
  }

  if (isShellBodyTooLarge(request)) {
    return NextResponse.json(
      {
        detail: `Execution brief handoff payload exceeds ${maxShellBodyBytes()} bytes.`,
      },
      { status: 413 },
    );
  }

  let payload: {
    source_plane?: string;
    source_session_id?: string | null;
    brief_kind?: string;
    brief?: Record<string, unknown> | null;
    default_project_name?: string | null;
    recommended_launch_preset_id?: string | null;
    launch_intent?: string | null;
  };

  try {
    payload = (await request.json()) as {
      source_plane?: string;
      source_session_id?: string | null;
      brief_kind?: string;
      brief?: Record<string, unknown> | null;
      default_project_name?: string | null;
      recommended_launch_preset_id?: string | null;
      launch_intent?: string | null;
    };
  } catch {
    return NextResponse.json(
      { detail: "Execution brief handoff payload must be valid JSON." },
      { status: 400 },
    );
  }

  if (!payload.brief || !isRecord(payload.brief)) {
    return NextResponse.json(
      { detail: "Execution brief handoff payload requires a `brief` object." },
      { status: 400 },
    );
  }

  const sourcePlane = String(payload.source_plane || "discovery").trim();
  if (!ALLOWED_SOURCE_PLANES.has(sourcePlane)) {
    return NextResponse.json(
      {
        detail:
          "Execution brief handoff payload has an unsupported `source_plane`.",
      },
      { status: 400 },
    );
  }

  const briefKind = String(
    payload.brief_kind || "quorum_execution_brief",
  ).trim();
  if (!ALLOWED_BRIEF_KINDS.has(briefKind)) {
    return NextResponse.json(
      {
        detail:
          "Execution brief handoff payload has an unsupported `brief_kind`.",
      },
      { status: 400 },
    );
  }

  const briefId = payload.brief.brief_id;
  const title = payload.brief.title;
  if (typeof briefId !== "string" || !briefId.trim()) {
    return NextResponse.json(
      { detail: "Execution brief handoff payload requires `brief.brief_id`." },
      { status: 400 },
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { detail: "Execution brief handoff payload requires `brief.title`." },
      { status: 400 },
    );
  }

  try {
    const handoff = createExecutionBriefHandoff({
      source_plane: sourcePlane,
      source_session_id: payload.source_session_id ?? null,
      brief_kind: briefKind,
      brief: payload.brief,
      default_project_name: payload.default_project_name ?? null,
      recommended_launch_preset_id:
        payload.recommended_launch_preset_id ?? null,
      launch_intent: payload.launch_intent ?? null,
    });

    return NextResponse.json({ status: "ok", handoff });
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Execution brief handoff store is unavailable.",
      },
      { status: 503 },
    );
  }
}

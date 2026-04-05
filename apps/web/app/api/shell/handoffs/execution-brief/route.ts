import { NextResponse } from "next/server";

import { createExecutionBriefHandoff } from "@/lib/execution-brief-handoffs";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    source_plane?: string;
    source_session_id?: string | null;
    brief_kind?: string;
    brief?: Record<string, unknown> | null;
    default_project_name?: string | null;
    recommended_launch_preset_id?: string | null;
    launch_intent?: string | null;
  };

  if (!payload.brief || typeof payload.brief !== "object") {
    return NextResponse.json(
      { detail: "Execution brief handoff payload requires a `brief` object." },
      { status: 400 }
    );
  }

  const handoff = createExecutionBriefHandoff({
    source_plane: payload.source_plane || "discovery",
    source_session_id: payload.source_session_id ?? null,
    brief_kind: payload.brief_kind || "quorum_execution_brief",
    brief: payload.brief,
    default_project_name: payload.default_project_name ?? null,
    recommended_launch_preset_id: payload.recommended_launch_preset_id ?? null,
    launch_intent: payload.launch_intent ?? null,
  });

  return NextResponse.json({ status: "ok", handoff });
}

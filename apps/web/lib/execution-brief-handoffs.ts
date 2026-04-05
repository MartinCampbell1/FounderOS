import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface ExecutionBriefHandoffRecord {
  id: string;
  source_plane: "discovery" | string;
  source_session_id?: string | null;
  brief_kind: "quorum_execution_brief" | "shared_execution_brief" | string;
  brief: Record<string, unknown>;
  default_project_name?: string | null;
  recommended_launch_preset_id?: string | null;
  launch_intent?: "create" | "launch" | string | null;
  created_at: string;
  expires_at: string;
}

export interface ExecutionBriefHandoffStoreAudit {
  path: string;
  handoffCount: number;
  status: "ok" | "error";
  detail: string;
}

const HANDOFF_TTL_MS = 1000 * 60 * 30;
const HANDOFF_STORE_PATH =
  process.env.FOUNDEROS_EXECUTION_HANDOFF_STORE_PATH ||
  join(tmpdir(), "founderos-shell", "execution-brief-handoffs.json");

function readHandoffStore() {
  try {
    const payload = JSON.parse(
      readFileSync(/* turbopackIgnore: true */ HANDOFF_STORE_PATH, "utf8")
    ) as { handoffs?: ExecutionBriefHandoffRecord[] };
    const entries = Array.isArray(payload.handoffs) ? payload.handoffs : [];
    return new Map(entries.map((record) => [record.id, record]));
  } catch {
    return new Map<string, ExecutionBriefHandoffRecord>();
  }
}

function writeHandoffStore(store: Map<string, ExecutionBriefHandoffRecord>) {
  mkdirSync(dirname(/* turbopackIgnore: true */ HANDOFF_STORE_PATH), {
    recursive: true,
  });
  writeFileSync(
    /* turbopackIgnore: true */ HANDOFF_STORE_PATH,
    JSON.stringify({ handoffs: [...store.values()] }, null, 2),
    "utf8"
  );
}

function cleanupExpiredHandoffs(
  handoffStore: Map<string, ExecutionBriefHandoffRecord>,
  now = Date.now()
) {
  for (const [id, record] of handoffStore.entries()) {
    const expiresAt = Date.parse(record.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt > now) {
      continue;
    }
    handoffStore.delete(id);
  }
}

export function createExecutionBriefHandoff(input: {
  source_plane: "discovery" | string;
  source_session_id?: string | null;
  brief_kind: "quorum_execution_brief" | "shared_execution_brief" | string;
  brief: Record<string, unknown>;
  default_project_name?: string | null;
  recommended_launch_preset_id?: string | null;
  launch_intent?: "create" | "launch" | string | null;
}): ExecutionBriefHandoffRecord {
  const handoffStore = readHandoffStore();
  cleanupExpiredHandoffs(handoffStore);

  const now = new Date();
  const record: ExecutionBriefHandoffRecord = {
    id: randomUUID(),
    source_plane: input.source_plane,
    source_session_id: input.source_session_id ?? null,
    brief_kind: input.brief_kind,
    brief: input.brief,
    default_project_name: input.default_project_name ?? null,
    recommended_launch_preset_id: input.recommended_launch_preset_id ?? null,
    launch_intent: input.launch_intent ?? null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + HANDOFF_TTL_MS).toISOString(),
  };

  handoffStore.set(record.id, record);
  writeHandoffStore(handoffStore);
  return record;
}

export function getExecutionBriefHandoff(
  handoffId: string
): ExecutionBriefHandoffRecord | null {
  const handoffStore = readHandoffStore();
  cleanupExpiredHandoffs(handoffStore);
  writeHandoffStore(handoffStore);
  return handoffStore.get(handoffId) ?? null;
}

export function inspectExecutionBriefHandoffStore(): ExecutionBriefHandoffStoreAudit {
  try {
    const handoffStore = readHandoffStore();
    cleanupExpiredHandoffs(handoffStore);
    writeHandoffStore(handoffStore);
    return {
      path: HANDOFF_STORE_PATH,
      handoffCount: handoffStore.size,
      status: "ok",
      detail:
        handoffStore.size > 0
          ? `Execution brief handoff store is writable with ${handoffStore.size} active handoff records.`
          : "Execution brief handoff store is writable and currently empty.",
    };
  } catch (error) {
    return {
      path: HANDOFF_STORE_PATH,
      handoffCount: 0,
      status: "error",
      detail:
        error instanceof Error
          ? `Execution brief handoff store check failed: ${error.message}`
          : "Execution brief handoff store check failed.",
    };
  }
}

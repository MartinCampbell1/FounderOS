import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
const MAX_HANDOFFS = 200;
const HANDOFF_STORE_PATH =
  process.env.FOUNDEROS_EXECUTION_HANDOFF_STORE_PATH ||
  join(process.cwd(), ".founderos-shell", "execution-brief-handoffs.json");

function assertHandoffStoreConfigured() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Execution brief handoff store is disabled in production until a durable shared datastore replaces the filesystem bridge.",
    );
  }
}

function readHandoffStore() {
  assertHandoffStoreConfigured();
  try {
    const payload = JSON.parse(
      readFileSync(/* turbopackIgnore: true */ HANDOFF_STORE_PATH, "utf8"),
    ) as { handoffs?: ExecutionBriefHandoffRecord[] };
    const entries = Array.isArray(payload.handoffs) ? payload.handoffs : [];
    return new Map(entries.map((record) => [record.id, record]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return new Map<string, ExecutionBriefHandoffRecord>();
    }
    throw error;
  }
}

function writeHandoffStore(store: Map<string, ExecutionBriefHandoffRecord>) {
  assertHandoffStoreConfigured();
  mkdirSync(dirname(/* turbopackIgnore: true */ HANDOFF_STORE_PATH), {
    recursive: true,
  });
  const tempPath = `${HANDOFF_STORE_PATH}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(
    /* turbopackIgnore: true */ tempPath,
    JSON.stringify({ handoffs: [...store.values()] }, null, 2),
    "utf8",
  );
  renameSync(
    /* turbopackIgnore: true */ tempPath,
    /* turbopackIgnore: true */ HANDOFF_STORE_PATH,
  );
}

function cleanupExpiredHandoffs(
  handoffStore: Map<string, ExecutionBriefHandoffRecord>,
  now = Date.now(),
) {
  for (const [id, record] of handoffStore.entries()) {
    const expiresAt = Date.parse(record.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt > now) {
      continue;
    }
    handoffStore.delete(id);
  }

  const records = [...handoffStore.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  for (const record of records.slice(MAX_HANDOFFS)) {
    handoffStore.delete(record.id);
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
  handoffId: string,
): ExecutionBriefHandoffRecord | null {
  const handoffStore = readHandoffStore();
  cleanupExpiredHandoffs(handoffStore);
  writeHandoffStore(handoffStore);
  return handoffStore.get(handoffId) ?? null;
}

export function listExecutionBriefHandoffs(): ExecutionBriefHandoffRecord[] {
  const handoffStore = readHandoffStore();
  cleanupExpiredHandoffs(handoffStore);
  writeHandoffStore(handoffStore);
  return [...handoffStore.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
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

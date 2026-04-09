import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { Pool } from "pg";

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
const HANDOFF_DATABASE_URL =
  process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL?.trim() || "";

type HandoffStoreMode = "postgres" | "filesystem";

const globalHandoffState = globalThis as typeof globalThis & {
  __FOUNDEROS_EXECUTION_HANDOFF_POOL__?: Pool;
  __FOUNDEROS_EXECUTION_HANDOFF_SCHEMA_READY__?: boolean;
};

function handoffStoreMode(): HandoffStoreMode {
  if (HANDOFF_DATABASE_URL) {
    return "postgres";
  }
  return "filesystem";
}

function assertFilesystemStoreAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Execution brief handoff store requires FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL in production.",
    );
  }
}

function readFilesystemStore() {
  assertFilesystemStoreAllowed();
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

function writeFilesystemStore(store: Map<string, ExecutionBriefHandoffRecord>) {
  assertFilesystemStoreAllowed();
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

function cleanupFilesystemHandoffs(
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

function getHandoffPool() {
  if (!globalHandoffState.__FOUNDEROS_EXECUTION_HANDOFF_POOL__) {
    globalHandoffState.__FOUNDEROS_EXECUTION_HANDOFF_POOL__ = new Pool({
      connectionString: HANDOFF_DATABASE_URL,
      max: 5,
    });
  }
  return globalHandoffState.__FOUNDEROS_EXECUTION_HANDOFF_POOL__;
}

async function ensurePostgresSchema(pool: Pool) {
  if (globalHandoffState.__FOUNDEROS_EXECUTION_HANDOFF_SCHEMA_READY__) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS execution_brief_handoffs (
      id TEXT PRIMARY KEY,
      source_plane TEXT NOT NULL,
      source_session_id TEXT NULL,
      brief_kind TEXT NOT NULL,
      brief JSONB NOT NULL,
      default_project_name TEXT NULL,
      recommended_launch_preset_id TEXT NULL,
      launch_intent TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_execution_brief_handoffs_expires_at ON execution_brief_handoffs (expires_at)`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_execution_brief_handoffs_created_at ON execution_brief_handoffs (created_at DESC)`,
  );

  globalHandoffState.__FOUNDEROS_EXECUTION_HANDOFF_SCHEMA_READY__ = true;
}

function normalizeRow(
  record: Record<string, unknown>,
): ExecutionBriefHandoffRecord {
  return {
    id: String(record.id || ""),
    source_plane: String(record.source_plane || "discovery"),
    source_session_id:
      record.source_session_id == null
        ? null
        : String(record.source_session_id),
    brief_kind: String(record.brief_kind || "quorum_execution_brief"),
    brief: (record.brief as Record<string, unknown>) || {},
    default_project_name:
      record.default_project_name == null
        ? null
        : String(record.default_project_name),
    recommended_launch_preset_id:
      record.recommended_launch_preset_id == null
        ? null
        : String(record.recommended_launch_preset_id),
    launch_intent:
      record.launch_intent == null ? null : String(record.launch_intent),
    created_at: String(record.created_at || ""),
    expires_at: String(record.expires_at || ""),
  };
}

async function cleanupPostgresHandoffs(pool: Pool) {
  await pool.query(
    `DELETE FROM execution_brief_handoffs WHERE expires_at <= NOW()`,
  );
  await pool.query(
    `
      DELETE FROM execution_brief_handoffs
      WHERE id IN (
        SELECT id FROM execution_brief_handoffs
        ORDER BY created_at DESC
        OFFSET $1
      )
    `,
    [MAX_HANDOFFS],
  );
}

async function createPostgresExecutionBriefHandoff(input: {
  source_plane: string;
  source_session_id?: string | null;
  brief_kind: string;
  brief: Record<string, unknown>;
  default_project_name?: string | null;
  recommended_launch_preset_id?: string | null;
  launch_intent?: string | null;
}) {
  const pool = getHandoffPool();
  await ensurePostgresSchema(pool);
  await cleanupPostgresHandoffs(pool);

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

  await pool.query(
    `
      INSERT INTO execution_brief_handoffs (
        id,
        source_plane,
        source_session_id,
        brief_kind,
        brief,
        default_project_name,
        recommended_launch_preset_id,
        launch_intent,
        created_at,
        expires_at
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
    `,
    [
      record.id,
      record.source_plane,
      record.source_session_id,
      record.brief_kind,
      JSON.stringify(record.brief),
      record.default_project_name,
      record.recommended_launch_preset_id,
      record.launch_intent,
      record.created_at,
      record.expires_at,
    ],
  );

  return record;
}

async function getPostgresExecutionBriefHandoff(handoffId: string) {
  const pool = getHandoffPool();
  await ensurePostgresSchema(pool);
  await cleanupPostgresHandoffs(pool);
  const result = await pool.query(
    `
      SELECT *
      FROM execution_brief_handoffs
      WHERE id = $1 AND expires_at > NOW()
      LIMIT 1
    `,
    [handoffId],
  );
  if (result.rowCount === 0) {
    return null;
  }
  return normalizeRow(result.rows[0] as Record<string, unknown>);
}

async function listPostgresExecutionBriefHandoffs() {
  const pool = getHandoffPool();
  await ensurePostgresSchema(pool);
  await cleanupPostgresHandoffs(pool);
  const result = await pool.query(
    `
      SELECT *
      FROM execution_brief_handoffs
      WHERE expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [MAX_HANDOFFS],
  );
  return result.rows.map((row: Record<string, unknown>) => normalizeRow(row));
}

async function inspectPostgresExecutionBriefHandoffStore() {
  const pool = getHandoffPool();
  await ensurePostgresSchema(pool);
  await cleanupPostgresHandoffs(pool);
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM execution_brief_handoffs WHERE expires_at > NOW()`,
  );
  const handoffCount = Number(
    (result.rows[0] as { count?: number }).count || 0,
  );
  return {
    path: "postgres://configured",
    handoffCount,
    status: "ok" as const,
    detail:
      handoffCount > 0
        ? `Execution brief handoff store is writable via Postgres with ${handoffCount} active handoff records.`
        : "Execution brief handoff store is writable via Postgres and currently empty.",
  };
}

export async function createExecutionBriefHandoff(input: {
  source_plane: "discovery" | string;
  source_session_id?: string | null;
  brief_kind: "quorum_execution_brief" | "shared_execution_brief" | string;
  brief: Record<string, unknown>;
  default_project_name?: string | null;
  recommended_launch_preset_id?: string | null;
  launch_intent?: "create" | "launch" | string | null;
}): Promise<ExecutionBriefHandoffRecord> {
  if (handoffStoreMode() === "postgres") {
    return await createPostgresExecutionBriefHandoff(input);
  }

  const handoffStore = readFilesystemStore();
  cleanupFilesystemHandoffs(handoffStore);

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
  writeFilesystemStore(handoffStore);
  return record;
}

export async function getExecutionBriefHandoff(
  handoffId: string,
): Promise<ExecutionBriefHandoffRecord | null> {
  if (handoffStoreMode() === "postgres") {
    return await getPostgresExecutionBriefHandoff(handoffId);
  }

  const handoffStore = readFilesystemStore();
  cleanupFilesystemHandoffs(handoffStore);
  writeFilesystemStore(handoffStore);
  return handoffStore.get(handoffId) ?? null;
}

export async function listExecutionBriefHandoffs(): Promise<
  ExecutionBriefHandoffRecord[]
> {
  if (handoffStoreMode() === "postgres") {
    return await listPostgresExecutionBriefHandoffs();
  }

  const handoffStore = readFilesystemStore();
  cleanupFilesystemHandoffs(handoffStore);
  writeFilesystemStore(handoffStore);
  return [...handoffStore.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}

export async function inspectExecutionBriefHandoffStore(): Promise<ExecutionBriefHandoffStoreAudit> {
  try {
    if (handoffStoreMode() === "postgres") {
      return await inspectPostgresExecutionBriefHandoffStore();
    }

    const handoffStore = readFilesystemStore();
    cleanupFilesystemHandoffs(handoffStore);
    writeFilesystemStore(handoffStore);
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
      path:
        handoffStoreMode() === "postgres"
          ? "postgres://configured"
          : HANDOFF_STORE_PATH,
      handoffCount: 0,
      status: "error",
      detail:
        error instanceof Error
          ? `Execution brief handoff store check failed: ${error.message}`
          : "Execution brief handoff store check failed.",
    };
  }
}

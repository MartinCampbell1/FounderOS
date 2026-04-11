"use client";

import type { AutopilotExecutionEventRecord } from "@founderos/api-clients";
import { useEffect, useRef, useState } from "react";

import type { ShellRouteScope } from "@/lib/route-scope";

const DEFAULT_RECONNECT_DELAY_MS = 3000;

export type ExecutionEventStreamState =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "error";

export type ExecutionLiveEventFilters = {
  projectId?: string | null;
  runtimeAgentId?: string | null;
  orchestratorSessionId?: string | null;
  initiativeId?: string | null;
  orchestrator?: string | null;
};

type ParsedSSEFrame = {
  event: string;
  data: string;
  eventId: string | null;
};

function normalizeValue(value?: string | null) {
  return (value || "").trim();
}

function normalizeChunkLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseSequenceValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSequenceFromEventId(value: string | null): number | null {
  const match = /^evt_(\d+)$/.exec(String(value || "").trim());
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] || "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSSEFrame(frame: string): ParsedSSEFrame | null {
  const lines = normalizeChunkLineEndings(frame).split("\n");
  let event = "message";
  let eventId: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1).replace(/^ /, "");
    if (field === "event" && value) {
      event = value;
      continue;
    }
    if (field === "id") {
      eventId = value || null;
      continue;
    }
    if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
    eventId,
  };
}

function normalizeStructuredPayload(frame: ParsedSSEFrame) {
  const raw = parseMaybeJson(frame.data);
  if (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    raw &&
    "type" in raw &&
    raw.type === "event" &&
    "data" in raw
  ) {
    const record = raw as {
      event?: unknown;
      event_id?: unknown;
      sequence?: unknown;
      data?: unknown;
    };
    return {
      event: typeof record.event === "string" ? record.event : frame.event,
      data: record.data,
      eventId:
        typeof record.event_id === "string" ? record.event_id : frame.eventId,
      sequence:
        parseSequenceValue(record.sequence) ??
        parseSequenceFromEventId(frame.eventId),
    };
  }

  return {
    event: frame.event,
    data: raw,
    eventId: frame.eventId,
    sequence: parseSequenceFromEventId(frame.eventId),
  };
}

function eventRuntimeAgentIds(event: AutopilotExecutionEventRecord) {
  return [
    normalizeValue(event.runtime_agent_id),
    normalizeValue(event.worker_runtime_agent_id),
    normalizeValue(event.critic_runtime_agent_id),
    normalizeValue(event.specialist_runtime_agent_id),
    ...(event.runtime_agent_ids ?? []).map((value) => normalizeValue(value)),
  ].filter(Boolean);
}

function executionEventKey(
  event: AutopilotExecutionEventRecord,
  eventId?: string | null
) {
  if (eventId) {
    return eventId;
  }
  return [
    normalizeValue(event.project_id),
    normalizeValue(event.event),
    normalizeValue(event.timestamp),
    String(event.story_id ?? ""),
    normalizeValue(event.agent_action_run_id),
    normalizeValue(event.orchestrator_session_id),
    normalizeValue(event.approval_id),
    normalizeValue(event.issue_id),
    normalizeValue(event.message),
  ].join("|");
}

function isExecutionEventRecord(value: unknown): value is AutopilotExecutionEventRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { event?: unknown }).event === "string"
  );
}

function isExecutionEventCandidate(event: AutopilotExecutionEventRecord) {
  const eventName = normalizeValue(event.event).toLowerCase();
  if (eventName === "control_request" || eventName === "control_response") {
    return false;
  }
  return Boolean(
    normalizeValue(event.project_id) ||
      normalizeValue(event.orchestrator_session_id) ||
      normalizeValue(event.agent_action_run_id) ||
      normalizeValue(event.approval_id) ||
      normalizeValue(event.issue_id) ||
      eventRuntimeAgentIds(event).length > 0 ||
      eventName.startsWith("execution_plane_")
  );
}

function matchesInitiative(event: AutopilotExecutionEventRecord, initiativeId: string) {
  const candidate =
    typeof event.initiative === "object" &&
    event.initiative !== null &&
    "id" in event.initiative
      ? normalizeValue(String((event.initiative as { id?: unknown }).id ?? ""))
      : "";
  return candidate === initiativeId;
}

function matchesOrchestrator(event: AutopilotExecutionEventRecord, orchestrator: string) {
  const candidate =
    typeof event.orchestration === "object" &&
    event.orchestration !== null &&
    "orchestrator" in event.orchestration
      ? normalizeValue(
          String(
            (event.orchestration as { orchestrator?: unknown }).orchestrator ?? ""
          )
        )
      : "";
  return candidate === orchestrator;
}

function matchesExecutionLiveEvent(
  event: AutopilotExecutionEventRecord,
  routeProjectId: string,
  filters?: ExecutionLiveEventFilters | null
) {
  if (!isExecutionEventCandidate(event)) {
    return false;
  }

  if (routeProjectId && normalizeValue(event.project_id) !== routeProjectId) {
    return false;
  }

  const runtimeAgentId = normalizeValue(filters?.runtimeAgentId);
  if (runtimeAgentId && !eventRuntimeAgentIds(event).includes(runtimeAgentId)) {
    return false;
  }

  const orchestratorSessionId = normalizeValue(filters?.orchestratorSessionId);
  if (
    orchestratorSessionId &&
    normalizeValue(event.orchestrator_session_id) !== orchestratorSessionId
  ) {
    return false;
  }

  const initiativeId = normalizeValue(filters?.initiativeId);
  if (initiativeId && !matchesInitiative(event, initiativeId)) {
    return false;
  }

  const orchestrator = normalizeValue(filters?.orchestrator);
  if (orchestrator && !matchesOrchestrator(event, orchestrator)) {
    return false;
  }

  const projectId = normalizeValue(filters?.projectId);
  if (projectId && normalizeValue(event.project_id) !== projectId) {
    return false;
  }

  return true;
}

function sortEvents(items: AutopilotExecutionEventRecord[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.timestamp ?? "") || 0;
    const rightTime = Date.parse(right.timestamp ?? "") || 0;
    return rightTime - leftTime;
  });
}

export function mergeExecutionEventLists(
  baseEvents: AutopilotExecutionEventRecord[],
  liveEvents: AutopilotExecutionEventRecord[]
) {
  const byKey = new Map<string, AutopilotExecutionEventRecord>();
  for (const event of baseEvents) {
    byKey.set(executionEventKey(event), event);
  }
  for (const event of liveEvents) {
    byKey.set(executionEventKey(event), event);
  }
  return sortEvents(Array.from(byKey.values()));
}

export function executionEventStreamLabel(state: ExecutionEventStreamState) {
  if (state === "live") {
    return "stream live";
  }
  if (state === "connecting") {
    return "stream connecting";
  }
  if (state === "reconnecting") {
    return "stream reconnecting";
  }
  if (state === "error") {
    return "stream retry";
  }
  return "stream idle";
}

export function useExecutionLiveEvents(args: {
  routeScope: ShellRouteScope;
  filters?: ExecutionLiveEventFilters | null;
  enabled?: boolean;
}) {
  const enabled = args.enabled ?? true;
  const routeProjectId = normalizeValue(args.routeScope.projectId);
  const filterProjectId = normalizeValue(args.filters?.projectId);
  const filterRuntimeAgentId = normalizeValue(args.filters?.runtimeAgentId);
  const filterOrchestratorSessionId = normalizeValue(
    args.filters?.orchestratorSessionId
  );
  const filterInitiativeId = normalizeValue(args.filters?.initiativeId);
  const filterOrchestrator = normalizeValue(args.filters?.orchestrator);
  const [events, setEvents] = useState<AutopilotExecutionEventRecord[]>([]);
  const [streamState, setStreamState] =
    useState<ExecutionEventStreamState>("idle");
  const lastSequenceRef = useRef<number>(0);
  const seenEventKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
      setStreamState("idle");
      lastSequenceRef.current = 0;
      seenEventKeysRef.current = new Set();
      return;
    }

    let isClosed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;

    setEvents([]);
    setStreamState("connecting");
    lastSequenceRef.current = 0;
    seenEventKeysRef.current = new Set();

    const scheduleReconnect = () => {
      if (isClosed) {
        return;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      setStreamState("reconnecting");
      reconnectTimer = setTimeout(connect, DEFAULT_RECONNECT_DELAY_MS);
    };

    const connect = async () => {
      const query = new URLSearchParams({ structured: "true" });
      const projectId = filterProjectId || routeProjectId;

      if (lastSequenceRef.current > 0) {
        query.set("from_sequence", String(lastSequenceRef.current));
      }
      if (projectId) {
        query.set("project_id", projectId);
      }
      if (filterRuntimeAgentId) {
        query.set("runtime_agent_id", filterRuntimeAgentId);
      }
      if (filterOrchestratorSessionId) {
        query.set("orchestrator_session_id", filterOrchestratorSessionId);
      }
      if (filterInitiativeId) {
        query.set("initiative_id", filterInitiativeId);
      }
      if (filterOrchestrator) {
        query.set("orchestrator", filterOrchestrator);
      }

      abortController = new AbortController();

      try {
        const response = await fetch(
          `/api/shell/execution/live-events?${query.toString()}`,
          {
            headers: { Accept: "text/event-stream" },
            cache: "no-store",
            signal: abortController.signal,
          }
        );

        if (!response.ok || !response.body) {
          throw new Error(`SSE request failed with status ${response.status}`);
        }

        setStreamState("live");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!isClosed) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += normalizeChunkLineEndings(decoder.decode(value, { stream: true }));

          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex !== -1) {
            const rawFrame = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            boundaryIndex = buffer.indexOf("\n\n");

            const frame = parseSSEFrame(rawFrame);
            if (frame === null) {
              continue;
            }

            const normalized = normalizeStructuredPayload(frame);
            if (normalized.sequence !== null) {
              lastSequenceRef.current = Math.max(
                lastSequenceRef.current,
                normalized.sequence
              );
            }
            if (!isExecutionEventRecord(normalized.data)) {
              continue;
            }
            const eventRecord = normalized.data;
            if (
              !matchesExecutionLiveEvent(
                eventRecord,
                routeProjectId,
                {
                  projectId: filterProjectId,
                  runtimeAgentId: filterRuntimeAgentId,
                  orchestratorSessionId: filterOrchestratorSessionId,
                  initiativeId: filterInitiativeId,
                  orchestrator: filterOrchestrator,
                }
              )
            ) {
              continue;
            }

            const key = executionEventKey(eventRecord, normalized.eventId);
            if (seenEventKeysRef.current.has(key)) {
              continue;
            }
            seenEventKeysRef.current.add(key);
            setEvents((current) => sortEvents([...current, eventRecord]));
          }
        }
      } catch (error) {
        if (
          isClosed ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
      }

      scheduleReconnect();
    };

    void connect();

    return () => {
      isClosed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      abortController?.abort();
    };
  }, [
    filterInitiativeId,
    filterOrchestrator,
    filterOrchestratorSessionId,
    filterProjectId,
    filterRuntimeAgentId,
    routeProjectId,
    enabled,
  ]);

  return {
    events,
    streamState,
  };
}

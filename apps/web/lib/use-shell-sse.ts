"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_RECONNECT_DELAY_MS = 3000;
const DEFAULT_MAX_TRACKED_EVENT_IDS = 512;

type SSERecord = Record<string, unknown>;

export type ShellSSEState = "idle" | "connecting" | "live" | "reconnecting" | "error";

export type ShellSSEMeta = {
  eventId: string | null;
  sequence: number | null;
  raw: unknown;
  structured: boolean;
};

export type ShellSSEOptions = {
  eventTypes?: readonly string[] | null;
  structured?: boolean;
  replay?: boolean;
  reconnectDelayMs?: number;
  maxTrackedEventIds?: number;
};

type ParsedSSEFrame = {
  event: string;
  data: string;
  eventId: string | null;
};

function isRecord(value: unknown): value is SSERecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeChunkLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseSequenceValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSequenceFromEventId(value: string | null): number | null {
  const match = /^evt_(\d+)$/.exec(String(value || "").trim());
  if (!match) return null;
  const parsed = Number.parseInt(match[1] || "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSSEFrame(frame: string): ParsedSSEFrame | null {
  const lines = normalizeChunkLineEndings(frame).split("\n");
  let event = "message";
  let eventId: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
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

function normalizeStructuredPayload(
  frame: ParsedSSEFrame,
  structured: boolean
): { event: string; data: unknown; eventId: string | null; sequence: number | null; raw: unknown } {
  const raw = parseMaybeJson(frame.data);
  if (!structured || !isRecord(raw)) {
    return {
      event: frame.event,
      data: raw,
      eventId: frame.eventId,
      sequence: parseSequenceFromEventId(frame.eventId),
      raw,
    };
  }

  if (raw.type === "event" && typeof raw.event === "string") {
    return {
      event: raw.event,
      data: raw.data ?? raw,
      eventId: typeof raw.event_id === "string" ? raw.event_id : frame.eventId,
      sequence: parseSequenceValue(raw.sequence) ?? parseSequenceFromEventId(frame.eventId),
      raw,
    };
  }

  return {
    event: frame.event || (typeof raw.type === "string" ? raw.type : "message"),
    data: raw,
    eventId: frame.eventId,
    sequence: parseSequenceValue(raw.sequence) ?? parseSequenceFromEventId(frame.eventId),
    raw,
  };
}

function rememberEventId(
  eventId: string,
  seenEventIds: string[],
  seenEventIdSet: Set<string>,
  maxTrackedEventIds: number
) {
  if (!eventId || seenEventIdSet.has(eventId)) {
    return;
  }
  seenEventIds.push(eventId);
  seenEventIdSet.add(eventId);
  while (seenEventIds.length > maxTrackedEventIds) {
    const removed = seenEventIds.shift();
    if (removed) {
      seenEventIdSet.delete(removed);
    }
  }
}

export function useShellSSE(
  url: string,
  onEvent: (event: string, data: unknown, meta?: ShellSSEMeta) => void,
  options?: ShellSSEOptions,
  enabled = true
) {
  const onEventRef = useRef(onEvent);
  const optionsRef = useRef<ShellSSEOptions>({
    eventTypes: null,
    structured: true,
    replay: true,
    reconnectDelayMs: DEFAULT_RECONNECT_DELAY_MS,
    maxTrackedEventIds: DEFAULT_MAX_TRACKED_EVENT_IDS,
  });
  const [state, setState] = useState<ShellSSEState>("idle");
  const lastSequenceRef = useRef<number>(0);
  const seenEventIdsRef = useRef<string[]>([]);
  const seenEventIdSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    optionsRef.current = {
      eventTypes:
        options && Object.prototype.hasOwnProperty.call(options, "eventTypes")
          ? options.eventTypes ?? null
          : null,
      structured: options?.structured ?? true,
      replay: options?.replay ?? true,
      reconnectDelayMs: options?.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS,
      maxTrackedEventIds: options?.maxTrackedEventIds ?? DEFAULT_MAX_TRACKED_EVENT_IDS,
    };
  }, [options]);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      lastSequenceRef.current = 0;
      seenEventIdsRef.current = [];
      seenEventIdSetRef.current.clear();
      return;
    }

    let isClosed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;

    const scheduleReconnect = () => {
      if (isClosed) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      setState((current) => (current === "live" ? "reconnecting" : "error"));
      reconnectTimer = setTimeout(connect, optionsRef.current.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS);
    };

    const connect = async () => {
      const currentOptions = optionsRef.current;
      const requestUrl = new URL(url, window.location.origin);
      if (currentOptions.structured !== false) {
        requestUrl.searchParams.set("structured", "true");
      }
      if (currentOptions.replay !== false && lastSequenceRef.current > 0) {
        requestUrl.searchParams.set("from_sequence", String(lastSequenceRef.current));
      }
      abortController = new AbortController();
      setState((current) => (current === "live" ? "reconnecting" : "connecting"));

      try {
        const response = await fetch(requestUrl.toString(), {
          headers: { Accept: "text/event-stream" },
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`SSE request failed with status ${response.status}`);
        }

        const eventTypes = currentOptions.eventTypes ? new Set(currentOptions.eventTypes) : null;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!isClosed) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          setState((current) => (current === "live" ? current : "live"));

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
            const normalized = normalizeStructuredPayload(
              frame,
              currentOptions.structured !== false
            );
            if (normalized.sequence !== null) {
              lastSequenceRef.current = Math.max(lastSequenceRef.current, normalized.sequence);
            }
            if (normalized.eventId && seenEventIdSetRef.current.has(normalized.eventId)) {
              continue;
            }
            if (normalized.eventId) {
              rememberEventId(
                normalized.eventId,
                seenEventIdsRef.current,
                seenEventIdSetRef.current,
                currentOptions.maxTrackedEventIds ?? DEFAULT_MAX_TRACKED_EVENT_IDS
              );
            }
            if (eventTypes && !eventTypes.has(normalized.event)) {
              continue;
            }
            onEventRef.current(normalized.event, normalized.data, {
              eventId: normalized.eventId,
              sequence: normalized.sequence,
              raw: normalized.raw,
              structured: currentOptions.structured !== false,
            });
          }
        }
      } catch (error) {
        if (isClosed || (error instanceof DOMException && error.name === "AbortError")) {
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
  }, [enabled, url]);

  return state;
}

type ShellMetricBucket = {
  count: number;
  errorCount: number;
  totalLatencyMs: number;
  lastStatus: string;
  lastUpdatedAt: string;
};

type ShellObservabilityState = {
  routes: Map<string, ShellMetricBucket>;
  upstreams: Map<string, ShellMetricBucket>;
};

const globalObservabilityState = globalThis as typeof globalThis & {
  __FOUNDEROS_SHELL_METRICS__?: ShellObservabilityState;
};

function getObservabilityState(): ShellObservabilityState {
  if (!globalObservabilityState.__FOUNDEROS_SHELL_METRICS__) {
    globalObservabilityState.__FOUNDEROS_SHELL_METRICS__ = {
      routes: new Map(),
      upstreams: new Map(),
    };
  }
  return globalObservabilityState.__FOUNDEROS_SHELL_METRICS__;
}

function updateBucket(
  map: Map<string, ShellMetricBucket>,
  key: string,
  status: string,
  latencyMs?: number,
) {
  const bucket = map.get(key) ?? {
    count: 0,
    errorCount: 0,
    totalLatencyMs: 0,
    lastStatus: "unknown",
    lastUpdatedAt: "",
  };

  bucket.count += 1;
  if (status !== "ok") {
    bucket.errorCount += 1;
  }
  if (typeof latencyMs === "number") {
    bucket.totalLatencyMs += latencyMs;
  }
  bucket.lastStatus = status;
  bucket.lastUpdatedAt = new Date().toISOString();
  map.set(key, bucket);
}

export function recordShellRouteMetric(route: string, status: string) {
  updateBucket(getObservabilityState().routes, route, status);
}

export function recordShellUpstreamMetric(
  upstream: string,
  operation: string,
  status: string,
  latencyMs?: number,
) {
  updateBucket(
    getObservabilityState().upstreams,
    `${upstream}:${operation}`,
    status,
    latencyMs,
  );
}

function serializeMetrics(map: Map<string, ShellMetricBucket>) {
  return [...map.entries()].map(([key, bucket]) => ({
    key,
    count: bucket.count,
    errorCount: bucket.errorCount,
    averageLatencyMs:
      bucket.count > 0
        ? Number((bucket.totalLatencyMs / bucket.count).toFixed(2))
        : 0,
    lastStatus: bucket.lastStatus,
    lastUpdatedAt: bucket.lastUpdatedAt,
  }));
}

export function buildShellObservabilitySnapshot() {
  const state = getObservabilityState();
  return {
    generatedAt: new Date().toISOString(),
    routes: serializeMetrics(state.routes),
    upstreams: serializeMetrics(state.upstreams),
  };
}

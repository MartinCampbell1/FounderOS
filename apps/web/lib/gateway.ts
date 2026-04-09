import type {
  GatewayHealthSnapshot,
  UpstreamHealthRecord,
} from "@founderos/api-clients";
import { getUpstreamBaseUrl as resolveUpstreamBaseUrl } from "@founderos/config";
import { NextResponse } from "next/server";

import type { UpstreamId } from "@/lib/gateway-contract";
import { recordShellUpstreamMetric } from "@/lib/observability";

const REQUEST_HEADER_ALLOWLIST = new Set([
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
  "x-correlation-id",
]);

const RESPONSE_HEADER_BLOCKLIST = new Set(["set-cookie"]);
const RESPONSE_HEADER_ALLOWLIST = new Set([
  "cache-control",
  "content-type",
  "etag",
  "last-modified",
]);

const PROXY_ROUTE_ALLOWLIST: Record<
  UpstreamId,
  Array<{ method: string; pattern: RegExp }>
> = {
  quorum: [
    { method: "POST", pattern: /^orchestrate\/ranking\/compare$/ },
    { method: "POST", pattern: /^orchestrate\/ranking\/finals\/resolve$/ },
    { method: "POST", pattern: /^orchestrate\/repo-(digest|graph)\/analyze$/ },
    {
      method: "POST",
      pattern: /^orchestrate\/improvement\/(reflect|self-play|evolve)$/,
    },
    {
      method: "POST",
      pattern: /^orchestrate\/improvement\/prompt-profiles\/[^/]+\/activate$/,
    },
    {
      method: "POST",
      pattern:
        /^orchestrate\/session\/[^/]+\/(message|continue|control|execution-brief|send-to-autopilot|tournament-preparation)$/,
    },
    {
      method: "POST",
      pattern:
        /^orchestrate\/discovery\/ideas\/[^/]+\/(simulation|simulation\/lab|archive|observations|validation-reports|decisions|timeline|evidence-bundle|swipe)$/,
    },
    {
      method: "POST",
      pattern: /^orchestrate\/discovery\/inbox\/[^/]+\/(act|resolve)$/,
    },
  ],
  autopilot: [
    { method: "POST", pattern: /^intake\/(message|generate-prd)$/ },
    { method: "POST", pattern: /^projects\/$/ },
    { method: "POST", pattern: /^projects\/from-execution-brief$/ },
    { method: "POST", pattern: /^projects\/[^/]+\/(launch|pause|resume)$/ },
    { method: "GET", pattern: /^execution-plane\/agents(?:\/[^/]+)?$/ },
    {
      method: "GET",
      pattern:
        /^execution-plane\/agents\/tasks(?:\/[^/]+(?:\/(output(?:\/live)?|transcript))?)?$/,
    },
    {
      method: "GET",
      pattern: /^execution-plane\/agents\/action-runs(?:\/summary|\/[^/]+)?$/,
    },
    {
      method: "POST",
      pattern:
        /^execution-plane\/agents\/actions(?:\/(execute|execute-batch|preview-batch|policy-profiles))?$/,
    },
    { method: "GET", pattern: /^execution-plane\/agents\/actions\/[^/]+$/ },
    {
      method: "GET",
      pattern:
        /^execution-plane\/orchestrator-sessions(?:\/summary|\/control\/passes(?:\/summary|\/[^/]+)?|\/control\/profiles|\/[^/]+(?:\/events|\/actions(?:\/summary)?|\/status)?)?$/,
    },
    { method: "POST", pattern: /^execution-plane\/orchestrator-sessions$/ },
    {
      method: "POST",
      pattern:
        /^execution-plane\/orchestrator-sessions\/[^/]+\/(actions\/execute|actions\/preview|control|control\/apply|control\/apply-plan)$/,
    },
    { method: "GET", pattern: /^execution-plane\/(events|issues|approvals)$/ },
    {
      method: "POST",
      pattern: /^execution-plane\/projects\/[^/]+\/command-policy$/,
    },
    {
      method: "GET",
      pattern:
        /^execution-plane\/projects\/[^/]+(?:\/command-policy|\/runtime-log)?$/,
    },
    {
      method: "POST",
      pattern: /^execution-plane\/projects\/[^/]+\/commands\/[^/]+$/,
    },
    { method: "GET", pattern: /^execution-plane\/shadow-audits\/[^/]+$/ },
    {
      method: "POST",
      pattern: /^execution-plane\/shadow-audits\/[^/]+\/resolve$/,
    },
    {
      method: "POST",
      pattern: /^execution-plane\/approvals\/[^/]+\/(approve|reject)$/,
    },
    { method: "POST", pattern: /^execution-plane\/issues\/[^/]+\/resolve$/ },
    {
      method: "POST",
      pattern:
        /^execution-plane\/tool-permission-runtimes\/[^/]+\/(allow|deny)$/,
    },
    {
      method: "POST",
      pattern:
        /^execution-plane\/agents\/tasks\/[^/]+\/(cancel|output|output\/live|transcript)$/,
    },
    {
      method: "POST",
      pattern: /^execution-plane\/agents\/action-runs\/[^/]+\/cancel-async$/,
    },
  ],
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function getUpstreamBaseUrl(upstream: UpstreamId): string {
  return resolveUpstreamBaseUrl(upstream, process.env);
}

function buildUpstreamUrl(
  upstream: UpstreamId,
  pathSegments: string[],
  searchParams: URLSearchParams,
) {
  const target = new URL(getUpstreamBaseUrl(upstream));
  const basePath = target.pathname.replace(/\/$/, "");
  const suffix = pathSegments.map(encodeURIComponent).join("/");
  const pathname = [basePath, suffix].filter(Boolean).join("/");
  target.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  target.search = searchParams.toString();
  return target;
}

function copyRequestHeaders(headers: Headers, correlationId: string) {
  const nextHeaders = new Headers();
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || !REQUEST_HEADER_ALLOWLIST.has(lower)) {
      return;
    }
    nextHeaders.set(key, value);
  });
  nextHeaders.set("x-correlation-id", correlationId);
  nextHeaders.set("x-founderos-proxy", "apps-web");
  return nextHeaders;
}

function copyResponseHeaders(headers: Headers, correlationId: string) {
  const nextHeaders = new Headers();
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      HOP_BY_HOP_HEADERS.has(lower) ||
      RESPONSE_HEADER_BLOCKLIST.has(lower) ||
      !RESPONSE_HEADER_ALLOWLIST.has(lower)
    ) {
      return;
    }
    nextHeaders.set(key, value);
  });
  nextHeaders.set("x-correlation-id", correlationId);
  return nextHeaders;
}

export async function fetchUpstreamHealth(
  upstream: UpstreamId,
): Promise<UpstreamHealthRecord> {
  const baseUrl = getUpstreamBaseUrl(upstream);
  const healthTarget = new URL("health", `${baseUrl}/`);
  const startedAt = Date.now();

  try {
    const response = await fetch(healthTarget, {
      cache: "no-store",
      signal: AbortSignal.timeout(1000),
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      recordShellUpstreamMetric(upstream, "health", "degraded", latencyMs);
      return {
        status: "degraded",
        label: upstream,
        baseUrl: "",
        details: "Upstream health check failed.",
        latencyMs,
      };
    }

    recordShellUpstreamMetric(upstream, "health", "ok", latencyMs);
    return {
      status: "ok",
      label: upstream,
      baseUrl: "",
      latencyMs,
    };
  } catch (error) {
    recordShellUpstreamMetric(
      upstream,
      "health",
      "offline",
      Date.now() - startedAt,
    );
    return {
      status: "offline",
      label: upstream,
      baseUrl: "",
      details: "Upstream unavailable.",
    };
  }
}

function assertAllowedProxyRoute(
  upstream: UpstreamId,
  method: string,
  pathSegments: string[],
) {
  const path = pathSegments.join("/");
  const methodRules = PROXY_ROUTE_ALLOWLIST[upstream] ?? [];
  return methodRules.some(
    (rule) => rule.method === method && rule.pattern.test(path),
  );
}

export async function buildGatewayHealthSnapshot(): Promise<GatewayHealthSnapshot> {
  const [quorum, autopilot] = await Promise.all([
    fetchUpstreamHealth("quorum"),
    fetchUpstreamHealth("autopilot"),
  ]);

  return {
    status:
      quorum.status === "ok" && autopilot.status === "ok" ? "ok" : "degraded",
    generatedAt: new Date().toISOString(),
    services: {
      quorum,
      autopilot,
    },
  };
}

export async function proxyToUpstream(
  upstream: UpstreamId,
  request: Request,
  pathSegments: string[],
) {
  const correlationId =
    request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const requestUrl = new URL(request.url);
  const targetUrl = buildUpstreamUrl(
    upstream,
    pathSegments,
    requestUrl.searchParams,
  );
  const method = request.method.toUpperCase();

  if (!assertAllowedProxyRoute(upstream, method, pathSegments)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Shell proxy route is not allowed.",
        correlationId,
      },
      { status: 404 },
    );
  }

  try {
    const contentLength = Number.parseInt(
      request.headers.get("content-length") ?? "0",
      10,
    );
    if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
      return NextResponse.json(
        {
          status: "error",
          message: "Shell proxy request body is too large.",
          correlationId,
        },
        { status: 413 },
      );
    }

    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer();
    if (body && body.byteLength > 64 * 1024) {
      return NextResponse.json(
        {
          status: "error",
          message: "Shell proxy request body is too large.",
          correlationId,
        },
        { status: 413 },
      );
    }

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: copyRequestHeaders(request.headers, correlationId),
      body,
      redirect: "manual",
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      recordShellUpstreamMetric(
        upstream,
        pathSegments.join("/"),
        `http_${upstreamResponse.status}`,
      );
      return NextResponse.json(
        {
          status: "error",
          message: "Upstream action failed.",
          correlationId,
        },
        {
          status: upstreamResponse.status,
          headers: {
            "x-correlation-id": correlationId,
          },
        },
      );
    }

    recordShellUpstreamMetric(upstream, pathSegments.join("/"), "ok");
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: copyResponseHeaders(upstreamResponse.headers, correlationId),
    });
  } catch (error) {
    recordShellUpstreamMetric(upstream, pathSegments.join("/"), "error");
    console.error("shell proxy failure", {
      correlationId,
      upstream,
      targetUrl: targetUrl.toString(),
      error,
    });
    return NextResponse.json(
      {
        status: "error",
        message: `Failed to reach ${upstream}`,
        details: "Upstream request failed.",
        correlationId,
      },
      {
        status: 502,
        headers: {
          "x-correlation-id": correlationId,
        },
      },
    );
  }
}

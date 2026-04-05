import type { GatewayHealthSnapshot, UpstreamHealthRecord } from "@founderos/api-clients";
import { getUpstreamBaseUrl as resolveUpstreamBaseUrl } from "@founderos/config";
import { NextResponse } from "next/server";

import type { UpstreamId } from "@/lib/gateway-contract";

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
  searchParams: URLSearchParams
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
    if (HOP_BY_HOP_HEADERS.has(lower)) {
      return;
    }
    nextHeaders.set(key, value);
  });
  nextHeaders.set("x-correlation-id", correlationId);
  nextHeaders.set("x-founderos-proxy", "apps-web");
  return nextHeaders;
}

function copyResponseHeaders(headers: Headers, correlationId: string, upstream: UpstreamId) {
  const nextHeaders = new Headers();
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) {
      return;
    }
    nextHeaders.set(key, value);
  });
  nextHeaders.set("x-correlation-id", correlationId);
  nextHeaders.set("x-founderos-upstream", upstream);
  return nextHeaders;
}

export async function fetchUpstreamHealth(
  upstream: UpstreamId
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
      return {
        status: "degraded",
        label: upstream,
        baseUrl,
        details: `HTTP ${response.status}`,
        latencyMs,
      };
    }

    return {
      status: "ok",
      label: upstream,
      baseUrl,
      latencyMs,
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown network error";
    return {
      status: "offline",
      label: upstream,
      baseUrl,
      details,
    };
  }
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
  pathSegments: string[]
) {
  const correlationId =
    request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const requestUrl = new URL(request.url);
  const targetUrl = buildUpstreamUrl(upstream, pathSegments, requestUrl.searchParams);
  const method = request.method.toUpperCase();

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: copyRequestHeaders(request.headers, correlationId),
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: copyResponseHeaders(
        upstreamResponse.headers,
        correlationId,
        upstream
      ),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown proxy error";
    return NextResponse.json(
      {
        status: "error",
        message: `Failed to reach ${upstream}`,
        details,
        correlationId,
      },
      {
        status: 502,
        headers: {
          "x-correlation-id": correlationId,
          "x-founderos-upstream": upstream,
        },
      }
    );
  }
}

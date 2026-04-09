import { getUpstreamBaseUrl } from "@/lib/gateway";
import type { UpstreamId } from "@/lib/gateway-contract";
import { recordShellUpstreamMetric } from "@/lib/observability";

type UpstreamCacheEntry = {
  payload: unknown;
  cachedAt: number;
};

const globalUpstreamCache = globalThis as typeof globalThis & {
  __FOUNDEROS_UPSTREAM_CACHE__?: Map<string, UpstreamCacheEntry>;
};

const LAST_KNOWN_GOOD_TTL_MS = 30_000;

function upstreamCacheStore() {
  if (!globalUpstreamCache.__FOUNDEROS_UPSTREAM_CACHE__) {
    globalUpstreamCache.__FOUNDEROS_UPSTREAM_CACHE__ = new Map();
  }
  return globalUpstreamCache.__FOUNDEROS_UPSTREAM_CACHE__;
}

function upstreamCacheKey(
  upstream: UpstreamId,
  path: string,
  searchParams?: URLSearchParams,
) {
  const suffix = searchParams?.toString();
  return suffix ? `${upstream}:${path}?${suffix}` : `${upstream}:${path}`;
}

export function buildUpstreamQuery(
  entries: Record<string, string | number | boolean | null | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}

function buildUpstreamUrl(
  upstream: UpstreamId,
  path: string,
  searchParams?: URLSearchParams,
) {
  const baseUrl = getUpstreamBaseUrl(upstream);
  const baseHref = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), baseHref);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return url;
}

async function parseUpstreamErrorDetail(response: Response) {
  const fallback = `Request failed: ${response.status}`;
  const raw = (await response.text()).trim();

  if (!raw) {
    return fallback;
  }

  try {
    const payload = JSON.parse(raw) as { detail?: string; message?: string };
    if (payload.detail || payload.message) {
      return fallback;
    }
  } catch {
    // Keep raw text fallback.
  }

  return fallback;
}

export async function requestUpstreamJson<T>(
  upstream: UpstreamId,
  path: string,
  searchParams?: URLSearchParams,
  options?: {
    timeoutMs?: number;
  },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 3000;
  const target = buildUpstreamUrl(upstream, path, searchParams);
  const cacheKey = upstreamCacheKey(upstream, path, searchParams);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetch(target, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const detail = await parseUpstreamErrorDetail(response);
        recordShellUpstreamMetric(
          upstream,
          path,
          `http_${response.status}`,
          Date.now() - startedAt,
        );
        throw new Error(detail);
      }

      recordShellUpstreamMetric(upstream, path, "ok", Date.now() - startedAt);
      const payload = (await response.json()) as T;
      upstreamCacheStore().set(cacheKey, {
        payload,
        cachedAt: Date.now(),
      });
      return payload;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Upstream request failed.");
      if (
        !(error instanceof Error && error.message.startsWith("Request failed:"))
      ) {
        recordShellUpstreamMetric(
          upstream,
          path,
          "error",
          Date.now() - startedAt,
        );
      }
      if (attempt === 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  const cached = upstreamCacheStore().get(cacheKey);
  if (cached && Date.now() - cached.cachedAt <= LAST_KNOWN_GOOD_TTL_MS) {
    recordShellUpstreamMetric(upstream, path, "stale_cache_hit");
    return cached.payload as T;
  }

  throw lastError ?? new Error("Upstream request failed.");
}

export function formatUpstreamErrorMessage(prefix: string, error: unknown) {
  return error instanceof Error
    ? `${prefix}: upstream unavailable.`
    : `${prefix}: request failed.`;
}

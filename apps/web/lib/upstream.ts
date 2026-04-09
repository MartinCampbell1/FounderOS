import { getUpstreamBaseUrl } from "@/lib/gateway";
import type { UpstreamId } from "@/lib/gateway-contract";

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

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(target, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(await parseUpstreamErrorDetail(response));
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Upstream request failed.");
      if (attempt === 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Upstream request failed.");
}

export function formatUpstreamErrorMessage(prefix: string, error: unknown) {
  return error instanceof Error
    ? `${prefix}: upstream unavailable.`
    : `${prefix}: request failed.`;
}

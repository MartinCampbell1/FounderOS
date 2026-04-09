import { NextResponse, type NextRequest } from "next/server";

const SHELL_ADMIN_TOKEN_COOKIE = "founderos-shell-admin-token";
const DEFAULT_PROTECTED_RATE_LIMIT = 60;
const DEFAULT_PARITY_RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type ShellRouteClass = "protected" | "parity" | "public";

const globalRateLimitState = globalThis as typeof globalThis & {
  __FOUNDEROS_SHELL_RATE_LIMITS__?: Map<string, RateLimitBucket>;
};

function rateLimitStore() {
  if (!globalRateLimitState.__FOUNDEROS_SHELL_RATE_LIMITS__) {
    globalRateLimitState.__FOUNDEROS_SHELL_RATE_LIMITS__ = new Map();
  }
  return globalRateLimitState.__FOUNDEROS_SHELL_RATE_LIMITS__;
}

function shellAdminToken() {
  return (process.env.FOUNDEROS_SHELL_ADMIN_TOKEN || "").trim();
}

export function isShellSecurityEnforced() {
  return process.env.NODE_ENV === "production";
}

export function classifyShellApiPath(pathname: string): ShellRouteClass {
  if (
    pathname === "/api/shell/parity" ||
    pathname === "/api/shell/parity-targets"
  ) {
    return "parity";
  }

  if (
    pathname === "/api/shell/contract" ||
    pathname.startsWith("/api/shell/handoffs/") ||
    pathname.startsWith("/api/shell/discovery/actions/") ||
    pathname.startsWith("/api/shell/execution/actions/")
  ) {
    return "protected";
  }

  return "public";
}

function clientAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function clientAddressFromRequest(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function tokenFromRequest(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const headerToken =
    request.headers.get("x-founderos-shell-admin-token") || "";
  if (headerToken.trim()) {
    return headerToken.trim();
  }

  return request.cookies.get(SHELL_ADMIN_TOKEN_COOKIE)?.value?.trim() || "";
}

function tokenFromStandardRequest(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const headerToken =
    request.headers.get("x-founderos-shell-admin-token") || "";
  if (headerToken.trim()) {
    return headerToken.trim();
  }

  const cookieHeader = request.headers.get("cookie") || "";
  for (const entry of cookieHeader.split(";")) {
    const [key, ...rest] = entry.split("=");
    if ((key || "").trim() === SHELL_ADMIN_TOKEN_COOKIE) {
      return rest.join("=").trim();
    }
  }
  return "";
}

function checkRateLimitByKey(key: string, limit: number) {
  const store = rateLimitStore();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfterSec = Math.max(
      Math.ceil((existing.resetAt - now) / 1000),
      1,
    );
    return NextResponse.json(
      {
        status: "error",
        message: "Shell route rate limit exceeded.",
      },
      {
        status: 429,
        headers: {
          "retry-after": String(retryAfterSec),
        },
      },
    );
  }

  existing.count += 1;
  store.set(key, existing);
  return null;
}

export function requiresShellAdminAccess() {
  return isShellSecurityEnforced() || Boolean(shellAdminToken());
}

export function isShellAdminTokenAuthorized(token: string | null | undefined) {
  const configuredToken = shellAdminToken();
  if (!requiresShellAdminAccess()) {
    return true;
  }
  if (!configuredToken) {
    return false;
  }
  return String(token || "").trim() === configuredToken;
}

function checkRateLimit(request: NextRequest, routeClass: ShellRouteClass) {
  const limit =
    routeClass === "parity"
      ? DEFAULT_PARITY_RATE_LIMIT
      : DEFAULT_PROTECTED_RATE_LIMIT;
  const key = `${routeClass}:${clientAddress(request)}`;
  return checkRateLimitByKey(key, limit);
}

export function buildShellSecurityResponse(request: NextRequest) {
  const routeClass = classifyShellApiPath(request.nextUrl.pathname);
  if (routeClass === "public" || !requiresShellAdminAccess()) {
    return null;
  }

  const configuredToken = shellAdminToken();
  if (!configuredToken) {
    return NextResponse.json(
      {
        status: "error",
        message: "Shell admin access is not configured for this deployment.",
      },
      { status: 503 },
    );
  }

  const requestToken = tokenFromRequest(request);
  if (!requestToken || requestToken !== configuredToken) {
    return NextResponse.json(
      {
        status: "error",
        message: "Shell admin authorization required.",
      },
      { status: 403 },
    );
  }

  return checkRateLimit(request, routeClass);
}

export function enforceShellAdminRequest(request: Request) {
  const routeClass = classifyShellApiPath(new URL(request.url).pathname);
  if (routeClass === "public" || !requiresShellAdminAccess()) {
    return null;
  }

  const configuredToken = shellAdminToken();
  if (!configuredToken) {
    return NextResponse.json(
      {
        status: "error",
        message: "Shell admin access is not configured for this deployment.",
      },
      { status: 503 },
    );
  }

  const requestToken = tokenFromStandardRequest(request);
  if (!requestToken || requestToken !== configuredToken) {
    return NextResponse.json(
      {
        status: "error",
        message: "Shell admin authorization required.",
      },
      { status: 403 },
    );
  }

  const limit =
    routeClass === "parity"
      ? DEFAULT_PARITY_RATE_LIMIT
      : DEFAULT_PROTECTED_RATE_LIMIT;

  return checkRateLimitByKey(
    `${routeClass}:${clientAddressFromRequest(request)}`,
    limit,
  );
}

export function isSameOriginMutation(request: Request) {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin")?.trim();
  if (!origin) {
    return false;
  }

  return origin === requestUrl.origin;
}

export function maxShellBodyBytes() {
  return 64 * 1024;
}

export function isShellBodyTooLarge(request: Request) {
  const raw = request.headers.get("content-length")?.trim();
  if (!raw) {
    return false;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > maxShellBodyBytes();
}

export type FounderOSUpstreamId = "quorum" | "autopilot";

export type FounderOSConfigValueSource = "env" | "default" | "fallback";

export interface FounderOSConfigIssue {
  code: string;
  target: string;
  message: string;
}

export interface FounderOSResolvedEnvSetting {
  key: string;
  value: string;
  source: FounderOSConfigValueSource;
  description: string;
  rawValue?: string | null;
  issues: FounderOSConfigIssue[];
}

export interface FounderOSShellRuntimeConfig {
  host: string;
  port: string;
  origin: string;
  env: FounderOSResolvedEnvSetting[];
  issues: FounderOSConfigIssue[];
}

export interface FounderOSShellUpstreamConfig {
  id: FounderOSUpstreamId;
  label: string;
  envKey: string;
  baseUrl: string;
  source: FounderOSConfigValueSource;
  rawValue?: string | null;
  issues: FounderOSConfigIssue[];
}

export interface FounderOSShellConfig {
  runtime: FounderOSShellRuntimeConfig;
  upstreams: Record<FounderOSUpstreamId, FounderOSShellUpstreamConfig>;
  issues: FounderOSConfigIssue[];
}

export const DEFAULT_FOUNDEROS_WEB_HOST = "127.0.0.1";
export const DEFAULT_FOUNDEROS_WEB_PORT = "3737";
export const DEFAULT_QUORUM_API_BASE_URL = "http://127.0.0.1:8800";
export const DEFAULT_AUTOPILOT_API_BASE_URL = "http://127.0.0.1:8420/api";

function withNoTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildIssue(
  code: string,
  target: string,
  message: string
): FounderOSConfigIssue {
  return { code, target, message };
}

function resolveEnvSetting(
  env: Record<string, string | undefined>,
  key: string,
  fallback: string,
  description: string,
  validate: (value: string) => FounderOSConfigIssue[]
): FounderOSResolvedEnvSetting {
  const rawValue = env[key]?.trim();
  if (!rawValue) {
    return {
      key,
      value: fallback,
      source: "default",
      description,
      rawValue: null,
      issues: [],
    };
  }

  const issues = validate(rawValue);
  if (issues.length > 0) {
    return {
      key,
      value: fallback,
      source: "fallback",
      description,
      rawValue,
      issues,
    };
  }

  return {
    key,
    value: rawValue,
    source: "env",
    description,
    rawValue,
    issues: [],
  };
}

function validateHost(value: string, key: string) {
  if (!value.trim()) {
    return [buildIssue("empty-host", key, `${key} cannot be empty.`)];
  }
  if (/\s/.test(value)) {
    return [buildIssue("host-whitespace", key, `${key} cannot contain whitespace.`)];
  }
  return [];
}

function validatePort(value: string, key: string) {
  if (!/^\d+$/.test(value)) {
    return [buildIssue("invalid-port", key, `${key} must be a numeric TCP port.`)];
  }
  const port = Number.parseInt(value, 10);
  if (port < 1 || port > 65535) {
    return [buildIssue("port-range", key, `${key} must be between 1 and 65535.`)];
  }
  return [];
}

function validateBaseUrl(value: string, key: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return [
        buildIssue(
          "invalid-protocol",
          key,
          `${key} must use an http or https URL.`
        ),
      ];
    }
    return [];
  } catch {
    return [buildIssue("invalid-url", key, `${key} must be an absolute URL.`)];
  }
}

export function resolveShellRuntimeConfig(
  env: Record<string, string | undefined> = process.env
): FounderOSShellRuntimeConfig {
  const host = resolveEnvSetting(
    env,
    "FOUNDEROS_WEB_HOST",
    DEFAULT_FOUNDEROS_WEB_HOST,
    "Hostname used by the unified shell HTTP server.",
    (value) => validateHost(value, "FOUNDEROS_WEB_HOST")
  );
  const port = resolveEnvSetting(
    env,
    "FOUNDEROS_WEB_PORT",
    DEFAULT_FOUNDEROS_WEB_PORT,
    "Port exposed by the unified shell HTTP server.",
    (value) => validatePort(value, "FOUNDEROS_WEB_PORT")
  );
  const issues = [...host.issues, ...port.issues];

  return {
    host: host.value,
    port: port.value,
    origin: `http://${host.value}:${port.value}`,
    env: [host, port],
    issues,
  };
}

export function resolveShellUpstreamConfig(
  upstream: FounderOSUpstreamId,
  env: Record<string, string | undefined> = process.env
): FounderOSShellUpstreamConfig {
  const isQuorum = upstream === "quorum";
  const label = isQuorum ? "Quorum" : "Autopilot";
  const envKey = isQuorum ? "QUORUM_API_BASE_URL" : "AUTOPILOT_API_BASE_URL";
  const fallback = isQuorum
    ? DEFAULT_QUORUM_API_BASE_URL
    : DEFAULT_AUTOPILOT_API_BASE_URL;
  const resolved = resolveEnvSetting(
    env,
    envKey,
    fallback,
    `${label} upstream base URL.`,
    (value) => validateBaseUrl(value, envKey)
  );

  return {
    id: upstream,
    label,
    envKey,
    baseUrl: withNoTrailingSlash(resolved.value),
    source: resolved.source,
    rawValue: resolved.rawValue,
    issues: resolved.issues,
  };
}

export function getUpstreamBaseUrl(
  upstream: FounderOSUpstreamId,
  env: Record<string, string | undefined> = process.env
) {
  return resolveShellUpstreamConfig(upstream, env).baseUrl;
}

export function resolveFounderOSShellConfig(
  env: Record<string, string | undefined> = process.env
): FounderOSShellConfig {
  const runtime = resolveShellRuntimeConfig(env);
  const quorum = resolveShellUpstreamConfig("quorum", env);
  const autopilot = resolveShellUpstreamConfig("autopilot", env);
  const issues = [...runtime.issues, ...quorum.issues, ...autopilot.issues];

  return {
    runtime,
    upstreams: {
      quorum,
      autopilot,
    },
    issues,
  };
}

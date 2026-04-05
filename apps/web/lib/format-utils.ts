/**
 * Safe date formatting with NaN guard.
 * Returns formatted date string or fallback for invalid values.
 */
export function safeFormatDate(
  value: string | number | null | undefined,
  fallback = "—"
): string {
  if (!value) return fallback;
  const date = typeof value === "number"
    ? new Date(value * 1000)  // Unix timestamp
    : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function safeFormatShortDate(
  value: string | number | null | undefined,
  fallback = "—"
): string {
  if (!value) return fallback;
  const date = typeof value === "number"
    ? new Date(value * 1000)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function safeFormatRelativeTime(
  value: string | number | null | undefined,
  fallback = ""
): string {
  if (!value) return fallback;
  const timestamp = typeof value === "number" ? value : new Date(value).getTime() / 1000;
  if (Number.isNaN(timestamp)) return fallback;
  const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

export function truncate(value: string, limit = 180): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1).trimEnd()}…`;
}

export function humanizeToken(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

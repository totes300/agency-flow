/**
 * Format duration in minutes to "Xh Ym" display format.
 * Per CLAUDE.md formatting rule #3: always "Xh Ym", never decimal or raw minutes.
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a currency amount using Intl.NumberFormat.
 * Per CLAUDE.md formatting rule #1.
 * Formatters are cached by currency+locale key to avoid re-creating Intl.NumberFormat on every call.
 */
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
  amount: number,
  currencyCode: string,
  locale?: string,
): string {
  const key = `${locale ?? "default"}:${currencyCode}`;
  let formatter = currencyFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale ?? undefined, {
      style: "currency",
      currency: currencyCode,
    });
    currencyFormatterCache.set(key, formatter);
  }
  return formatter.format(amount);
}

/**
 * Format a date string (YYYY-MM-DD) for display using browser locale.
 * Per CLAUDE.md formatting rule #2.
 */
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatDate(dateString: string, locale?: string): string {
  const key = locale ?? "default";
  let formatter = dateFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale ?? undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatterCache.set(key, formatter);
  }
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return formatter.format(date);
}

/**
 * Format elapsed time from a start timestamp to now as h:mm:ss or m:ss.
 * Used by the live-ticking timer display.
 */
export function formatElapsed(startedAt: number, now: number): string {
  const diff = Math.max(0, now - startedAt)
  const totalSeconds = Math.floor(diff / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Format a timestamp to a human-readable relative time string (e.g., "2h ago", "3d ago").
 */
export function formatDistanceToNow(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

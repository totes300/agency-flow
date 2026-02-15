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
 */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale ?? undefined, {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

/**
 * Format a date string (YYYY-MM-DD) for display using browser locale.
 * Per CLAUDE.md formatting rule #2.
 */
export function formatDate(dateString: string, locale?: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(locale ?? undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

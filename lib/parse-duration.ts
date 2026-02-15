/**
 * Parse free-text duration string to minutes.
 * Supports: "1h 30m", "1.5h", "90m", "1:30", "45" (assumed minutes).
 * Returns number of minutes or null if unparsable.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // "1h 30m" or "1h" or "30m"
  const hmMatch = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i);
  if (hmMatch && (hmMatch[1] || hmMatch[2])) {
    const hours = parseInt(hmMatch[1] || "0", 10);
    const minutes = parseInt(hmMatch[2] || "0", 10);
    return hours * 60 + minutes;
  }

  // "1.5h"
  const decimalHMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (decimalHMatch) {
    return Math.round(parseFloat(decimalHMatch[1]) * 60);
  }

  // "1:30" (h:mm)
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    if (minutes < 60) return hours * 60 + minutes;
  }

  // Plain number (assumed minutes)
  const numMatch = trimmed.match(/^(\d+)$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  return null;
}

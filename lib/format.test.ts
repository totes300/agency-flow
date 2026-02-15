import { describe, expect, it } from "vitest";
import { formatDuration, formatCurrency, formatDate } from "./format";

describe("formatDuration", () => {
  it("formats zero minutes", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats hours only", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(150)).toBe("2h 30m");
  });

  it("formats single minute", () => {
    expect(formatDuration(1)).toBe("1m");
  });

  it("formats large durations", () => {
    expect(formatDuration(480)).toBe("8h");
  });

  it("handles negative as zero", () => {
    expect(formatDuration(-5)).toBe("0m");
  });
});

describe("formatCurrency", () => {
  it("formats USD", () => {
    const result = formatCurrency(1234.56, "USD", "en-US");
    expect(result).toBe("$1,234.56");
  });

  it("formats EUR", () => {
    const result = formatCurrency(1234.56, "EUR", "de-DE");
    expect(result).toContain("1.234,56");
  });

  it("formats HUF", () => {
    const result = formatCurrency(1234567, "HUF", "hu-HU");
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("567");
  });
});

describe("formatDate", () => {
  it("formats a date string with US locale", () => {
    const result = formatDate("2025-03-15", "en-US");
    expect(result).toBe("03/15/2025");
  });

  it("formats a date string with Hungarian locale", () => {
    const result = formatDate("2025-03-15", "hu-HU");
    expect(result).toContain("2025");
    expect(result).toContain("03");
    expect(result).toContain("15");
  });
});

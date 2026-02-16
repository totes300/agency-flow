import { describe, expect, it } from "vitest";
import { parseDuration } from "./parse-duration";

describe("parseDuration", () => {
  // ── Standard formats ──
  it("parses '1h 30m' → 90", () => expect(parseDuration("1h 30m")).toBe(90));
  it("parses '1h' → 60", () => expect(parseDuration("1h")).toBe(60));
  it("parses '30m' → 30", () => expect(parseDuration("30m")).toBe(30));
  it("parses '1.5h' → 90", () => expect(parseDuration("1.5h")).toBe(90));
  it("parses '90m' → 90", () => expect(parseDuration("90m")).toBe(90));
  it("parses '1:30' → 90", () => expect(parseDuration("1:30")).toBe(90));
  it("parses '45' → 45", () => expect(parseDuration("45")).toBe(45));
  it("parses '0:45' → 45", () => expect(parseDuration("0:45")).toBe(45));

  // ── Edge cases for billing accuracy ──
  it("parses '0h 15m' → 15", () => expect(parseDuration("0h 15m")).toBe(15));
  it("parses '8h' → 480 (full workday)", () => expect(parseDuration("8h")).toBe(480));
  it("parses '8h 0m' → 480", () => expect(parseDuration("8h 0m")).toBe(480));
  it("parses '0.25h' → 15 (quarter hour)", () => expect(parseDuration("0.25h")).toBe(15));
  it("parses '0.5h' → 30 (half hour)", () => expect(parseDuration("0.5h")).toBe(30));
  it("parses '2.75h' → 165", () => expect(parseDuration("2.75h")).toBe(165));
  it("parses '10:00' → 600", () => expect(parseDuration("10:00")).toBe(600));
  it("parses '0:05' → 5", () => expect(parseDuration("0:05")).toBe(5));
  it("parses '1' → 1 (minimum)", () => expect(parseDuration("1")).toBe(1));

  // ── Whitespace handling ──
  it("trims leading/trailing spaces", () => expect(parseDuration("  30m  ")).toBe(30));
  it("handles extra space between h and m", () => expect(parseDuration("1h  30m")).toBe(90));

  // ── Case insensitivity ──
  it("parses uppercase '1H 30M'", () => expect(parseDuration("1H 30M")).toBe(90));
  it("parses mixed case '2H'", () => expect(parseDuration("2H")).toBe(120));

  // ── Invalid inputs → null ──
  it("returns null for empty", () => expect(parseDuration("")).toBeNull());
  it("returns null for whitespace only", () => expect(parseDuration("   ")).toBeNull());
  it("returns null for garbage", () => expect(parseDuration("abc")).toBeNull());
  it("returns null for negative", () => expect(parseDuration("-30m")).toBeNull());
  it("returns null for colon with 60+ minutes", () => expect(parseDuration("1:60")).toBeNull());

  // ── Rounding (decimal hours) ──
  it("rounds 0.33h correctly → 20", () => expect(parseDuration("0.33h")).toBe(20));
  it("rounds 0.1h → 6", () => expect(parseDuration("0.1h")).toBe(6));
});

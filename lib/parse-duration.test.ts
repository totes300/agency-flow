import { describe, expect, it } from "vitest";
import { parseDuration } from "./parse-duration";

describe("parseDuration", () => {
  it("parses '1h 30m' → 90", () => expect(parseDuration("1h 30m")).toBe(90));
  it("parses '1h' → 60", () => expect(parseDuration("1h")).toBe(60));
  it("parses '30m' → 30", () => expect(parseDuration("30m")).toBe(30));
  it("parses '1.5h' → 90", () => expect(parseDuration("1.5h")).toBe(90));
  it("parses '90m' → 90", () => expect(parseDuration("90m")).toBe(90));
  it("parses '1:30' → 90", () => expect(parseDuration("1:30")).toBe(90));
  it("parses '45' → 45", () => expect(parseDuration("45")).toBe(45));
  it("parses '0:45' → 45", () => expect(parseDuration("0:45")).toBe(45));
  it("returns null for empty", () => expect(parseDuration("")).toBeNull());
  it("returns null for garbage", () => expect(parseDuration("abc")).toBeNull());
});

import { describe, it, expect } from "vitest";
import {
  isValidDate,
  daysBetweenInclusive,
  getSpanDays,
  isMultiDayRange,
} from "@/lib/date-range";

describe("isValidDate", () => {
  it("accepts a valid YYYY-MM-DD date", () => {
    expect(isValidDate("2026-03-15")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidDate("")).toBe(false);
  });

  it("rejects a malformed string", () => {
    expect(isValidDate("not-a-date")).toBe(false);
  });

  it("rejects a month out of range", () => {
    expect(isValidDate("2026-13-01")).toBe(false);
  });

  it("rejects a day out of range", () => {
    expect(isValidDate("2026-01-32")).toBe(false);
  });
});

describe("daysBetweenInclusive", () => {
  it("returns 1 for the same date", () => {
    expect(daysBetweenInclusive("2026-03-15", "2026-03-15")).toBe(1);
  });

  it("counts an inclusive multi-day span", () => {
    expect(daysBetweenInclusive("2026-03-15", "2026-03-20")).toBe(6);
  });

  it("counts a span crossing a month boundary", () => {
    expect(daysBetweenInclusive("2026-01-30", "2026-02-02")).toBe(4);
  });

  it("counts a span crossing a year boundary", () => {
    expect(daysBetweenInclusive("2025-12-30", "2026-01-02")).toBe(4);
  });
});

describe("getSpanDays", () => {
  it("returns 1 when endDate is null", () => {
    expect(getSpanDays("2026-03-15", null)).toBe(1);
  });

  it("returns 1 when endDate is invalid", () => {
    expect(getSpanDays("2026-03-15", "not-a-date")).toBe(1);
  });

  it("returns 1 when endDate equals date", () => {
    expect(getSpanDays("2026-03-15", "2026-03-15")).toBe(1);
  });

  it("returns 1 when endDate is before date", () => {
    expect(getSpanDays("2026-03-15", "2026-03-10")).toBe(1);
  });

  it("returns the correct span for a forward range", () => {
    expect(getSpanDays("2026-03-15", "2026-03-20")).toBe(6);
  });
});

describe("isMultiDayRange", () => {
  it("is false at exactly 1 day", () => {
    expect(isMultiDayRange("2026-03-15", "2026-03-15")).toBe(false);
  });

  it("is true at exactly 2 days", () => {
    expect(isMultiDayRange("2026-03-15", "2026-03-16")).toBe(true);
  });

  it("is true for a longer range", () => {
    expect(isMultiDayRange("2026-03-15", "2026-03-20")).toBe(true);
  });
});

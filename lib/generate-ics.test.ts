import { describe, it, expect } from "vitest";
import { generateICS } from "@/lib/generate-ics";
import type { DeadlineEvent } from "@/lib/types";

function baseEvent(overrides: Partial<DeadlineEvent> = {}): DeadlineEvent {
  return {
    id: "test-id",
    title: "Midterm Exam",
    date: "2026-03-15",
    endDate: null,
    time: null,
    type: "Exam",
    weight: "",
    notes: "",
    course: "",
    location: "",
    ...overrides,
  };
}

describe("generateICS", () => {
  it("generates an all-day entry for a single-day event with no time", async () => {
    const blob = generateICS([baseEvent()]);
    const text = await blob.text();
    expect(text).toContain("SUMMARY:Midterm Exam");
    expect(text).toContain("DTSTART;VALUE=DATE:20260315");
    expect(text).toContain("DURATION:P1DT");
  });

  it("generates a 1-hour timed entry when time is set", async () => {
    const blob = generateICS([baseEvent({ time: "14:00", course: "CS 101" })]);
    const text = await blob.text();
    expect(text).toContain("SUMMARY:CS 101: Midterm Exam");
    const expectedDtstart = new Date(2026, 2, 15, 14, 0)
      .toISOString()
      .replace(/[-:]|\.\d{3}/g, "");
    expect(text).toContain(`DTSTART:${expectedDtstart}`);
    expect(text).toContain("DURATION:PT1H");
  });

  it("uses an exclusive end date for a multi-day range", async () => {
    const blob = generateICS([
      baseEvent({ date: "2026-03-15", endDate: "2026-03-17" }),
    ]);
    const text = await blob.text();
    expect(text).toContain("DTSTART;VALUE=DATE:20260315");
    expect(text).toContain("DTEND;VALUE=DATE:20260318");
  });

  it("filters out an event with an invalid date", async () => {
    const blob = generateICS([baseEvent({ date: "not-a-date" })]);
    const text = await blob.text();
    expect(text).not.toContain("Midterm Exam");
  });

  it("includes location and notes when present", async () => {
    const blob = generateICS([
      baseEvent({ location: "Room 204", notes: "Bring a calculator" }),
    ]);
    const text = await blob.text();
    expect(text).toContain("LOCATION:Room 204");
    expect(text).toContain("DESCRIPTION:Bring a calculator");
  });

  it("omits LOCATION when empty", async () => {
    const blob = generateICS([baseEvent()]);
    const text = await blob.text();
    expect(text).not.toContain("LOCATION:");
  });
});

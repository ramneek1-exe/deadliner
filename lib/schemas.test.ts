import { describe, it, expect } from "vitest";
import { aiEventSchema, aiResponseSchema } from "@/lib/schemas";

function parseEvent(overrides: Record<string, unknown> = {}) {
  return aiEventSchema.parse({
    title: "Midterm Exam",
    date: "2026-01-30",
    type: "exam",
    ...overrides,
  });
}

describe("aiEventSchema date normalization", () => {
  it("keeps an already-correct date", () => {
    expect(parseEvent({ date: "2026-01-30" }).date).toBe("2026-01-30");
  });

  it("pads an unpadded dash date", () => {
    expect(parseEvent({ date: "2026-1-30" }).date).toBe("2026-01-30");
  });

  it("normalizes a slash date", () => {
    expect(parseEvent({ date: "2026/01/30" }).date).toBe("2026-01-30");
  });

  it("normalizes a prose date", () => {
    expect(parseEvent({ date: "January 30, 2026" }).date).toBe("2026-01-30");
  });
});

describe("aiEventSchema time normalization", () => {
  it("keeps an already-correct time", () => {
    expect(parseEvent({ time: "14:00" }).time).toBe("14:00");
  });

  it("normalizes 12-hour PM time", () => {
    expect(parseEvent({ time: "2:00 PM" }).time).toBe("14:00");
  });

  it("normalizes 11:59pm", () => {
    expect(parseEvent({ time: "11:59pm" }).time).toBe("23:59");
  });

  it("normalizes 12:00am to midnight", () => {
    expect(parseEvent({ time: "12:00am" }).time).toBe("00:00");
  });

  it("normalizes 12:00pm to noon", () => {
    expect(parseEvent({ time: "12:00pm" }).time).toBe("12:00");
  });

  it("pads an unpadded hour", () => {
    expect(parseEvent({ time: "9:30" }).time).toBe("09:30");
  });
});

describe("aiEventSchema type normalization", () => {
  it("maps exam keywords to Exam", () => {
    expect(parseEvent({ type: "midterm" }).type).toBe("Exam");
    expect(parseEvent({ type: "quiz" }).type).toBe("Exam");
  });

  it("maps assignment keywords to Assignment", () => {
    expect(parseEvent({ type: "homework" }).type).toBe("Assignment");
    expect(parseEvent({ type: "lab report" }).type).toBe("Assignment");
  });

  it("maps reading keywords to Reading", () => {
    expect(parseEvent({ type: "required reading" }).type).toBe("Reading");
  });

  it("falls back to Other for unrecognized types", () => {
    expect(parseEvent({ type: "field trip" }).type).toBe("Other");
  });
});

describe("aiEventSchema defaults", () => {
  it("defaults optional fields when omitted", () => {
    const event = parseEvent();
    expect(event.endDate).toBeNull();
    expect(event.time).toBeNull();
    expect(event.weight).toBe("");
    expect(event.notes).toBe("");
    expect(event.course).toBe("");
    expect(event.location).toBe("");
  });
});

describe("aiResponseSchema", () => {
  it("defaults courseName when omitted", () => {
    const result = aiResponseSchema.parse({ events: [] });
    expect(result.courseName).toBe("Unknown Course");
  });
});

# Automated Tests (Pure Logic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vitest test suite covering the app's pure logic modules (`lib/date-range.ts`, `lib/generate-ics.ts`, `lib/schemas.ts`).

**Architecture:** Vitest runs directly against the TypeScript source with no build step, using a `@` path alias matching the project's existing `tsconfig.json` alias. Tests are co-located next to the modules they cover, matching the existing flat `lib/` layout. No DOM, no mocking — every module under test is pure (no I/O, no external calls).

**Tech Stack:** Vitest (new devDependency). No jsdom, no React Testing Library, no coverage tooling, no CI wiring — all explicitly out of scope per the approved spec.

## Global Constraints

- No new test infra beyond Vitest itself — no jsdom, no RTL, no mocking libraries.
- No coverage-threshold tooling.
- No CI workflow wiring.
- Do not add new calendar-validity checks (e.g. rejecting Feb 30) — tests assert the modules' current, real behavior.
- `lib/date-range.ts`, `lib/generate-ics.ts`, `lib/schemas.ts` are functionally complete already — this plan adds tests only, no behavior changes (the one bug found during scoping — `getSpanDays` not clamping backwards ranges to 1 — was already fixed and committed separately before this plan was written; tests in Task 2 verify the corrected behavior).
- Path alias: `@/*` maps to the repo root (see `tsconfig.json`).

---

### Task 1: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` / `test:watch` scripts)
- Test: `lib/smoke.test.ts` (deleted at the end of this task — exists only to prove the config works)

**Interfaces:**
- Produces: a working `vitest run` / `vitest` command, resolving `@/*` imports, that Tasks 2-4 rely on.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts` at the repo root:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block, add two entries (alongside the existing `dev`/`build`/`start`/`lint`):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test to confirm the config resolves `@/*` correctly**

Create `lib/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isValidDate } from "@/lib/date-range";

describe("vitest smoke test", () => {
  it("resolves the @ path alias and runs", () => {
    expect(isValidDate("2026-01-01")).toBe(true);
  });
});
```

- [ ] **Step 5: Run it to verify the setup works**

Run: `npm test`
Expected: 1 test file, 1 test, PASS. If it fails with a module-resolution error, the `resolve.alias` path in `vitest.config.ts` is wrong — fix it before continuing.

- [ ] **Step 6: Delete the smoke test**

It served only to validate the config; Task 2 supersedes it with real coverage of the same module.

```bash
rm lib/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add Vitest test runner"
```

---

### Task 2: `lib/date-range.ts` tests

**Files:**
- Create: `lib/date-range.test.ts`

**Interfaces:**
- Consumes: `isValidDate(dateStr: string): boolean`, `daysBetweenInclusive(startStr: string, endStr: string): number`, `getSpanDays(date: string, endDate: string | null): number`, `isMultiDayRange(date: string, endDate: string | null): boolean` — all from `lib/date-range.ts`, unchanged by this task.

- [ ] **Step 1: Write the test file**

Create `lib/date-range.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run lib/date-range.test.ts`
Expected: 17 tests, all PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/date-range.test.ts
git commit -m "test: add lib/date-range.ts coverage"
```

---

### Task 3: `lib/generate-ics.ts` tests

**Files:**
- Create: `lib/generate-ics.test.ts`

**Interfaces:**
- Consumes: `generateICS(events: DeadlineEvent[]): Blob` from `lib/generate-ics.ts`, and the `DeadlineEvent` type from `lib/types.ts` (fields: `id`, `title`, `date`, `endDate`, `time`, `type`, `weight`, `notes`, `course`, `location`), both unchanged by this task.

- [ ] **Step 1: Write the test file**

Create `lib/generate-ics.test.ts`:

```ts
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
    expect(text).toMatch(/DTSTART:20260315T\d{6}Z/);
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
    const blob = generateICS([baseEvent({ location: "" })]);
    const text = await blob.text();
    expect(text).not.toContain("LOCATION:");
  });
});
```

Note: the timed-entry assertion uses a regex (`\d{6}Z`) rather than a literal UTC timestamp because `ics` converts the local `start` time to UTC — asserting a literal hour would make the test's pass/fail depend on the machine's local timezone.

- [ ] **Step 2: Run the tests**

Run: `npx vitest run lib/generate-ics.test.ts`
Expected: 6 tests, all PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/generate-ics.test.ts
git commit -m "test: add lib/generate-ics.ts coverage"
```

---

### Task 4: `lib/schemas.ts` tests

**Files:**
- Create: `lib/schemas.test.ts`

**Interfaces:**
- Consumes: `aiEventSchema` and `aiResponseSchema` (Zod schemas) from `lib/schemas.ts`, unchanged by this task.

- [ ] **Step 1: Write the test file**

Create `lib/schemas.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run lib/schemas.test.ts`
Expected: 16 tests, all PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas.test.ts
git commit -m "test: add lib/schemas.ts coverage"
```

---

### Task 5: Full suite verification

**Files:** none (verification only)

**Interfaces:** none — this task consumes Tasks 1-4's combined output.

- [ ] **Step 1: Run the entire suite**

Run: `npm test`
Expected: 4 test files (`date-range`, `generate-ics`, `schemas`, and no leftover `smoke`), 39 tests total, all PASS.

- [ ] **Step 2: Confirm no stray files**

Run: `git status`
Expected: clean (Tasks 1-4 already committed everything); confirm `lib/smoke.test.ts` is not present.

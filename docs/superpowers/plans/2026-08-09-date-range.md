# Multi-Day Exam Window (Date Range) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `endDate: string | null` to `DeadlineEvent` so multi-day windows (testing-centre exams, open-book quiz windows) export as genuine multi-day spanning `.ics` events instead of silently collapsing to one day.

**Architecture:** Additive-only, same pattern as the location field: type → Zod schema → AI prompt/JSON schema → review UI → edit drawer → ICS export. `endDate` defaults to `null` (single-day, today's behavior unchanged); a value means the event spans `date` through `endDate` inclusive.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, `openai` SDK (strict `json_schema`), `ics` library, `lucide-react`.

## Global Constraints

- No new npm dependencies.
- No new environment variables.
- `endDate` applies to all event types, not Exam-only.
- Ranged events always export as an all-day banner — `time` is ignored for ranged events (per spec decision).
- If `endDate` is before `date`, clamp to a 1-day event at export time — never throw, never produce a negative-duration `.ics` entry.
- Inline (click-to-edit) date editing in the review table continues to edit only the start `date` — end-date editing is drawer-only.
- No automated test suite exists in this repo — verification is manual, matching features 1 and 2a.

---

### Task 1: Data layer — type, Zod schema, AI prompt + JSON schema

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/schemas.ts`
- Modify: `app/api/parse/route.ts`

**Interfaces:**
- Produces: `DeadlineEvent.endDate: string | null` — every event object from this point on carries this field. Tasks 2–4 consume it by name.

- [ ] **Step 1: Add `endDate` to the `DeadlineEvent` type**

In `lib/types.ts`, find:

```typescript
export interface DeadlineEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm or null for all-day
  type: EventType;
  weight: string;
  notes: string;
  course: string;
  location: string;
}
```

Replace with (adds `endDate` after `date`, next to the field it's most related to):

```typescript
export interface DeadlineEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD, or null for a single-day event; when set, the event spans date..endDate inclusive
  time: string | null; // HH:mm or null for all-day
  type: EventType;
  weight: string;
  notes: string;
  course: string;
  location: string;
}
```

- [ ] **Step 2: Add `endDate` to the Zod validation schema**

In `lib/schemas.ts`, find:

```typescript
export const aiEventSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1).transform(normalizeDate),
  time: z
    .union([z.string().transform(normalizeTime), z.null()])
    .optional()
    .default(null),
  type: z
```

Replace with (adds `endDate` right after `date`, reusing `normalizeDate` — not `normalizeTime` — and following the same nullable-union shape already used by `time`):

```typescript
export const aiEventSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1).transform(normalizeDate),
  endDate: z
    .union([z.string().transform(normalizeDate), z.null()])
    .optional()
    .default(null),
  time: z
    .union([z.string().transform(normalizeTime), z.null()])
    .optional()
    .default(null),
  type: z
```

- [ ] **Step 3: Add `endDate` to the OpenAI strict JSON schema**

In `app/api/parse/route.ts`, find `RESPONSE_JSON_SCHEMA` (currently lines 92-119):

```typescript
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    courseName: { type: "string" },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          time: { type: ["string", "null"] },
          type: {
            type: "string",
            enum: ["Exam", "Assignment", "Reading", "Other"],
          },
          weight: { type: "string" },
          notes: { type: "string" },
          location: { type: "string" },
        },
        required: ["title", "date", "time", "type", "weight", "notes", "location"],
        additionalProperties: false,
      },
    },
  },
  required: ["courseName", "events"],
  additionalProperties: false,
} as const;
```

Replace with (adds `endDate` right after `date`, nullable with the same date pattern, added to `required`):

```typescript
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    courseName: { type: "string" },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          endDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          time: { type: ["string", "null"] },
          type: {
            type: "string",
            enum: ["Exam", "Assignment", "Reading", "Other"],
          },
          weight: { type: "string" },
          notes: { type: "string" },
          location: { type: "string" },
        },
        required: ["title", "date", "endDate", "time", "type", "weight", "notes", "location"],
        additionalProperties: false,
      },
    },
  },
  required: ["courseName", "events"],
  additionalProperties: false,
} as const;
```

- [ ] **Step 4: Update the system prompt**

In `app/api/parse/route.ts`, find (currently lines 54-90):

```typescript
const SYSTEM_PROMPT = `You are a syllabus parser. Extract all deadlines, due dates, exams, quizzes, assignments, readings, and other time-sensitive items from the provided syllabus text.

Rules:
- Only extract deadlines and due dates. Do NOT extract office hours, class policies, instructor info, or general course descriptions.
- For each deadline, extract: title, date, time (if specified), type, weight (if mentioned), location (if mentioned), and any relevant notes or details.

Date handling:
- Output date format: YYYY-MM-DD. You MUST always output dates in this format.
- Syllabi use many date formats — "Fri 30 Jan", "January 30", "1/30", "Jan 30, 2026", "Week 5", etc. Convert ALL of them to YYYY-MM-DD.
- If no year is specified, default to the current year (2026). For academic terms spanning two years, infer the correct year from context (e.g., a Winter 2026 term starting in January 2026).
- If only a day of the week is given with no date, skip that item.

Time handling:
- Output time format: HH:mm (24-hour). Convert AM/PM to 24-hour (e.g., "2:00 PM" → "14:00", "11:59pm" → "23:59").
- Pay attention to contextual time info that applies broadly. For example, if the syllabus says "all assignments are due by 11:59pm on the due date", then apply "23:59" as the time for every assignment deadline.
- If no specific time is mentioned or implied for an item, set time to null.

Type: must be one of "Exam", "Assignment", "Reading", "Other".
Weight: include if mentioned (e.g., "30%"), otherwise use empty string.
Notes: include any additional context like topics covered or special instructions.
Location: include the room/building, testing centre, or online platform (e.g. "Moodle") if mentioned, otherwise use empty string. Applies to any event type, not just exams.

Respond with JSON only in this exact format:
{
  "courseName": "string — the course name/code extracted from the document (e.g., 'MATH 201', 'CS 350'). If not found, use 'Unknown Course'.",
  "events": [
    {
      "title": "string",
      "date": "YYYY-MM-DD",
      "time": "HH:mm" | null,
      "type": "Exam" | "Assignment" | "Reading" | "Other",
      "weight": "string",
      "notes": "string",
      "location": "string"
    }
  ]
}`;
```

Replace with (adds date-range handling instructions and the `endDate` field to the JSON example; updates the summary line to mention it):

```typescript
const SYSTEM_PROMPT = `You are a syllabus parser. Extract all deadlines, due dates, exams, quizzes, assignments, readings, and other time-sensitive items from the provided syllabus text.

Rules:
- Only extract deadlines and due dates. Do NOT extract office hours, class policies, instructor info, or general course descriptions.
- For each deadline, extract: title, date, end date (if it's a multi-day window), time (if specified), type, weight (if mentioned), location (if mentioned), and any relevant notes or details.

Date handling:
- Output date format: YYYY-MM-DD. You MUST always output dates in this format.
- Syllabi use many date formats — "Fri 30 Jan", "January 30", "1/30", "Jan 30, 2026", "Week 5", etc. Convert ALL of them to YYYY-MM-DD.
- If no year is specified, default to the current year (2026). For academic terms spanning two years, infer the correct year from context (e.g., a Winter 2026 term starting in January 2026).
- If only a day of the week is given with no date, skip that item.

Date range handling:
- Some deadlines are open across a range of days rather than due on a single date — e.g. "Final Exam: available March 30 - April 3" (testing centre), "Quiz 3: any time during the window April 8-10" (open-book), or a multi-day assignment drop period.
- When you detect a range, set "date" to the range's start and "endDate" to the range's end, both in YYYY-MM-DD format.
- For a normal single-date deadline (the common case), set "endDate" to null.

Time handling:
- Output time format: HH:mm (24-hour). Convert AM/PM to 24-hour (e.g., "2:00 PM" → "14:00", "11:59pm" → "23:59").
- Pay attention to contextual time info that applies broadly. For example, if the syllabus says "all assignments are due by 11:59pm on the due date", then apply "23:59" as the time for every assignment deadline.
- If no specific time is mentioned or implied for an item, set time to null.
- For a ranged item (endDate is not null), set time to null regardless of any specific open/close hours mentioned — ranged items are always treated as all-day.

Type: must be one of "Exam", "Assignment", "Reading", "Other".
Weight: include if mentioned (e.g., "30%"), otherwise use empty string.
Notes: include any additional context like topics covered or special instructions.
Location: include the room/building, testing centre, or online platform (e.g. "Moodle") if mentioned, otherwise use empty string. Applies to any event type, not just exams.

Respond with JSON only in this exact format:
{
  "courseName": "string — the course name/code extracted from the document (e.g., 'MATH 201', 'CS 350'). If not found, use 'Unknown Course'.",
  "events": [
    {
      "title": "string",
      "date": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD" | null,
      "time": "HH:mm" | null,
      "type": "Exam" | "Assignment" | "Reading" | "Other",
      "weight": "string",
      "notes": "string",
      "location": "string"
    }
  ]
}`;
```

- [ ] **Step 5: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/schemas.ts app/api/parse/route.ts
git commit -m "feat: extract multi-day date ranges from syllabi"
```

---

### Task 2: Edit drawer — end date input

**Files:**
- Modify: `components/EditDrawer.tsx`

**Interfaces:**
- Consumes: `DeadlineEvent.endDate: string | null` (Task 1).

- [ ] **Step 1: Add `endDate` state and include it in the save payload**

In `components/EditDrawer.tsx`, find:

```typescript
  const [title, setTitle] = useState(event.title);
  const [notes, setNotes] = useState(event.notes);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time ?? "");
  const [type, setType] = useState<EventType>(event.type);
  const [weight, setWeight] = useState(event.weight);
  const [course, setCourse] = useState(event.course);
  const [location, setLocation] = useState(event.location);

  const handleSave = () => {
    onSave({
      ...event,
      title,
      notes,
      date,
      time: time || null,
      type,
      weight,
      course,
      location,
    });
  };
```

Replace with:

```typescript
  const [title, setTitle] = useState(event.title);
  const [notes, setNotes] = useState(event.notes);
  const [date, setDate] = useState(event.date);
  const [endDate, setEndDate] = useState(event.endDate ?? "");
  const [time, setTime] = useState(event.time ?? "");
  const [type, setType] = useState<EventType>(event.type);
  const [weight, setWeight] = useState(event.weight);
  const [course, setCourse] = useState(event.course);
  const [location, setLocation] = useState(event.location);

  const handleSave = () => {
    onSave({
      ...event,
      title,
      notes,
      date,
      endDate: endDate || null,
      time: time || null,
      type,
      weight,
      course,
      location,
    });
  };
```

- [ ] **Step 2: Add the End Date input, directly after Date**

In `components/EditDrawer.tsx`, find:

```typescript
          <div>
            <label className="mb-1.5 block text-sm font-medium">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Time
```

Replace with (adds an End Date field between Date and Time, with a Clear button following the same pattern already used by the Time field's clear button):

```typescript
          <div>
            <label className="mb-1.5 block text-sm font-medium">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              End Date
              <span className="ml-1 font-normal text-muted">
                (for multi-day windows, e.g. a testing centre exam)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
              />
              {endDate && (
                <button
                  onClick={() => setEndDate("")}
                  className="rounded-md border border-border px-4 py-2.5 text-xs text-muted hover:bg-foreground/5 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Time
```

- [ ] **Step 3: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/EditDrawer.tsx
git commit -m "feat: add end date input to edit drawer"
```

---

### Task 3: Review step — date range display (desktop + mobile)

**Files:**
- Modify: `components/ReviewStep.tsx`

**Interfaces:**
- Consumes: `DeadlineEvent.endDate: string | null` (Task 1). Consumes the existing `formatDate(dateStr: string): string` helper already defined in this file — no new date-formatting helper needed, ranges are built by calling it twice.

- [ ] **Step 1: Add a `formatDateRange` helper next to the existing `formatDate`**

In `components/ReviewStep.tsx`, find:

```typescript
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
```

Replace with (adds a small helper that reuses `formatDate` for both ends of a range):

```typescript
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateDisplay(dateStr: string, endDateStr: string | null): string {
  if (!endDateStr) return formatDate(dateStr);
  return `${formatDate(dateStr)} – ${formatDate(endDateStr)}`;
}
```

- [ ] **Step 2: Use it in the desktop table's date button**

In `components/ReviewStep.tsx`, find (inside the desktop table row, the non-editing branch of the date cell):

```typescript
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "date",
                                      })
                                    }
                                    className="hover:underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                                  >
                                    {formatDate(event.date)}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-muted">
                                {editingField?.id === event.id &&
                                  editingField.field === "time" ? (
```

Replace with (only the `{formatDate(event.date)}` line changes, to `{formatDateDisplay(event.date, event.endDate)}` — everything else in this block is unchanged context to locate the right spot):

```typescript
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "date",
                                      })
                                    }
                                    className="hover:underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                                  >
                                    {formatDateDisplay(event.date, event.endDate)}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-muted">
                                {editingField?.id === event.id &&
                                  editingField.field === "time" ? (
```

- [ ] **Step 3: Use it in the mobile card's date button**

In `components/ReviewStep.tsx`, find (inside the mobile card, the non-editing branch of the date button — note this one uses a different className than the desktop version, `hover:underline underline-offset-4` without the `decoration-*` classes, so match carefully):

```typescript
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "date",
                                      })
                                    }
                                    className="hover:underline underline-offset-4"
                                  >
                                    {formatDate(event.date)}
                                  </button>
                                )}
                                <span>&middot;</span>
```

Replace with:

```typescript
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditingField({
                                        id: event.id,
                                        field: "date",
                                      })
                                    }
                                    className="hover:underline underline-offset-4"
                                  >
                                    {formatDateDisplay(event.date, event.endDate)}
                                  </button>
                                )}
                                <span>&middot;</span>
```

- [ ] **Step 4: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/ReviewStep.tsx
git commit -m "feat: show date range in review step for multi-day events"
```

---

### Task 4: ICS export — multi-day spanning event

**Files:**
- Modify: `lib/generate-ics.ts`

**Interfaces:**
- Consumes: `DeadlineEvent.endDate: string | null` (Task 1). Produces: a helper `daysBetweenInclusive(startStr: string, endStr: string): number` used only within this file.

- [ ] **Step 1: Add a day-count helper and use it to compute the all-day event's duration**

In `lib/generate-ics.ts`, find the full current file:

```typescript
import { createEvents, type EventAttributes } from "ics";
import type { DeadlineEvent } from "@/lib/types";

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return !isNaN(y) && !isNaN(m) && !isNaN(d) && y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

export function generateICS(events: DeadlineEvent[]): Blob {
  const icsEvents: EventAttributes[] = events
    .filter((event) => isValidDate(event.date))
    .map((event) => {
      const [y, m, d] = event.date.split("-").map(Number);

      if (event.time) {
        const [h, min] = event.time.split(":").map(Number);
        return {
          title: event.course ? `${event.course}: ${event.title}` : event.title,
          description: [event.course, event.notes].filter(Boolean).join(" — ") || undefined,
          location: event.location || undefined,
          start: [y, m, d, h, min] as [number, number, number, number, number],
          duration: { hours: 1 },
        };
      }

      return {
        title: event.title,
        description: event.notes || undefined,
        location: event.location || undefined,
        start: [y, m, d] as [number, number, number],
        duration: { days: 1 },
      };
    });

  const { error, value } = createEvents(icsEvents);

  // ics returns an empty object {} (truthy) as error in some failure cases,
  // so check value directly rather than relying on error truthiness
  if (!value) {
    throw new Error("Failed to generate calendar file.");
  }

  return new Blob([value], { type: "text/calendar" });
}
```

Replace the whole file with:

```typescript
import { createEvents, type EventAttributes } from "ics";
import type { DeadlineEvent } from "@/lib/types";

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return !isNaN(y) && !isNaN(m) && !isNaN(d) && y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

// Inclusive day count between two YYYY-MM-DD dates. Returns 1 for the same
// date. Callers must have already validated both dates with isValidDate.
function daysBetweenInclusive(startStr: string, endStr: string): number {
  const [ys, ms, ds] = startStr.split("-").map(Number);
  const [ye, me, de] = endStr.split("-").map(Number);
  const start = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diffDays + 1;
}

export function generateICS(events: DeadlineEvent[]): Blob {
  const icsEvents: EventAttributes[] = events
    .filter((event) => isValidDate(event.date))
    .map((event) => {
      const [y, m, d] = event.date.split("-").map(Number);

      const hasValidRange = event.endDate !== null && isValidDate(event.endDate);
      const spanDays = hasValidRange
        ? daysBetweenInclusive(event.date, event.endDate as string)
        : 1;

      if (spanDays >= 2) {
        // Ranged events are always all-day, per the multi-day window design
        // decision — time is ignored even if the source mentioned specific
        // open/close hours.
        return {
          title: event.title,
          description: event.notes || undefined,
          location: event.location || undefined,
          start: [y, m, d] as [number, number, number],
          duration: { days: spanDays },
        };
      }

      if (event.time) {
        const [h, min] = event.time.split(":").map(Number);
        return {
          title: event.course ? `${event.course}: ${event.title}` : event.title,
          description: [event.course, event.notes].filter(Boolean).join(" — ") || undefined,
          location: event.location || undefined,
          start: [y, m, d, h, min] as [number, number, number, number, number],
          duration: { hours: 1 },
        };
      }

      return {
        title: event.title,
        description: event.notes || undefined,
        location: event.location || undefined,
        start: [y, m, d] as [number, number, number],
        duration: { days: 1 },
      };
    });

  const { error, value } = createEvents(icsEvents);

  // ics returns an empty object {} (truthy) as error in some failure cases,
  // so check value directly rather than relying on error truthiness
  if (!value) {
    throw new Error("Failed to generate calendar file.");
  }

  return new Blob([value], { type: "text/calendar" });
}
```

Note what this achieves: `hasValidRange` is `false` when `endDate` is `null` (the common case) or malformed — falling through to `spanDays = 1`, which takes the exact same timed/all-day branches as before this feature existed, so single-day events are byte-for-byte unaffected. When `endDate` is valid and `daysBetweenInclusive` computes 1 (same start/end date — a malformed-but-technically-valid range) it also falls through to the existing single-day branches rather than the new ranged branch, since `spanDays >= 2` is false. When `endDate` is before `date`, `daysBetweenInclusive` returns a number less than 1, `spanDays >= 2` is false, and it falls through to the existing single-day branches too — this is the "clamp to 1 day" behavior the spec requires, achieved for free by the `>= 2` guard rather than needing a separate clamp step.

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/generate-ics.ts
git commit -m "feat: export multi-day date ranges as spanning ics events"
```

---

### Task 5: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: starts on `http://localhost:3000` with no errors.

- [ ] **Step 2: Verify extraction produces `endDate` for ranges**

Paste a sample syllabus with both a ranged item and a single-date item, e.g.:

```
BIOL 220 Course Outline

Final Exam: available March 30 - April 3, 2026, Testing Centre, worth 35%
Lab Report 2 due March 12, 2026 at 11:59pm, submit via Moodle
```

Expected: the Final Exam event has `date: "2026-03-30"` and `endDate: "2026-04-03"`; the Lab Report event has `endDate: null`. This also confirms the live OpenAI API accepts the strict schema's new nullable `endDate` property with its date pattern — the one genuinely novel technical risk in this feature.

- [ ] **Step 3: Verify review step display**

In the review step, confirm the Final Exam row shows a date range ("Sun Mar 30, 2026 – Fri Apr 3, 2026" or similar, per `formatDateDisplay`) and the Lab Report row shows a single date, in both desktop and mobile layouts (resize the browser or use dev tools device emulation to check mobile).

- [ ] **Step 4: Verify editing**

Open the edit drawer for the Lab Report (no end date) — confirm the End Date field is present and empty, set it to a date after the start date, save, confirm the review row now shows a range. Open the edit drawer for the Final Exam — confirm the existing end date pre-fills, clear it, save, confirm the review row reverts to a single date.

- [ ] **Step 5: Verify ICS export**

Export the calendar, open the downloaded `.ics` file in a text editor. Expected: the Final Exam's `VEVENT` block has a `DTSTART` on March 30 and a `DTEND` after April 3 (the `ics` library computes `DTEND` from `start` + `duration`, so for a 5-day span starting March 30 the `DTEND` should be April 4 — the exclusive end date one day past the last inclusive day, which is standard iCalendar all-day-event semantics). The Lab Report's `VEVENT` should look unchanged from before this feature (single all-day event).

- [ ] **Step 6: Run the full lint pass**

Run: `npm run lint`
Expected: clean, or only the same pre-existing unrelated issues seen throughout this repo's history (`ExportStep.tsx` react-hooks rule, `generate-ics.ts` unused var — note: re-check the unused-var warning still applies after Task 4's rewrite of this file, since the destructured `error` from `createEvents` is unchanged).

- [ ] **Step 7: Update the handoff doc**

In `docs/HANDOFF.md`, update feature 2's entry: mark 2b (multi-day exam date ranges) as done, noting today's date and that both live extraction and the review/export UI were manually verified. This completes feature 2 entirely (both 2a and 2b) — update the parent feature-2 line if it's still phrased as in-progress.

- [ ] **Step 8: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: mark multi-day date range (2b) complete in handoff"
```

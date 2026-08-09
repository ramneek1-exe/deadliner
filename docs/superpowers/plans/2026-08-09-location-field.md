# Location Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `location` field to `DeadlineEvent` — extracted by the AI, editable in the review UI, exported to `.ics` — following the exact pattern already established by `weight`/`notes`/`course`.

**Architecture:** Additive-only change threaded through the existing pipeline: type → Zod schema → AI prompt/JSON schema → review UI → edit drawer → ICS export. No new files, no restructuring.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, `openai` SDK (Chat Completions, strict `json_schema`), `ics` library, `lucide-react` icons.

## Global Constraints

- No new npm dependencies.
- No new environment variables.
- `location` applies to **all event types**, not Exam-only (per spec decision).
- Plain string field only — no structured/categorized location (per spec decision, Approach A over C).
- Desktop review table gets **no new column** — location shows as a subtitle under the event title (per spec decision).
- No automated test suite exists in this repo — verification is manual, matching feature 1's pattern.

---

### Task 1: Data layer — type, Zod schema, AI prompt + JSON schema

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/schemas.ts`
- Modify: `app/api/parse/route.ts`

**Interfaces:**
- Produces: `DeadlineEvent.location: string` — every event object flowing through the app from this point on carries this field (defaults to `""` when the AI doesn't find one). Tasks 2–4 consume this field by name.

- [ ] **Step 1: Add `location` to the `DeadlineEvent` type**

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
}
```

Replace with:

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

- [ ] **Step 2: Add `location` to the Zod validation schema**

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
    .string()
    .transform((val) => {
      // Normalize common variations
      const lower = val.toLowerCase();
      if (lower.includes("exam") || lower.includes("quiz") || lower.includes("test") || lower.includes("midterm") || lower.includes("final")) return "Exam" as const;
      if (lower.includes("assign") || lower.includes("homework") || lower.includes("hw") || lower.includes("project") || lower.includes("paper") || lower.includes("essay") || lower.includes("lab") || lower.includes("report")) return "Assignment" as const;
      if (lower.includes("read")) return "Reading" as const;
      return "Other" as const;
    }),
  weight: z.string().default(""),
  notes: z.string().default(""),
  course: z.string().default(""),
});
```

Replace the final three lines with:

```typescript
  weight: z.string().default(""),
  notes: z.string().default(""),
  course: z.string().default(""),
  location: z.string().default(""),
});
```

- [ ] **Step 3: Add `location` to the OpenAI strict JSON schema**

In `app/api/parse/route.ts`, find `RESPONSE_JSON_SCHEMA` (currently lines 90-116):

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
        },
        required: ["title", "date", "time", "type", "weight", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["courseName", "events"],
  additionalProperties: false,
} as const;
```

Replace with (adds `location` property and adds it to the per-event `required` array — strict mode requires every property to be listed in `required`):

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

- [ ] **Step 4: Update the system prompt**

In `app/api/parse/route.ts`, find (currently lines 71-88):

```typescript
Type: must be one of "Exam", "Assignment", "Reading", "Other".
Weight: include if mentioned (e.g., "30%"), otherwise use empty string.
Notes: include any additional context like location, topics covered, or special instructions.

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
      "notes": "string"
    }
  ]
}`;
```

Replace with (splits location out of the notes description into its own field, and adds it to the JSON example):

```typescript
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

- [ ] **Step 5: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors (the existing `as const` schema and Zod inference both accept the added field; `route.ts`'s `events.map((e) => ({ ...e, id: ..., course: ... }))` at the bottom of the file already spreads `e`, so `location` passes through automatically with no further code change needed there).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/schemas.ts app/api/parse/route.ts
git commit -m "feat: extract location field from syllabi"
```

---

### Task 2: Edit drawer — location input

**Files:**
- Modify: `components/EditDrawer.tsx`

**Interfaces:**
- Consumes: `DeadlineEvent.location: string` (Task 1).

- [ ] **Step 1: Add `location` state and include it in the save payload**

In `components/EditDrawer.tsx`, find:

```typescript
  const [title, setTitle] = useState(event.title);
  const [notes, setNotes] = useState(event.notes);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time ?? "");
  const [type, setType] = useState<EventType>(event.type);
  const [weight, setWeight] = useState(event.weight);
  const [course, setCourse] = useState(event.course);

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
    });
  };
```

Replace with:

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

- [ ] **Step 2: Add the Location input field, after Course**

In `components/EditDrawer.tsx`, find:

```typescript
          <div>
            <label className="mb-1.5 block text-sm font-medium">Course</label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>
        </div>
      </div>
```

Replace with (adds a Location field after Course, same input pattern):

```typescript
          <div>
            <label className="mb-1.5 block text-sm font-medium">Course</label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Location
              <span className="ml-1 font-normal text-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Room 204, Testing Centre, Moodle"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/EditDrawer.tsx
git commit -m "feat: add location input to edit drawer"
```

---

### Task 3: Review step — location subtitle (desktop + mobile)

**Files:**
- Modify: `components/ReviewStep.tsx`

**Interfaces:**
- Consumes: `DeadlineEvent.location: string` (Task 1).

- [ ] **Step 1: Import the `MapPin` icon**

In `components/ReviewStep.tsx`, find:

```typescript
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
```

Replace with:

```typescript
import { Pencil, Trash2, ChevronDown, ChevronRight, MapPin } from "lucide-react";
```

- [ ] **Step 2: Add the location subtitle to the desktop table row**

In `components/ReviewStep.tsx`, find the desktop table's title cell:

```typescript
                              <td className="px-4 py-2.5 font-medium">
                                {event.title}
                              </td>
```

Replace with (adds a subtitle line under the title, only rendered when `location` is non-empty):

```typescript
                              <td className="px-4 py-2.5 font-medium">
                                {event.title}
                                {event.location && (
                                  <div className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
                              </td>
```

- [ ] **Step 3: Add the location subtitle to the mobile card**

In `components/ReviewStep.tsx`, find the mobile card's title paragraph:

```typescript
                            <div className="flex-1">
                              <p className="font-medium">{event.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted">
```

Replace with (same conditional subtitle, placed directly under the title and above the existing date/time line):

```typescript
                            <div className="flex-1">
                              <p className="font-medium">{event.title}</p>
                              {event.location && (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-muted">
```

- [ ] **Step 4: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/ReviewStep.tsx
git commit -m "feat: surface location as subtitle in review step"
```

---

### Task 4: ICS export — native location property

**Files:**
- Modify: `lib/generate-ics.ts`

**Interfaces:**
- Consumes: `DeadlineEvent.location: string` (Task 1). Sets it on the `ics` library's `EventAttributes.location?: string` field (confirmed present at `node_modules/ics/index.d.ts:95` — no new dependency, this is an existing optional field on the type this file already imports).

- [ ] **Step 1: Map `location` onto both ICS event branches**

In `lib/generate-ics.ts`, find:

```typescript
      if (event.time) {
        const [h, min] = event.time.split(":").map(Number);
        return {
          title: event.course ? `${event.course}: ${event.title}` : event.title,
          description: [event.course, event.notes].filter(Boolean).join(" — ") || undefined,
          start: [y, m, d, h, min] as [number, number, number, number, number],
          duration: { hours: 1 },
        };
      }

      return {
        title: event.title,
        description: event.notes || undefined,
        start: [y, m, d] as [number, number, number],
        duration: { days: 1 },
      };
```

Replace with (adds `location: event.location || undefined` to both branches — `ics` omits the `LOCATION:` line when the field is `undefined`):

```typescript
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/generate-ics.ts
git commit -m "feat: export location to ics LOCATION property"
```

---

### Task 5: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: starts on `http://localhost:3000` with no errors.

- [ ] **Step 2: Verify extraction and review display**

Paste a sample syllabus with a location mentioned, e.g.:

```
CS 101 Syllabus
Midterm Exam: March 15, 2026, 2:00 PM, Room 204, worth 25%
Final Exam: April 20, 2026, Testing Centre, worth 30%
Assignment 1 due February 1, 2026 at 11:59pm
```

Expected: three events extracted. The two exams show a location subtitle ("Room 204" and "Testing Centre" respectively, with the map-pin icon) under their titles in the review step; the assignment (no location mentioned) shows no subtitle.

- [ ] **Step 3: Verify editing**

Open the edit drawer for the assignment (no location) — confirm the Location field is present and empty, add "Moodle", save, confirm the subtitle now appears in the review list. Open the edit drawer for one of the exams — confirm the existing location pre-fills the input, clear it, save, confirm the subtitle disappears from the review list.

- [ ] **Step 4: Verify ICS export**

Export the calendar, open the downloaded `.ics` file in a text editor. Expected: `LOCATION:` lines present for events that have a location set, absent for events that don't (the assignment, if you cleared its location in Step 3).

- [ ] **Step 5: Run the full lint pass**

Run: `npm run lint`
Expected: clean (or only the same pre-existing unrelated issue in `ExportStep.tsx`/`generate-ics.ts` seen throughout prior sessions).

- [ ] **Step 6: Update the handoff doc**

In `docs/HANDOFF.md`, update feature 2's line: mark 2a (location field) as done, note 2b (multi-day exam windows) is still pending its own spec/plan.

- [ ] **Step 7: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: mark location field (2a) complete in handoff"
```

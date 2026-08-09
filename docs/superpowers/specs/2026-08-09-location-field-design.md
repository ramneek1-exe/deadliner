# Location Field — Design

Status: approved by user, pending spec review
Date: 2026-08-09

Part of feature 2 from `docs/HANDOFF.md` ("multi-day exam windows + location detection"), split into two independently-specced pieces per user decision. This spec covers **location detection only** (2a). Multi-day exam date ranges (2b) is a separate, larger spec to follow.

## Problem

The AI extraction prompt already captures freeform "additional context like location, topics covered, or special instructions" into the `notes` field, but never surfaces location distinctly. A student scanning the review table or an exported calendar event can't tell at a glance whether an exam is in a classroom, a testing centre, or online — they'd have to open notes and parse it out, if the AI happened to mention it there at all.

Goal: promote location to a first-class field — extracted, shown, editable, and exported — following the exact pattern already established by `weight`/`notes`/`course`.

## Decision

Add `location: string` (default `""`) to `DeadlineEvent`, applying to **all event types** (not Exam-only) — same generic-field pattern as `weight`/`notes`/`course`, avoiding type-conditional logic in the prompt, schema, and UI for no proven benefit.

### Schema/type changes

- `lib/types.ts` — `DeadlineEvent.location: string`.
- `lib/schemas.ts` — `aiEventSchema.location: z.string().default("")`.
- `app/api/parse/route.ts`:
  - `RESPONSE_JSON_SCHEMA`'s per-event object gains `location: { type: "string" }`, added to that object's `required` array (strict-mode rule: every property must be listed in `required`; empty string represents "not found," mirroring how `weight`/`notes` already work).
  - `SYSTEM_PROMPT` gains an instruction: extract location (room/building, testing centre, or online platform such as Moodle) if mentioned, otherwise empty string. The prompt's JSON shape example gets a `"location": "string"` line alongside the existing fields.

### UI changes

- `components/ReviewStep.tsx` — when `event.location` is non-empty, render it as a small subtitle under the event title (desktop table row and mobile card), using a location-pin icon from `lucide-react` (already a dependency, already used in this file) plus muted-color text — no new table column, no width pressure.
- `components/EditDrawer.tsx` — new "Location" text input in the edit form, positioned after "Course" (same position/pattern as the existing weight/course fields), included in the `handleSave` payload.

### Export changes

- `lib/generate-ics.ts` — when `event.location` is non-empty, set it on the `ics` library's native `EventAttributes.location` field (not appended to `description`) for both the timed-event and all-day-event branches. Calendar apps render `LOCATION:` as a distinct field.

## Data flow

Unchanged shape, one more field riding through the existing pipeline: AI extraction → Zod validation (defaults to `""` if the model omits it, though strict schema requires it be present) → `DeadlineEvent[]` → review/edit (user can add, correct, or clear it like any other field) → ICS export (`LOCATION:` property).

## Error handling

None needed. `location` is best-effort, same as `weight`/`notes`/`course` — an empty string is the common, valid case (most deadlines have no meaningful location), and never blocks parsing, review, or export.

## Testing

No automated test suite in this repo (consistent with feature 1). Manual verification:

- Paste a syllabus snippet mentioning a room, a testing centre, or an online platform (e.g. Moodle) for at least one deadline.
- Confirm the location is extracted and shown as a subtitle under that event's title in the review step (desktop and mobile).
- Confirm it's editable via the edit drawer (add one to an event that has none, clear one that has one).
- Export the `.ics` file and confirm a `LOCATION:` line is present for the event(s) with a location set, and absent for events without one.

## Out of scope

- Multi-day exam date ranges — separate spec (2b).
- Structured/categorized location (e.g. distinguishing "room" vs "testing centre" vs "online" as a type) — plain string only, per the approved design decision (Approach A over Approach C).
- No change to `lib/schemas.ts`'s date/time normalization logic, rate limiting, or file parsing.

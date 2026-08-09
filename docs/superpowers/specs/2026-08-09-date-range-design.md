# Multi-Day Exam Windows (Date Range) — Design

Status: approved by user, pending spec review
Date: 2026-08-09

Part of feature 2 from `docs/HANDOFF.md` ("multi-day exam windows + location detection"), piece 2b — the final piece; 2a (location field) shipped and is on `main`.

## Problem

Some deadlines aren't a single point in time — a testing-centre exam, an open-book quiz window, or a multi-day assignment drop period is open across a range of days and the student picks when within it to act. Manually tested with a real syllabus (`docs/HANDOFF.md`'s BIOL 220 sample: "Final Exam: available March 30 - April 3, 2026, Testing Centre"): the current single-date model extracts only one calendar entry, silently dropping the window — the student sees a single date, not the true availability period.

Goal: represent these as genuine multi-day spanning events, both in the review UI and in the exported `.ics` file.

## Decision

Add `endDate: string | null` to `DeadlineEvent`, alongside the existing `date` field. `null` (the default) means a normal single-day event — today's behavior, completely unchanged. A value means the event spans `date` (start) through `endDate` (end), inclusive.

This mirrors the existing `time: string | null` nullable-field pattern already used in this codebase, and is purely additive: no existing code path that reads `event.date` as a plain single-date string needs to change its assumption — `date` still means exactly what it always has (the start / the only date, for single-day events).

**Alternative considered and rejected:** replacing `date: string` with a `{start: string, end: string}` object, always representing a range (single-day = `start === end`). Rejected because it touches every existing read site (`ReviewStep`'s `formatDate`, `EditDrawer`'s date input, `generate-ics.ts`, `ExportStep`'s copy-as-text) for no benefit over an additive nullable field.

Applies to **all event types**, not Exam-only — same generic-field precedent as the location field (2a).

### Schema/type changes

- `lib/types.ts` — `DeadlineEvent.endDate: string | null`.
- `lib/schemas.ts` — `aiEventSchema.endDate`: same shape as the existing `time` field — `z.union([z.string().transform(normalizeDate), z.null()]).optional().default(null)`. Reuses the existing `normalizeDate` function (already handles multiple date formats), not `normalizeTime`.
- `app/api/parse/route.ts`:
  - `RESPONSE_JSON_SCHEMA`'s per-event object gains `endDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" }` (same pattern already used for `date`), added to that object's `required` array (strict-mode rule).
  - `SYSTEM_PROMPT` gains a "Date range handling" instruction: detect ranges expressed as "March 30 - April 3", "available Mar 30 through Apr 3", "window of April 8-10", etc. — output `date` as the range's start and `endDate` as the range's end (both `YYYY-MM-DD`); for a normal single-date deadline, `endDate` is `null`. The prompt's JSON shape example gets an `"endDate": "YYYY-MM-DD" | null` line.

### UI changes

- `components/ReviewStep.tsx` — when `event.endDate` is set, the date display renders as a range ("Mar 30 – Apr 3, 2026") instead of a single date, in both the desktop table and the mobile card. The existing inline click-to-edit date cell continues to edit only `date` (the start) — editing or clearing the end date requires opening the full edit drawer, keeping the inline quick-edit interaction simple.
- `components/EditDrawer.tsx` — new "End Date" input, optional, positioned directly after the existing "Date" input. Clearing it (empty value) sets `endDate` back to `null`, reverting the event to single-day.

### Export changes

- `lib/generate-ics.ts` — when `event.endDate` is set: generate an all-day event spanning `date` through `endDate` inclusive, using the `ics` library's `duration: { days: N }` where `N` is the inclusive day count between the two dates (mirrors the existing single-day all-day branch's `duration: { days: 1 }`, generalized). The `time` field is ignored for ranged events — per the approved design decision, spanning events always render as an all-day banner, never a timed multi-day span, regardless of whether specific open/close hours were mentioned in the source. If `endDate` is earlier than `date` (malformed AI or user-edited input), clamp to a 1-day event (treat as if `endDate` were absent) rather than producing a negative-duration event or letting the `ics` library error.

## Data flow

Unchanged shape, one more nullable field riding through the existing pipeline, following the exact same pattern as `time` (nullable, defaults to `null`, normalized via the shared date/time normalization helpers) and `location` (additive, no restructuring) before it.

## Error handling

- `endDate` before `date`: clamped to a 1-day event at export time (see above) — never crashes, never produces an invalid `.ics` file.
- All other error handling (extraction failure, validation failure, rate limiting, file-type/size validation) is unchanged from existing behavior — `endDate` participates in the existing strict-schema validation exactly like every other field, so a malformed `endDate` value fails the whole parse request cleanly (same fail-loud behavior established when the salvage fallback was removed in the parse-model-upgrade feature), rather than silently producing a bad range.

## Testing

No automated test suite in this repo (consistent with features 1 and 2a). Manual verification:

- Paste a syllabus snippet with a date-range window (e.g. the BIOL 220 sample already used to identify this gap: "Final Exam: available March 30 - April 3, 2026, Testing Centre").
- Confirm `endDate` is extracted and populated for the ranged item; confirm a normal single-date item in the same paste still gets `endDate: null`.
- Confirm the review step shows a date range for the ranged event, in both desktop and mobile views.
- Confirm the edit drawer's End Date field: editing it changes the range, clearing it reverts the event to single-day (range display disappears from review).
- Export the `.ics` file and confirm the ranged event has a multi-day span (`DTSTART`/`DTEND` covering the full range), not a single-day `DTSTART` + 1-day duration.

## Out of scope

- Timed multi-day spans (specific open/close hours) — always exported as an all-day banner, per the approved design decision.
- Any linking/grouping between events (not applicable here — this is a single event with a range, not two separate entries; the earlier "two entries" alternative was considered and explicitly rejected in favor of this spanning-event design).
- Inline (click-to-edit) editing of the end date in the review table — only available via the full edit drawer.
- No change to rate limiting, file parsing, or the location field (2a) shipped separately.

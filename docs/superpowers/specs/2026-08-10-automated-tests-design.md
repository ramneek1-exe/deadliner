# Automated Tests (Pure Logic) — Design

## Goal

Add an automated test suite covering the app's pure logic modules — the highest-value, lowest-effort testing surface, and the exact class of code where a real bug (multi-day ICS span logic) previously shipped and was only caught by manual/reviewer inspection.

## Scope

**In scope:** unit tests for `lib/date-range.ts`, `lib/generate-ics.ts`, `lib/schemas.ts`.

**Out of scope (explicitly deferred, not part of this pass):**
- `app/api/parse/route.ts` (would require mocking the OpenAI SDK)
- React components (would require jsdom + React Testing Library)
- Any new calendar-validity checks (e.g. rejecting Feb 30) — tests assert current behavior, they don't add new validation

## Framework

**Vitest**, added as a devDependency. Rationale: native ESM/TypeScript support, no Babel config, fast, and the project has no existing test infra to migrate away from.

`vitest.config.ts` at repo root:
- `resolve.alias`: `@` → repo root (matches the `@/*` path used throughout `lib/` and `components/`)
- `test.environment: "node"` (no DOM needed for pure-logic tests)

`package.json` scripts:
- `"test": "vitest run"` — single run, CI-style
- `"test:watch": "vitest"` — watch mode for local dev

## Test Files

Co-located next to the modules they test, matching the existing flat `lib/` layout:

### `lib/date-range.test.ts`
- `isValidDate`: valid `YYYY-MM-DD`, empty string, malformed string, out-of-range month (13), out-of-range day (32)
- `daysBetweenInclusive`: same date → 1, multi-day span, span crossing a month boundary, span crossing a year boundary
- `getSpanDays`: `endDate === null` → 1, invalid `endDate` → 1, `endDate === date` → 1, `endDate` before `date` → 1, valid forward range → correct day count
- `isMultiDayRange`: false at exactly 1 day, true at exactly 2 days (boundary), true for longer ranges

### `lib/generate-ics.test.ts`
- Single-day event (no time, no endDate) → all-day ICS entry
- Timed event (`time` set, no endDate) → 1-hour-duration ICS entry
- Multi-day range event → asserts the exclusive end date appears correctly in the generated ICS text (inspected via `blob.text()`), i.e. `endDate + 1 day`
- Event with an invalid `date` → silently filtered out, not present in output
- Optional fields (`location`, `notes`) → included when present, omitted when empty

### `lib/schemas.test.ts`
- `normalizeDate` (via `aiEventSchema` parse): already-correct `YYYY-MM-DD`, unpadded (`2026-1-30`), slash format (`2026/01/30`), prose date (`January 30, 2026`)
- `normalizeTime` (via `aiEventSchema` parse): already-correct `HH:mm`, AM/PM (`2:00 PM`), 12am/12pm edge cases, unpadded (`9:30`)
- `type` normalization: keyword mapping to `Exam` / `Assignment` / `Reading` / `Other`
- Defaults: `weight`, `notes`, `course`, `location`, `endDate` all default correctly when omitted from input

## Non-Goals

- No coverage threshold/enforcement tooling
- No CI workflow wiring (out of scope; can follow later)
- No mocking infrastructure (not needed since no external calls are tested)

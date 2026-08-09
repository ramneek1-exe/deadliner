# Parse Model Upgrade — Design

Status: approved by user, pending spec review
Date: 2026-08-09

## Problem

`app/api/parse/route.ts` calls `gpt-4o-mini` (text) and `gpt-4o` (vision), both released 2024, both using loose `response_format: { type: "json_object" }`. This is expensive relative to current-generation models and doesn't guarantee output shape, which is why the route carries a per-event "salvage" fallback for malformed responses.

Goal: cut cost and improve extraction reliability, without adding a second AI provider or restructuring the parse pipeline.

## Decision

Stay on OpenAI (single SDK, single `OPENAI_API_KEY`, minimal diff). Two changes to `app/api/parse/route.ts`:

1. **Model swap**, split by task difficulty (mirrors the current mini/full split):
   - Text path (PDF/DOCX/XLSX/pasted text) → `gpt-5.6-luna` — cheapest current tier, sufficient for a bounded, schema-enforced extraction task.
   - Image path (photos — skewed, blurry, sometimes handwritten) → `gpt-5.6-terra` — harder task, worth the accuracy margin over Luna. Still far cheaper than `gpt-4o`.

   Both model IDs verified against OpenAI's current model docs (fetched 2026-08-09): both support vision input and structured outputs via the Chat Completions API (the SDK/endpoint this route already uses — no migration to the Responses API needed).

2. **Structured output**: replace `response_format: { type: "json_object" }` with strict `{ type: "json_schema", json_schema: { name: "...", strict: true, schema: {...} } }`. The JSON schema mirrors the shape already documented in `SYSTEM_PROMPT` and validated by `aiEventSchema`/`aiResponseSchema` in `lib/schemas.ts`. Strict mode makes OpenAI enforce the output shape server-side before the response is returned.

## Data flow

Unchanged: extract text/image → call OpenAI → `JSON.parse` → Zod-validate (`aiResponseSchema`) → return `DeadlineEvent[]`. Zod validation stays as defense-in-depth even though strict mode should make shape mismatches rare.

## Removed: per-event salvage fallback

`route.ts` currently has a branch (~lines 299–334) that, when `aiResponseSchema.safeParse` fails on the full response, retries validation event-by-event and returns whatever subset is valid — silently dropping the rest.

This branch is removed. Rationale (discussed and confirmed with user):

- With strict JSON schema, the case it exists to handle (top-level parse succeeds, Zod validation fails) becomes rare — OpenAI enforces the schema before returning.
- The existing fallback's failure mode is worse than it looks: returning a partial event list without any indication that some events were dropped risks a student silently missing a deadline — the one thing this app exists to prevent.
- Without the branch, that same rare case falls through to the existing "no salvage possible" path and returns a clean `502` ("AI returned unexpected data format. Please try again."), which the user can act on.

All other existing error handling is untouched: API-call failure (502), empty response (502), `JSON.parse` failure (502), unsupported file type (400), oversized file (400), rate limiting (429).

## Testing

No existing automated test suite for this route. Manual verification:

- Upload a real PDF, DOCX, XLSX, pasted text, and a photo of a syllabus — confirm events + course name extract correctly on each path.
- Confirm unsupported-file-type (400) and oversized-file (400) paths are unaffected (code untouched).
- Spot-check per-request cost against Luna/Terra pricing via the OpenAI usage dashboard.

## Out of scope

- No change to `lib/schemas.ts` Zod types themselves (only how the JSON schema sent to OpenAI is derived/mirrored from them).
- No change to file parsing (`unpdf`/`mammoth`/`xlsx`), rate limiting, or any client-side code.
- No new environment variables.

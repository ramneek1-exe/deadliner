# Parse Model Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap `app/api/parse/route.ts` from `gpt-4o-mini`/`gpt-4o` with loose `json_object` mode to `gpt-5.6-luna`/`gpt-5.6-terra` with strict `json_schema` structured output, and remove the now-unnecessary per-event salvage fallback.

**Architecture:** Single-file change. No new files, no new dependencies, no new environment variables. Two OpenAI calls in `route.ts` (text path, image path) get new model strings and a shared strict JSON schema in place of `{ type: "json_object" }`. The Zod-validation-failure branch collapses from "salvage individual events" to a single clean 502.

**Tech Stack:** Next.js 16 App Router API route, `openai` SDK v6.x (`openai.chat.completions.create`, Chat Completions API — unchanged endpoint), `zod` for post-validation (unchanged).

## Global Constraints

- No new npm dependencies (spec: "Out of scope").
- No new environment variables — still only `OPENAI_API_KEY`.
- Model IDs, verified against OpenAI's current model docs (2026-08-09): `gpt-5.6-luna` (text path), `gpt-5.6-terra` (image path). Both support vision input and structured outputs via the Chat Completions API.
- All other error handling in `route.ts` (rate limiting, file-type/size validation, API-call failure, empty response, `JSON.parse` failure) stays untouched.
- No automated test suite exists in this repo (no jest/vitest in `package.json`, no test files) — verification in this plan is manual (dev server + real requests), matching the spec's own Testing section. Do not introduce a test framework as part of this change; that's out of scope.

---

### Task 1: Shared strict JSON schema + text-path model swap

**Files:**
- Modify: `app/api/parse/route.ts`

**Interfaces:**
- Produces: a module-level constant `RESPONSE_JSON_SCHEMA` (the OpenAI `json_schema.schema` object) that Task 2 also uses for the image-path call.
- Consumes: nothing new — mirrors the existing `aiEventSchema`/`aiResponseSchema` shapes from `lib/schemas.ts` (read-only reference, not imported — the JSON Schema sent to OpenAI is independent of the Zod schema used to validate the response afterward).

The strict schema mirrors `aiEventSchema`/`aiResponseSchema` field-for-field. OpenAI strict mode requires: every property present in `required`, `additionalProperties: false` on every object, and no `default` keyword (defaults are handled downstream by Zod's `.default()` after parsing — the model must always emit the field, using `""` for the empty-string defaults and `null` for the nullable `time` field).

- [ ] **Step 1: Add the shared JSON schema constant**

In `app/api/parse/route.ts`, add this constant after `SYSTEM_PROMPT` (currently ends at line 88) and before `extractTextFromPDF` (currently line 90):

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
          date: { type: "string" },
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

Note: `course` is intentionally omitted from the per-event schema — the existing code (`route.ts:341` and the salvage branch) always derives it from `e.course || courseName`, and the prompt never asks the model to fill in a per-event course name separately from the top-level `courseName`. Omitting it matches current behavior exactly (see Task 3, which keeps that fallback line).

- [ ] **Step 2: Swap the text-path model and response_format**

Find this block (currently `route.ts:262-270`):

```typescript
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text },
            ],
          });
        } catch {
```

Replace with:

```typescript
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-5.6-luna",
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "deadline_extraction",
                strict: true,
                schema: RESPONSE_JSON_SCHEMA,
              },
            },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text },
            ],
          });
        } catch {
```

- [ ] **Step 3: Swap the pasted-text-path model and response_format**

The text-input path (currently `route.ts:165-173`) uses the identical shape — apply the same two edits (`model` and `response_format`):

```typescript
      try {
        completion = await openai.chat.completions.create({
          model: "gpt-5.6-luna",
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "deadline_extraction",
              strict: true,
              schema: RESPONSE_JSON_SCHEMA,
            },
          },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text.trim() },
          ],
        });
      } catch {
```

- [ ] **Step 4: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors (existing `openai` types accept `json_schema` response_format — it's part of the SDK's published types).

- [ ] **Step 5: Commit**

```bash
git add app/api/parse/route.ts
git commit -m "feat: upgrade text-path parse model to gpt-5.6-luna with strict schema"
```

---

### Task 2: Image-path model swap

**Files:**
- Modify: `app/api/parse/route.ts`

**Interfaces:**
- Consumes: `RESPONSE_JSON_SCHEMA` from Task 1.

- [ ] **Step 1: Swap the image-path model and response_format**

Find this block (currently `route.ts:215-235`):

```typescript
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract all deadlines, due dates, exams, quizzes, assignments, readings, and other time-sensitive items from this syllabus image.",
                  },
                  {
                    type: "image_url",
                    image_url: { url: dataUrl },
                  },
                ],
              },
            ],
          });
        } catch {
```

Replace with:

```typescript
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-5.6-terra",
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "deadline_extraction",
                strict: true,
                schema: RESPONSE_JSON_SCHEMA,
              },
            },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract all deadlines, due dates, exams, quizzes, assignments, readings, and other time-sensitive items from this syllabus image.",
                  },
                  {
                    type: "image_url",
                    image_url: { url: dataUrl },
                  },
                ],
              },
            ],
          });
        } catch {
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/parse/route.ts
git commit -m "feat: upgrade image-path parse model to gpt-5.6-terra with strict schema"
```

---

### Task 3: Remove the per-event salvage fallback

**Files:**
- Modify: `app/api/parse/route.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: the response-parsing tail of the `POST` handler now has a single validation-failure exit instead of two.

- [ ] **Step 1: Replace the salvage branch with a clean failure path**

Find this block (currently `route.ts:299-335`, immediately after `const validated = aiResponseSchema.safeParse(parsed);`):

```typescript
    const validated = aiResponseSchema.safeParse(parsed);
    if (!validated.success) {
      // Try to salvage individual events if the top-level parse fails
      const rawEvents = Array.isArray(parsed?.events) ? parsed.events : [];
      if (rawEvents.length === 0) {
        console.error("AI validation failed:", validated.error.issues);
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI returned unexpected data format. Please try again." },
          { status: 502 }
        );
      }

      // Parse events individually, keeping valid ones
      const { aiEventSchema } = await import("@/lib/schemas");
      const courseName = typeof parsed?.courseName === "string" ? parsed.courseName : "Unknown Course";
      const salvaged: DeadlineEvent[] = [];
      for (const raw of rawEvents) {
        const result = aiEventSchema.safeParse(raw);
        if (result.success) {
          salvaged.push({
            ...result.data,
            id: crypto.randomUUID(),
            course: result.data.course || courseName,
          });
        }
      }

      if (salvaged.length === 0) {
        console.error("AI validation failed for all events:", validated.error.issues);
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI returned unexpected data format. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json<ParseResponse>({ events: salvaged, courseName });
    }

    const courseName = validated.data.courseName;
```

Replace with:

```typescript
    const validated = aiResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("AI validation failed:", validated.error.issues);
      return NextResponse.json<ParseErrorResponse>(
        { error: "AI returned unexpected data format. Please try again." },
        { status: 502 }
      );
    }

    const courseName = validated.data.courseName;
```

- [ ] **Step 2: Confirm `DeadlineEvent` import is still used**

`DeadlineEvent` is still referenced later in the same handler (`const events: DeadlineEvent[] = validated.data.events.map(...)`, currently `route.ts:338`), so the existing top-of-file import stays as-is — no import changes needed. Confirm by checking the import line still matches: `import type { DeadlineEvent, ParseResponse, ParseErrorResponse } from "@/lib/types";`.

- [ ] **Step 3: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors, no unused-import warnings.

- [ ] **Step 4: Commit**

```bash
git add app/api/parse/route.ts
git commit -m "refactor: remove per-event salvage fallback now that schema is strict"
```

---

### Task 4: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: starts on `http://localhost:3000` with no errors.

- [ ] **Step 2: Verify the text extraction path**

In the browser, open the app, use the "paste text" option, paste a short sample syllabus, e.g.:

```
CS 101 Syllabus
Midterm Exam: March 15, 2026, 2:00 PM, worth 25%
Assignment 1 due February 1, 2026 at 11:59pm
```

Expected: extraction succeeds, returns a course name (e.g. "CS 101") and two events — one `Exam` type with a weight, one `Assignment` type — with correctly formatted `date` (`YYYY-MM-DD`) and `time` (`HH:mm`).

- [ ] **Step 3: Verify the image extraction path**

Upload a photo or screenshot of a real (or sample) syllabus page containing at least one clear deadline.

Expected: extraction succeeds and returns at least one event with a plausible title/date.

- [ ] **Step 4: Verify untouched error paths still work**

Attempt to upload a file with an unsupported extension (e.g. a `.txt` file via the file-upload flow, not the paste-text flow).

Expected: `400` "Unsupported file type..." — confirms the file-type validation code (untouched by this change) still runs before any model call.

- [ ] **Step 5: Spot-check cost**

Check the OpenAI usage dashboard after the above requests. Expected: per-request cost visibly lower than historical `gpt-4o-mini`/`gpt-4o` costs, consistent with `gpt-5.6-luna` (~$0.20/$1.20 per MTok) and `gpt-5.6-terra` (~$2/$12 per MTok) pricing.

- [ ] **Step 6: Run the full lint pass**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Update the handoff doc**

In `docs/HANDOFF.md`, update the "Current initiative" section: mark item 1 (model upgrade) as done, with the final model IDs and date. This is the living status doc introduced this session — keep it current so a future session picks up correctly.

- [ ] **Step 8: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: mark parse model upgrade complete in handoff"
```

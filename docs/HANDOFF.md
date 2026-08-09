# Handoff — Deadliner

Living status doc. Update at start/end of each work session. Don't duplicate content that lives in specs/plans/commits — link instead.

## Project snapshot (2026-08-09)

- Next.js 16 (App Router) + React 19, syllabus PDF/DOCX/XLSX/image/text → AI-extracted deadlines → `.ics` export.
- Wizard: `upload` → `review` → `export`, state in `app/page.tsx`.
- Parse pipeline: `app/api/parse/route.ts` — text extraction (`unpdf`/`mammoth`/`xlsx`) or vision (images) → OpenAI (`gpt-5.6-luna` text, `gpt-5.6-terra` vision) → Zod validation (`lib/schemas.ts`) → `DeadlineEvent[]` (`lib/types.ts`).
- Rate limit: in-memory sliding window, 15 req/min/IP (resets on cold start — known limitation).
- Version drift: CLAUDE.md says v0.3.0, `package.json` still `0.1.0` — unreconciled, not yet addressed.
- Prior design work lives in `docs/plans/` (multi-file upload design + implementation, 2026-02-17).

## Current initiative: 3 requested features (2026-08-09)

Scoping via `superpowers:brainstorming` → spec → plan flow, one feature at a time.

1. **Model upgrade** — swap `gpt-4o`/`gpt-4o-mini` in `app/api/parse/route.ts` for a newer OpenAI model or an Anthropic model. Status: **done and user-verified (2026-08-09)**. `app/api/parse/route.ts` now uses `gpt-5.6-luna` (text paths: paste-text and document-extraction) and `gpt-5.6-terra` (image/vision path), both with strict `json_schema` structured output. Stale `gpt-4o`/`gpt-4o-mini` references also swept from README.md/CLAUDE.md/SPEC.md/Faq.tsx. User manually tested all paths including image upload — confirmed working. OpenAI usage-dashboard cost check not yet done — spot-check when convenient, not blocking.
2. **Multi-day exam windows + location detection** — support exams open across a date range (e.g. testing-centre style, student picks a slot) instead of single date/time; detect and surface exam location (classroom / testing centre / online-Moodle) if present in source. Touches `DeadlineEvent` shape (`lib/types.ts`), Zod schemas, parse prompt, review/export UI. Status: **both 2a and 2b code-complete (2026-08-09), pending a UI click-through pass on each before calling feature 2 fully done.**
   - **2a. Location field — code-complete, pending UI verification (2026-08-09).** `DeadlineEvent.location: string` added; extracted by AI (`gpt-5.6-luna`/`gpt-5.6-terra`, strict JSON schema, `location` in `required`), editable in the edit drawer, shown as a subtitle (map-pin icon) in the review step when non-empty, exported to `.ics` as a native `LOCATION:` property. Live curl verification against `/api/parse` confirmed extraction works correctly: exam events with a room/venue mentioned got a populated `location` ("Room 204", "Testing Centre"), the assignment with no location mentioned got `location: ""`. UI click-through (edit-drawer add/edit/clear, subtitle appearing/disappearing in review, exporting and inspecting `.ics` for `LOCATION:` lines) still needs a human pass before calling this fully done — only code-level review and API-level verification have been done so far, and that live verification only exercised the text path (`gpt-5.6-luna`); the image/vision path (`gpt-5.6-terra`) shares the identical JSON schema so it will be accepted by the API, but location extraction quality on a photographed syllabus hasn't actually been verified.
   - **2b. Multi-day exam date ranges — code-complete, pending UI verification (2026-08-09).** `DeadlineEvent.endDate: string | null` added; extracted by AI (strict JSON schema, nullable `endDate` with a date-pattern constraint), editable in the edit drawer, shown as a date range in the review step, exported to `.ics` as a genuine multi-day spanning event (`lib/generate-ics.ts`, `daysBetweenInclusive` + `duration: { days }`). Live curl verification against `/api/parse` (text path) confirmed extraction works correctly: a "March 30 - April 3, 2026" exam window got `date: "2026-03-30"` / `endDate: "2026-04-03"`, and a single-date assignment got `endDate: null`, confirming the live API accepts the new nullable/pattern-constrained schema field. UI click-through (drawer add/edit/clear of end date, range display in review, exporting and opening the `.ics` file to visually confirm the multi-day span) still needs a human pass — not yet done. Code-level review of the ICS day-count arithmetic (Task 4) and the edit-drawer/review-step wiring (Tasks 2-3) is complete.
3. **Optional guided onboarding tour** — opt-in walkthrough (corner CTA, e.g. "Wanna take a tour?") that highlights UI and tooltips step-by-step through the wizard. Flagged by user as needing the most design discussion. Status: not yet scoped.

## Next steps

- Brainstorm each feature to an approved spec under `docs/superpowers/specs/`, then `writing-plans` for implementation.
- Suggested skills for next session: `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:test-driven-development`, `frontend-design` (for feature 3 tour UI).

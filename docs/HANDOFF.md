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
2. **Multi-day exam windows + location detection** — support exams open across a date range (e.g. testing-centre style, student picks a slot) instead of single date/time; detect and surface exam location (classroom / testing centre / online-Moodle) if present in source. Touches `DeadlineEvent` shape (`lib/types.ts`), Zod schemas, parse prompt, review/export UI. Status: **done and user-verified (2026-08-09)** for the text path — 2a and 2b both merged, user confirmed the full UI flow (upload/paste → review → edit drawer → export) works. Vision-path (photo upload) extraction quality for location/date-range not yet verified — not blocking, spot-check when convenient.
   - **2a. Location field.** `DeadlineEvent.location: string` added; extracted by AI (`gpt-5.6-luna`/`gpt-5.6-terra`, strict JSON schema, `location` in `required`), editable in the edit drawer, shown as a subtitle (map-pin icon) in the review step when non-empty, exported to `.ics` as a native `LOCATION:` property.
   - **2b. Multi-day exam date ranges.** `DeadlineEvent.endDate: string | null` added; extracted by AI (strict JSON schema, nullable `endDate` with a date-pattern constraint), editable in the edit drawer, shown as a date range in the review step, exported to `.ics` as a genuine multi-day spanning event with a correct exclusive `DTEND` (`lib/generate-ics.ts`, via the shared `lib/date-range.ts` predicate also used by `ReviewStep`/`ExportStep` copy-as-text, so all three surfaces agree on what counts as a range).
3. **Optional guided onboarding tour** — opt-in walkthrough (corner CTA, e.g. "Wanna take a tour?") that highlights UI and tooltips step-by-step through the wizard. Flagged by user as needing the most design discussion. Status: not yet scoped.

## Next steps

- Brainstorm each feature to an approved spec under `docs/superpowers/specs/`, then `writing-plans` for implementation.
- Suggested skills for next session: `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:test-driven-development`, `frontend-design` (for feature 3 tour UI).

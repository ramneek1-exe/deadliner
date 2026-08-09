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

1. **Model upgrade** — swap `gpt-4o`/`gpt-4o-mini` in `app/api/parse/route.ts` for a newer OpenAI model or an Anthropic model. Status: **done (2026-08-09)**. `app/api/parse/route.ts` now uses `gpt-5.6-luna` (text paths: paste-text and document-extraction) and `gpt-5.6-terra` (image/vision path), both with strict `json_schema` structured output. Live-verified this session: text-paste path and file-upload (XLSX) text path both returned correct 200 responses; the untouched "unsupported file type" 400 error path still works. **Not verified this session** — no browser/real-photo access: the `gpt-5.6-terra` image/vision path, and the OpenAI usage-dashboard cost check. Verify both manually (upload a real photo, check the dashboard) before relying on the image path in production.
2. **Multi-day exam windows + location detection** — support exams open across a date range (e.g. testing-centre style, student picks a slot) instead of single date/time; detect and surface exam location (classroom / testing centre / online-Moodle) if present in source. Touches `DeadlineEvent` shape (`lib/types.ts`), Zod schemas, parse prompt, review/export UI. Status: not yet scoped.
3. **Optional guided onboarding tour** — opt-in walkthrough (corner CTA, e.g. "Wanna take a tour?") that highlights UI and tooltips step-by-step through the wizard. Flagged by user as needing the most design discussion. Status: not yet scoped.

## Next steps

- Brainstorm each feature to an approved spec under `docs/superpowers/specs/`, then `writing-plans` for implementation.
- Suggested skills for next session: `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:test-driven-development`, `frontend-design` (for feature 3 tour UI).

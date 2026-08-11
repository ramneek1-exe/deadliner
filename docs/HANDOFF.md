# Handoff — Deadliner

Living status doc. Update at start/end of each work session. Don't duplicate content that lives in specs/plans/commits — link instead.

## Project snapshot (2026-08-09)

- Next.js 16 (App Router) + React 19, syllabus PDF/DOCX/XLSX/image/text → AI-extracted deadlines → `.ics` export.
- Wizard: `upload` → `review` → `export`, state in `app/page.tsx`.
- Parse pipeline: `app/api/parse/route.ts` — text extraction (`unpdf`/`mammoth`/`xlsx`) or vision (images) → OpenAI (`gpt-5.6-luna` text, `gpt-5.6-terra` vision) → Zod validation (`lib/schemas.ts`) → `DeadlineEvent[]` (`lib/types.ts`).
- Rate limit: in-memory sliding window, 15 req/min/IP (resets on cold start — known limitation).
- Version: v0.4.0 across `package.json`, `README.md`, and `CLAUDE.md` (synced 2026-08-10, was drifted before).
- Prior design work lives in `docs/plans/` (multi-file upload design + implementation, 2026-02-17).

## Current initiative: 3 requested features (2026-08-09)

Scoping via `superpowers:brainstorming` → spec → plan flow, one feature at a time.

1. **Model upgrade** — swap `gpt-4o`/`gpt-4o-mini` in `app/api/parse/route.ts` for a newer OpenAI model or an Anthropic model. Status: **done and user-verified (2026-08-09)**. `app/api/parse/route.ts` now uses `gpt-5.6-luna` (text paths: paste-text and document-extraction) and `gpt-5.6-terra` (image/vision path), both with strict `json_schema` structured output. Stale `gpt-4o`/`gpt-4o-mini` references also swept from README.md/CLAUDE.md/SPEC.md/Faq.tsx. User manually tested all paths including image upload — confirmed working. OpenAI usage-dashboard cost check not yet done — spot-check when convenient, not blocking.
2. **Multi-day exam windows + location detection** — support exams open across a date range (e.g. testing-centre style, student picks a slot) instead of single date/time; detect and surface exam location (classroom / testing centre / online-Moodle) if present in source. Touches `DeadlineEvent` shape (`lib/types.ts`), Zod schemas, parse prompt, review/export UI. Status: **done and user-verified (2026-08-09)** for the text path — 2a and 2b both merged, user confirmed the full UI flow (upload/paste → review → edit drawer → export) works. Vision-path (photo upload) extraction quality for location/date-range not yet verified — not blocking, spot-check when convenient.
   - **2a. Location field.** `DeadlineEvent.location: string` added; extracted by AI (`gpt-5.6-luna`/`gpt-5.6-terra`, strict JSON schema, `location` in `required`), editable in the edit drawer, shown as a subtitle (map-pin icon) in the review step when non-empty, exported to `.ics` as a native `LOCATION:` property.
   - **2b. Multi-day exam date ranges.** `DeadlineEvent.endDate: string | null` added; extracted by AI (strict JSON schema, nullable `endDate` with a date-pattern constraint), editable in the edit drawer, shown as a date range in the review step, exported to `.ics` as a genuine multi-day spanning event with a correct exclusive `DTEND` (`lib/generate-ics.ts`, via the shared `lib/date-range.ts` predicate also used by `ReviewStep`/`ExportStep` copy-as-text, so all three surfaces agree on what counts as a range).
3. **Optional guided onboarding tour** — opt-in walkthrough (corner CTA, "Wanna take a tour?") that highlights UI and tooltips step-by-step through the wizard (`components/Tour.tsx`, `components/TourCTA.tsx`, `lib/tour-steps.ts`, wired in `app/page.tsx`). Status: **done, fixed, and re-verified (2026-08-10)**. Original Task 6 pass manually tested with a real browser (chrome-devtools MCP) at desktop (1280×800) and mobile (375×800) widths, confirming spotlight/backdrop display and copy at each stop, real click-through to the spotlighted target, cross-step continuity, mobile row-edit targeting the card layout, dismiss via X/Escape, restart-at-current-step, and missing-target resilience. Full notes in `.superpowers/sdd/2026-08-09-onboarding-tour/task-6-report.md`. Since then: the previously-known Tour/`TextPasteModal` z-index conflict was fixed via `createPortal(..., document.body)` on both `TextPasteModal.tsx` and `EditDrawer.tsx` — a plain z-index bump wasn't enough because the `animate-fade-in-up` animation's `fill-mode: both` creates a permanent CSS stacking context on the modal, which traps its z-index below the tour's overlay regardless of the numeric value; portaling to `document.body` escapes that stacking context entirely. A user-testing-found bug (CTA disappearing with no escape hatch once a tour target went missing mid-step, e.g. collapsing a course group during the Review tour) was fixed by having `Tour` report its own visibility via an `onVisibilityChange` callback instead of `app/page.tsx` re-deriving a partial copy of the same predicate — the old copy checked `wizardStep === step` but not whether the target was actually found (`!!rect`), so it could disagree with `Tour`'s own render guard. A subsequent static code review also caught and fixed two more issues: a below-fold tour target (e.g. `review-export-button` on a long list) could produce an unreadable, off-screen tooltip with no indication anything was wrong — now fixed with `scrollIntoView` on first measurement per stop plus an added upper clamp on `tooltipTop`. New, per explicit user request: the Upload-step CTA now only fades in once the dropzone scrolls into view (and fades back out if the user scrolls away), and tour copy no longer uses em-dashes.

This completes all 3 originally-requested features.

## Next steps

- OpenAI usage-dashboard cost check for the `gpt-5.6-luna`/`gpt-5.6-terra` swap — spot-check when convenient, not blocking.
- Vision-path (photo upload) extraction quality for location/date-range fields not yet verified — spot-check when convenient, not blocking.

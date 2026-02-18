# Deadliner

A Next.js app that converts course syllabi (PDF, DOCX, XLSX, images, pasted text) into `.ics` calendar files. Users upload up to 10 files, AI extracts deadlines grouped by course, and exports a single calendar file.

## Commands

- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS v4
- **AI:** OpenAI GPT-4o-mini (text), GPT-4o (images) via `openai` SDK
- **Parsing:** `pdf-parse`, `mammoth` (DOCX), `xlsx` (spreadsheets)
- **Validation:** `zod` schemas for AI responses
- **Fonts:** `geist` package — sans, mono, and pixel variants loaded in `app/layout.tsx`
- **Icons:** `geist-icons` (Vercel's icon set) — prefer these over lucide-react
- **Other:** `react-dropzone` (file uploads), `ics` (calendar generation)

## Architecture

### Wizard Flow
`upload` → `review` → `export` — managed in `app/page.tsx` via `useState`

### Key Files
- `app/page.tsx` — wizard state, events array, step routing
- `app/api/parse/route.ts` — multi-format file parsing + OpenAI extraction
- `lib/types.ts` — `DeadlineEvent`, `FileQueueItem`, `ParseResponse`
- `lib/schemas.ts` — Zod schemas (`aiEventSchema`, `aiResponseSchema`)
- `lib/generate-ics.ts` — ICS file generation with course prefixes
- `hooks/useScrollProgress.ts` — scroll-driven animation progress (0→1)

### Components
- `AppShell.tsx` — layout wrapper, switches between HeroHeader (upload) and compact header
- `HeroHeader.tsx` — scroll-animated hero with floating blurbs, logo, title centering formula
- `UploadStep.tsx` — multi-file queue with parallel processing (max 3 concurrent)
- `TextPasteModal.tsx` — modal for pasting syllabus text
- `ReviewStep.tsx` — events grouped by course, collapsible sections, inline editing
- `EditDrawer.tsx` — side drawer (desktop) / bottom sheet (mobile) for editing events
- `ExportStep.tsx` — download `.ics` with course-aware summary
- `StepIndicator.tsx` — step circles with labels (hidden on mobile in compact mode)
- `Logo.tsx` — inline SVG logo, uses `currentColor` for automatic dark mode
- `Faq.tsx` — collapsible FAQ section

## Coding Standards

- **Components:** Functional components with named exports
- **Styling:** Tailwind utility classes; inline styles only for dynamic/animated values
- **State:** `useState` for local state; `useRef` for mutable values in async callbacks (avoids stale closures)
- **Types:** Explicitly type all props and API responses
- **API Routes:** Next.js App Router (`app/api/.../route.ts`)
- **CSS Animations:** Wrap all `@keyframes` in `@layer base` in `globals.css` — Tailwind v4 purges keyframes not referenced by utility classes

## Error Handling

- Wrap all API calls in `try/catch`
- Display user-friendly error messages (e.g., "File too large")

## Known Patterns

- **Concurrent processing:** `useRef` for mutable processing count + `startProcessingRef` pattern to break circular dependency between `processItem` and `startProcessing`
- **Hero centering:** `translateX(calc(factor * (50vw - 50% - clamp(16px, 4vw, 24px))))` for scroll-driven center→left animation
- **Dark mode:** CSS variables in `:root` + `prefers-color-scheme: dark` media query; Logo uses `currentColor`
- **Mobile responsiveness:** `hidden sm:block/inline` for progressive disclosure; bottom-sheet drawer on mobile via CSS media queries

## Versioning

Current: **v0.3.0**

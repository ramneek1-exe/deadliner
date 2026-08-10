# Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An opt-in, corner-CTA-triggered guided tour that spotlights key UI on each wizard step (Upload, Review, Export), using the user's real data, continuing automatically as they progress through the real wizard.

**Architecture:** A declarative step list (`lib/tour-steps.ts`) drives a single overlay component (`components/Tour.tsx`) mounted once in `app/page.tsx`. Target elements get a `data-tour="<id>"` attribute; the overlay finds them via `document.querySelector`, no refs threaded through the component tree. Tour state (`tourActive`, `tourIndex`) is lifted into `app/page.tsx` next to the existing `step`/`events` state — matching this codebase's existing pattern of no Context, no external state library.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, `lucide-react` (already a dependency — no new package).

## Global Constraints

- No new npm dependencies.
- No new environment variables.
- No persistence — tour state is in-memory only (`useState`), resets on reload, consistent with the rest of this app (confirmed: no `localStorage`/`sessionStorage` anywhere in the codebase).
- No automated test suite in this repo — verification is manual.
- Visual style matches existing components: `rounded-lg border border-border bg-background`, `text-muted`, `hover:bg-foreground/5 transition-colors`, etc. — no new design language.
- Tour never auto-starts; always opt-in via the `TourCTA` button.
- Escape key and the tooltip's X button both dismiss; dismissing stops auto-advance for the rest of the session (no auto-resume on a later step).
- No Back button — linear, Next/Done only.

---

### Task 1: Tour step data

**Files:**
- Create: `lib/tour-steps.ts`

**Interfaces:**
- Produces: `TourStep` interface (`{ id: string, wizardStep: WizardStep, title: string, body: string }`) and `TOUR_STEPS: TourStep[]`, a flat ordered array of 7 entries. Tasks 3-5 import and consume this.

- [ ] **Step 1: Create the tour step data file**

Create `lib/tour-steps.ts` with this exact content:

```typescript
import type { WizardStep } from "@/lib/types";

export interface TourStep {
  id: string;
  wizardStep: WizardStep;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "upload-dropzone",
    wizardStep: "upload",
    title: "Drop your files here",
    body: "PDF, DOCX, XLSX, or an image all work — drag and drop, or click to browse.",
  },
  {
    id: "upload-paste",
    wizardStep: "upload",
    title: "Or paste text",
    body: "No file handy? Paste the syllabus text directly instead.",
  },
  {
    id: "review-course-header",
    wizardStep: "review",
    title: "Grouped by course",
    body: "Deadlines are grouped by course. Click the name to rename it, or the arrow to collapse a group.",
  },
  {
    id: "review-row-edit",
    wizardStep: "review",
    title: "Edit anything",
    body: "Click any date or time to edit it inline, or use the pencil icon for full details — location, notes, and more.",
  },
  {
    id: "review-export-button",
    wizardStep: "review",
    title: "Ready to export",
    body: "Once everything looks right, hit Export Calendar.",
  },
  {
    id: "export-primary-button",
    wizardStep: "export",
    title: "Add to your calendar",
    body: "Add straight to your calendar app — we detect Apple, Google, or desktop automatically.",
  },
  {
    id: "export-copy-text",
    wizardStep: "export",
    title: "Or copy as text",
    body: "Prefer plain text? Copy everything to paste into notes or a doc.",
  },
];
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/tour-steps.ts
git commit -m "feat: add onboarding tour step data"
```

---

### Task 2: `data-tour` attributes on the three wizard step components

**Files:**
- Modify: `components/UploadStep.tsx`
- Modify: `components/ReviewStep.tsx`
- Modify: `components/ExportStep.tsx`

**Interfaces:**
- Consumes: nothing (attribute values are plain string literals matching `TOUR_STEPS[*].id` from Task 1 — not imported, just kept in sync by convention since these are simple constant strings).
- Produces: DOM elements queryable by `Tour.tsx` (Task 3) via `document.querySelectorAll('[data-tour="<id>"]')`.

This task only adds attributes — no behavior changes to any of these three files.

- [ ] **Step 1: Add attributes to `UploadStep.tsx`**

Find the dropzone div:

```typescript
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 sm:p-16 transition-colors ${isFull
            ? "pointer-events-none border-border opacity-50"
            : isDragActive
              ? "border-foreground bg-foreground/5"
              : "border-border hover:border-foreground/50"
          }`}
      >
```

Replace with (adds `data-tour="upload-dropzone"`):

```typescript
      <div
        {...getRootProps()}
        data-tour="upload-dropzone"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 sm:p-16 transition-colors ${isFull
            ? "pointer-events-none border-border opacity-50"
            : isDragActive
              ? "border-foreground bg-foreground/5"
              : "border-border hover:border-foreground/50"
          }`}
      >
```

Find the paste button:

```typescript
        <button
          onClick={() => setShowTextModal(true)}
          disabled={isFull}
          className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted hover:border-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
        >
          <ClipboardPaste className="h-4 w-4" />
          Paste text instead
        </button>
```

Replace with (adds `data-tour="upload-paste"`):

```typescript
        <button
          onClick={() => setShowTextModal(true)}
          disabled={isFull}
          data-tour="upload-paste"
          className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted hover:border-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
        >
          <ClipboardPaste className="h-4 w-4" />
          Paste text instead
        </button>
```

- [ ] **Step 2: Add attributes to `ReviewStep.tsx`**

Find the course-groups map (adds a `courseIdx` index parameter, currently has none):

```typescript
        {Array.from(courseGroups.entries()).map(
          ([course, courseEvents]) => {
            const isCollapsed = collapsedCourses.has(course);
            const isEditing = editingCourseName === course;

            return (
              <div
                key={course}
                className="rounded-lg border border-border"
              >
                {/* Course header */}
                <div className="flex items-center gap-2 px-4 py-3">
```

Replace with (adds `courseIdx` and `data-tour` on the course header div):

```typescript
        {Array.from(courseGroups.entries()).map(
          ([course, courseEvents], courseIdx) => {
            const isCollapsed = collapsedCourses.has(course);
            const isEditing = editingCourseName === course;

            return (
              <div
                key={course}
                className="rounded-lg border border-border"
              >
                {/* Course header */}
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  data-tour={courseIdx === 0 ? "review-course-header" : undefined}
                >
```

Find the desktop table body map:

```typescript
                        <tbody>
                          {courseEvents.map((event) => (
                            <tr
                              key={event.id}
                              className="border-t border-border last:border-b-0"
                            >
```

Replace with (adds `eventIdx` and `data-tour` on the row — only the first course group's first row):

```typescript
                        <tbody>
                          {courseEvents.map((event, eventIdx) => (
                            <tr
                              key={event.id}
                              className="border-t border-border last:border-b-0"
                              data-tour={
                                courseIdx === 0 && eventIdx === 0
                                  ? "review-row-edit"
                                  : undefined
                              }
                            >
```

Find the mobile card map:

```typescript
                    <div className="flex flex-col gap-3 p-3 md:hidden">
                      {courseEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-lg border border-border p-4"
                        >
```

Replace with (same `eventIdx`/`data-tour` treatment for the mobile card — this is the second, independent `.map()` call over `courseEvents`, not the same one edited above):

```typescript
                    <div className="flex flex-col gap-3 p-3 md:hidden">
                      {courseEvents.map((event, eventIdx) => (
                        <div
                          key={event.id}
                          className="rounded-lg border border-border p-4"
                          data-tour={
                            courseIdx === 0 && eventIdx === 0
                              ? "review-row-edit"
                              : undefined
                          }
                        >
```

Find the Export Calendar button:

```typescript
        <button
          onClick={onExport}
          className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Export Calendar
        </button>
```

Replace with (adds `data-tour="review-export-button"` — unconditional, this button is rendered once, not inside any map):

```typescript
        <button
          onClick={onExport}
          data-tour="review-export-button"
          className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Export Calendar
        </button>
```

- [ ] **Step 3: Add attributes to `ExportStep.tsx`**

Find the three platform-conditional primary buttons (only one renders at a time, based on `platform` state — all three need the same `data-tour` value so whichever one is actually in the DOM is findable):

```typescript
        {platform === "ios" ? (
          <a href={blobUrl} className={linkClasses}>
            <AppleLogo className="h-4 w-4" />
            Add to Apple Calendar
          </a>
        ) : platform === "android" ? (
          <a href={blobUrl} className={linkClasses}>
            <GoogleCalendarLogo className="h-4 w-4" />
            Add to Google Calendar
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="#" onClick={handleDownload} className={linkClasses}>
            <Download className="h-4 w-4" />
            Download .ics
          </a>
        )}
```

Replace with (adds `data-tour="export-primary-button"` to all three):

```typescript
        {platform === "ios" ? (
          <a href={blobUrl} data-tour="export-primary-button" className={linkClasses}>
            <AppleLogo className="h-4 w-4" />
            Add to Apple Calendar
          </a>
        ) : platform === "android" ? (
          <a href={blobUrl} data-tour="export-primary-button" className={linkClasses}>
            <GoogleCalendarLogo className="h-4 w-4" />
            Add to Google Calendar
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="#" onClick={handleDownload} data-tour="export-primary-button" className={linkClasses}>
            <Download className="h-4 w-4" />
            Download .ics
          </a>
        )}
```

Find the copy-as-text button:

```typescript
        <button onClick={handleCopyText} className={secondaryClasses}>
          {copied ? (
            <CheckCircleFill className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy as text"}
        </button>
```

Replace with (adds `data-tour="export-copy-text"`):

```typescript
        <button onClick={handleCopyText} data-tour="export-copy-text" className={secondaryClasses}>
          {copied ? (
            <CheckCircleFill className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy as text"}
        </button>
```

- [ ] **Step 4: Verify the files compile**

Run: `npm run lint`
Expected: no new errors. `courseIdx` and `eventIdx` are used (not unused-var warnings) since they're read inside the `data-tour` expressions.

- [ ] **Step 5: Commit**

```bash
git add components/UploadStep.tsx components/ReviewStep.tsx components/ExportStep.tsx
git commit -m "feat: add data-tour attributes for onboarding tour targeting"
```

---

### Task 3: `Tour` overlay component

**Files:**
- Create: `components/Tour.tsx`

**Interfaces:**
- Consumes: `TOUR_STEPS` and `TourStep` from `lib/tour-steps.ts` (Task 1); `WizardStep` from `lib/types.ts`; the `data-tour` attributes added in Task 2.
- Produces: `Tour` component with props `{ step: WizardStep, active: boolean, index: number, onNext: () => void, onDismiss: () => void }`. Task 5 mounts this in `app/page.tsx`.

- [ ] **Step 1: Create the component**

Create `components/Tour.tsx` with this exact content:

```typescript
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { WizardStep } from "@/lib/types";
import { TOUR_STEPS } from "@/lib/tour-steps";

interface TourProps {
  step: WizardStep;
  active: boolean;
  index: number;
  onNext: () => void;
  onDismiss: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTourTarget(id: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of Array.from(candidates)) {
    if (el.offsetParent !== null) return el;
  }
  return null;
}

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 288;
const TOOLTIP_HEIGHT_ESTIMATE = 150;
const TOOLTIP_GAP = 12;
const VIEWPORT_MARGIN = 12;

export function Tour({ step, active, index, onNext, onDismiss }: TourProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const current = active ? TOUR_STEPS[index] : undefined;
  const isCurrentStopVisible = !!current && current.wizardStep === step;

  useEffect(() => {
    if (!isCurrentStopVisible || !current) {
      setRect(null);
      return;
    }

    function measure() {
      const el = findTourTarget(current!.id);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    // The target may not exist yet the instant this effect runs (e.g. async
    // parse results still loading) — poll lightly until it appears.
    const interval = setInterval(measure, 300);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(interval);
    };
  }, [isCurrentStopVisible, current]);

  useEffect(() => {
    if (!active) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, onDismiss]);

  if (!isCurrentStopVisible || !rect || !current) return null;

  const spotTop = rect.top - SPOTLIGHT_PADDING;
  const spotLeft = rect.left - SPOTLIGHT_PADDING;
  const spotWidth = rect.width + SPOTLIGHT_PADDING * 2;
  const spotHeight = rect.height + SPOTLIGHT_PADDING * 2;
  const spotBottom = spotTop + spotHeight;
  const spotRight = spotLeft + spotWidth;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - spotBottom;
  const placeBelow = spaceBelow > TOOLTIP_HEIGHT_ESTIMATE + TOOLTIP_GAP;
  const tooltipTop = placeBelow
    ? spotBottom + TOOLTIP_GAP
    : Math.max(VIEWPORT_MARGIN, spotTop - TOOLTIP_HEIGHT_ESTIMATE - TOOLTIP_GAP);
  const tooltipLeft = Math.min(
    Math.max(VIEWPORT_MARGIN, spotLeft),
    vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN
  );

  const stopsInStep = TOUR_STEPS.filter((s) => s.wizardStep === step);
  const positionInStep = stopsInStep.findIndex((s) => s.id === current.id) + 1;
  const isLastOverall = index === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Visual dark backdrop with a spotlight cutout — purely visual,
          pointer-events:none so it never blocks clicks itself. */}
      <div
        className="fixed z-[100] rounded-md transition-all duration-200"
        style={{
          top: spotTop,
          left: spotLeft,
          width: spotWidth,
          height: spotHeight,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          pointerEvents: "none",
        }}
      />

      {/* Click-blocking strips surrounding the spotlight rect. The
          spotlight rect itself has no blocker over it, so a real click on
          the highlighted element reaches it normally. */}
      <div
        className="fixed z-[100]"
        style={{ top: 0, left: 0, width: vw, height: Math.max(0, spotTop) }}
      />
      <div
        className="fixed z-[100]"
        style={{
          top: spotBottom,
          left: 0,
          width: vw,
          height: Math.max(0, vh - spotBottom),
        }}
      />
      <div
        className="fixed z-[100]"
        style={{ top: spotTop, left: 0, width: Math.max(0, spotLeft), height: spotHeight }}
      />
      <div
        className="fixed z-[100]"
        style={{
          top: spotTop,
          left: spotRight,
          width: Math.max(0, vw - spotRight),
          height: spotHeight,
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[101] rounded-lg border border-border bg-background p-4 shadow-lg"
        style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted">
            Step {positionInStep} of {stopsInStep.length}
          </p>
          <button
            onClick={onDismiss}
            className="rounded p-0.5 text-muted hover:text-foreground transition-colors"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-1.5 text-sm font-semibold text-foreground">{current.title}</h3>
        <p className="mt-1 text-sm text-muted">{current.body}</p>
        <button
          onClick={onNext}
          className="mt-3 w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          {isLastOverall ? "Done" : "Next"}
        </button>
      </div>
    </>
  );
}
```

Note on the four blocking-strip divs: they intentionally have no explicit `pointerEvents` style — a `position: fixed` div's default is `pointer-events: auto`, which is exactly what's needed to block clicks passing through them. Only the visual spotlight div needs the explicit `pointerEvents: "none"` override.

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/Tour.tsx
git commit -m "feat: add Tour overlay component"
```

---

### Task 4: `TourCTA` corner button

**Files:**
- Create: `components/TourCTA.tsx`

**Interfaces:**
- Produces: `TourCTA` component with a single prop `{ onStart: () => void }`. Task 5 mounts this in `app/page.tsx`.

- [ ] **Step 1: Create the component**

Create `components/TourCTA.tsx` with this exact content:

```typescript
"use client";

import { Compass } from "lucide-react";

interface TourCTAProps {
  onStart: () => void;
}

export function TourCTA({ onStart }: TourCTAProps) {
  return (
    <button
      onClick={onStart}
      className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-lg hover:bg-foreground/5 transition-colors"
    >
      <Compass className="h-4 w-4" />
      Wanna take a tour?
    </button>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/TourCTA.tsx
git commit -m "feat: add tour CTA button"
```

---

### Task 5: Wire tour state into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Tour` (Task 3), `TourCTA` (Task 4), `TOUR_STEPS`/`TourStep` (Task 1).

- [ ] **Step 1: Replace the full file**

Current `app/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { UploadStep } from "@/components/UploadStep";
import { Faq } from "@/components/Faq";
import { ReviewStep } from "@/components/ReviewStep";
import { ExportStep } from "@/components/ExportStep";
import type { WizardStep, DeadlineEvent } from "@/lib/types";

export default function Home() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [events, setEvents] = useState<DeadlineEvent[]>([]);

  const handleEventsExtracted = (extracted: DeadlineEvent[]) => {
    setEvents(extracted);
    setStep("review");
  };

  const handleReset = () => {
    setStep("upload");
    setEvents([]);
  };

  return (
    <AppShell step={step}>
      {step === "upload" && (
        <>
          <UploadStep onEventsExtracted={handleEventsExtracted} />
          <Faq />
        </>
      )}

      {step === "review" && (
        <ReviewStep
          events={events}
          onEventsChange={setEvents}
          onExport={() => setStep("export")}
          onReset={handleReset}
        />
      )}

      {step === "export" && (
        <ExportStep events={events} onReset={handleReset} />
      )}
    </AppShell>
  );
}
```

Replace with:

```typescript
"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { UploadStep } from "@/components/UploadStep";
import { Faq } from "@/components/Faq";
import { ReviewStep } from "@/components/ReviewStep";
import { ExportStep } from "@/components/ExportStep";
import { Tour } from "@/components/Tour";
import { TourCTA } from "@/components/TourCTA";
import { TOUR_STEPS } from "@/lib/tour-steps";
import type { WizardStep, DeadlineEvent } from "@/lib/types";

function firstTourIndexForStep(step: WizardStep): number {
  const idx = TOUR_STEPS.findIndex((s) => s.wizardStep === step);
  return idx === -1 ? 0 : idx;
}

export default function Home() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [events, setEvents] = useState<DeadlineEvent[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  const handleEventsExtracted = (extracted: DeadlineEvent[]) => {
    setEvents(extracted);
    setStep("review");
  };

  const handleReset = () => {
    setStep("upload");
    setEvents([]);
  };

  const handleTourStart = () => {
    setTourIndex(firstTourIndexForStep(step));
    setTourActive(true);
  };

  const handleTourNext = () => {
    const next = tourIndex + 1;
    if (next >= TOUR_STEPS.length) {
      setTourActive(false);
      return;
    }
    setTourIndex(next);
  };

  const handleTourDismiss = () => {
    setTourActive(false);
  };

  // Continuity: when the wizard step changes while the tour is running,
  // jump to that step's first stop so the tour follows the user forward.
  // Intentionally excludes tourActive from deps — handleTourStart already
  // sets the correct index when the tour starts; this effect only needs to
  // react to step changes.
  useEffect(() => {
    if (!tourActive) return;
    setTourIndex(firstTourIndexForStep(step));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <AppShell step={step}>
      {step === "upload" && (
        <>
          <UploadStep onEventsExtracted={handleEventsExtracted} />
          <Faq />
        </>
      )}

      {step === "review" && (
        <ReviewStep
          events={events}
          onEventsChange={setEvents}
          onExport={() => setStep("export")}
          onReset={handleReset}
        />
      )}

      {step === "export" && (
        <ExportStep events={events} onReset={handleReset} />
      )}

      {!tourActive && <TourCTA onStart={handleTourStart} />}
      <Tour
        step={step}
        active={tourActive}
        index={tourIndex}
        onNext={handleTourNext}
        onDismiss={handleTourDismiss}
      />
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire onboarding tour into wizard state"
```

---

### Task 6: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: starts on `http://localhost:3000` with no errors.

- [ ] **Step 2: Verify the Upload step tour**

Load the app. Confirm the "Wanna take a tour?" button appears bottom-right. Click it. Confirm: a dark backdrop appears with a spotlight cutout around the dropzone, a tooltip appears near it reading "Drop your files here" with "Step 1 of 2", clicking outside the spotlight does nothing (blocked), clicking Next shows the paste-button spotlight ("Step 2 of 2").

- [ ] **Step 3: Verify click-through and cross-step continuity**

With the tour still on the paste-button stop, actually paste some syllabus text (using the real "Paste text instead" button, which should still be clickable through the spotlight) and let it parse. Once you click "Review Deadlines" to advance to the Review step, confirm the tour automatically jumps to Review's first stop ("Grouped by course") without needing to click the CTA again.

- [ ] **Step 4: Verify the Review step tour on both desktop and mobile widths**

Step through Review's 3 stops at normal desktop browser width — confirm the course-header spotlight, then the first row's spotlight (date/time/pencil icon area), then the Export Calendar button spotlight. Resize the browser to a narrow/mobile width (or use dev tools device emulation) and repeat from the CTA — confirm the row-edit stop spotlights the mobile card layout, not the (now-hidden) desktop table.

- [ ] **Step 5: Verify Export step continuity and completion**

Click Export Calendar to reach the Export step (with the tour still running from Review). Confirm the tour auto-continues to Export's first stop. Step through both Export stops; confirm the final stop's button reads "Done" instead of "Next", and clicking it ends the tour (backdrop and tooltip disappear, CTA reappears).

- [ ] **Step 6: Verify dismiss behavior**

Restart the tour from the CTA. Partway through (e.g. on Review's second stop), click the X. Confirm the tour disappears and does NOT reappear automatically when you advance to Export. Confirm the CTA button is visible again. Click it — confirm the tour restarts at Export's first stop (the step you're currently on), not back at Upload.

- [ ] **Step 7: Verify Escape key and missing-target resilience**

Restart the tour, press Escape — confirm it dismisses same as clicking X. Restart the tour on Review, then delete every event (so `ReviewStep` shows its "No events remaining" empty state instead of the table) while a Review tour stop is active — confirm no crash and the overlay simply disappears rather than pointing at nothing.

- [ ] **Step 8: Run the full lint pass**

Run: `npm run lint`
Expected: clean, or only the same pre-existing unrelated issues seen throughout this repo's history (`ExportStep.tsx` react-hooks rule, `generate-ics.ts` unused var).

- [ ] **Step 9: Update the handoff doc**

In `docs/HANDOFF.md`, update feature 3's entry: mark it done, noting today's date and that it was manually verified end-to-end (desktop + mobile widths, click-through, cross-step continuity, dismiss, restart, Escape). Note this completes all 3 originally-requested features.

- [ ] **Step 10: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: mark onboarding tour (feature 3) complete in handoff"
```

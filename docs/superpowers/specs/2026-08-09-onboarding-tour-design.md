# Onboarding Tour — Design

Status: approved by user, pending spec review
Date: 2026-08-09

Feature 3 of 3 from `docs/HANDOFF.md` — the last originally-requested feature. Features 1 (model upgrade) and 2 (location + date ranges) are done, merged, and user-verified.

## Problem

Deadliner's wizard (Upload → Review → Export) is self-explanatory to a technical user but a first-time visitor — the target audience skews toward students who aren't power users — may not notice the "paste text instead" option, miss that dates/times are inline-editable, or not realize deadlines auto-group by course. An opt-in guided tour, triggered by a corner CTA, walks a new user through the key interactions on each step without forcing it on anyone who doesn't want it.

## Decision

**Architecture:** declarative step config + a single overlay component, no new dependency.

- `lib/tour-steps.ts` — a flat, ordered array of tour stops: `{ id: string, wizardStep: WizardStep, targetSelector: string, title: string, body: string }`. Each entry maps to exactly one element, found via `document.querySelector('[data-tour="<id>"]')`.
- Target elements in `UploadStep.tsx`, `ReviewStep.tsx`, `ExportStep.tsx` get a `data-tour="<id>"` attribute added — no other changes to those components' logic.
- `components/Tour.tsx` — one component, mounted once in `app/page.tsx` (rendered as a sibling alongside `AppShell`, positioned `fixed`, so it overlays regardless of which step is showing). It receives the current `step: WizardStep` and internally owns: whether the tour is active, and the index into the flat step array.
- `components/TourCTA.tsx` — the corner button ("Wanna take a tour?" / a compass-style icon once running), also mounted in `app/page.tsx`, always visible regardless of tour state so it can restart the tour at any time.

No Context, no new npm dependency. State lives in `app/page.tsx` next to the existing `step`/`events` state, following this codebase's existing pattern (everything lifted to the page component, passed down as props) rather than introducing a new state-management approach for one feature.

### Step 1: Tour state and continuity

`app/page.tsx` gains two pieces of state: `tourActive: boolean` (default `false`) and `tourIndex: number` (default `0`, an index into the flat `TOUR_STEPS` array from `lib/tour-steps.ts`).

- **Starting:** clicking `TourCTA` sets `tourActive = true` and `tourIndex` to the array index of the *first* tour step whose `wizardStep` matches the current `step`. This is also what "restart" does when clicked mid-tour or after a dismiss — always jumps to the current step's first stop, never literally back to Upload's first stop if the user is already on Review or Export. This satisfies the explicit requirement: clicking the CTA mid-flow "picks up from there and restarts from 0."
- **Advancing within a step:** the tooltip's "Next" button increments `tourIndex` by 1, as long as the next entry's `wizardStep` still matches the current `step`. Advancing is always explicit (a "Next" click) — the tour never auto-advances within a step just because the user interacted with the highlighted element (see Step 3 on click-through). This keeps the behavior predictable: every stop, the user reads and clicks Next, regardless of whether they also happened to act on the real element underneath.
- **Advancing across steps (continuity):** an effect watches the `step` prop. When `step` changes while `tourActive` is `true`, the effect sets `tourIndex` to the first `TOUR_STEPS` entry matching the new `step` — this is what makes the tour "continue" onto Review after a real upload completes, and onto Export after a real Export click, without the user re-clicking the CTA. This only fires forward (the wizard itself is one-way — there's no back-navigation in `app/page.tsx` to worry about).
- **Dismissing:** clicking the tooltip's X sets `tourActive = false`. `tourIndex` is left wherever it was — irrelevant, since the next start (via CTA) always recomputes it fresh from the current step. Dismissal is in-memory only; it doesn't persist across a page reload, consistent with the rest of this app (confirmed: no `localStorage`/`sessionStorage` anywhere in the codebase — every reload is already a fresh wizard).
- **Completion:** clicking "Next" on the last stop of the last step (`export`, "Copy as text") sets `tourActive = false` — same as dismissing, just reached by finishing rather than quitting.

### Step 2: The overlay (`components/Tour.tsx`)

When `tourActive` is true, on every render (and on `resize`/`scroll` events, and after a short delay following `step`/`tourIndex` changes to let the new step's DOM settle):

1. Look up the current stop's target: `document.querySelector('[data-tour="<id>"]')`. On `ReviewStep`, both the desktop table row and the mobile card exist in the DOM simultaneously (CSS `hidden md:block` / `md:hidden` toggles visibility) — where a tour stop applies to both, both elements share the same `data-tour` value, and the lookup picks the one that's actually visible (`el.offsetParent !== null`, filtered via `querySelectorAll` + `.find(...)`).
2. If no visible target is found (e.g., the user deleted every event mid-tour and `ReviewStep`'s empty state is showing instead of the table), the overlay renders nothing for this stop and quietly waits — no error, no broken spotlight pointing at empty space. Tour state is untouched, so if the target reappears (e.g., they add an event back) the overlay resumes normally.
3. Measure the target with `getBoundingClientRect()`.
4. Render two pieces, both `position: fixed`, `z-index` above everything else in the app (including `EditDrawer`'s `z-50` backdrop and `TextPasteModal`) — `z-[100]` or higher:
   - **Backdrop with cutout:** a full-viewport semi-transparent dark layer with a rectangular hole at the target's rect (implemented via a large `box-shadow` on a positioned div matching the target's rect, the standard spotlight technique — no SVG mask needed). The cutout region has `pointer-events: none` so clicks pass through to the real element underneath (per the approved interactivity decision); the rest of the backdrop has `pointer-events: auto` and blocks clicks (so the user can't accidentally interact with unrelated UI mid-tour).
   - **Tooltip card:** positioned adjacent to the target rect (above/below/beside depending on available viewport space — simple heuristic: prefer below, flip above if it would overflow the viewport bottom), showing the stop's `title`, `body`, a progress indicator ("Step 2 of 3"), a "Next" button (or "Done" on the final stop), and an X close button. Styled consistently with the app's existing card language (`rounded-lg border border-border bg-background`, matching `EditDrawer`/`ReviewStep`'s existing classes) rather than inventing a new visual style.

### Step 3: Click-through interactivity

The cutout's `pointer-events: none` means the user can genuinely act on the spotlighted element — drop a file while the dropzone is highlighted, click Export while the Export button is highlighted, etc. This is deliberate: the tour narrates real interactions rather than blocking them. As established in Step 1, doing so does not itself advance the tour stop — only "Next" does that — but if the action causes a real wizard-step transition (e.g., clicking "Review Deadlines" after uploading moves `step` from `"upload"` to `"review"`), the Step 1 continuity effect fires and the tour jumps to Review's first stop automatically, same as if they'd clicked Next through to the end of Upload's stops manually.

### Tour script (`lib/tour-steps.ts` content)

Only targets elements that exist regardless of app state — nothing that depends on data being present yet:

| Step | `wizardStep` | Target | Content |
|---|---|---|---|
| 1 | `upload` | Dropzone | "Drop your course outline here — PDF, DOCX, XLSX, or an image all work." |
| 2 | `upload` | "Paste text instead" button | "No file handy? Paste the syllabus text directly instead." |
| 3 | `review` | Course grouping header | "Deadlines are grouped by course. Click the name to rename it, or the arrow to collapse a group." |
| 4 | `review` | A table/card row | "Click any date or time to edit it inline, or use the pencil icon for full details — location, notes, and more." |
| 5 | `review` | Export Calendar button | "Once everything looks right, hit Export Calendar." |
| 6 | `export` | Primary "Add to Calendar" button | "Add straight to your calendar app — we detect Apple, Google, or desktop automatically." |
| 7 | `export` | "Copy as text" button | "Prefer plain text? Copy everything to paste into notes or a doc." |

For stops 3-5 (Review) and 6-7 (Export), the target only exists once real data reaches that step — which is fine, since by definition the tour only reaches those stops after the user has actually navigated there with real events.

## Error handling

- Missing target element (Step 2, point 2 above): overlay renders nothing, no crash, no dangling backdrop.
- Escape key closes the tour (same as clicking X) — cheap addition, standard modal/overlay convention.
- No focus trap, no ARIA live region — out of scope for a small opt-in visual aid on a side project; the tooltip's buttons are ordinary, keyboard-reachable buttons, which is sufficient here.

## Testing

No automated test suite in this repo (consistent with every prior feature). Manual verification: click the CTA on Upload, step through both Upload stops, upload a real file, confirm the tour auto-continues onto Review's first stop, step through Review's stops (checking both desktop-width and a narrow/mobile-width browser window for the row-targeting stop), click Export, confirm auto-continuation onto Export's stops, finish the tour. Separately: start the tour, click X partway through, confirm it stays dismissed through the rest of that step and the next; click the CTA again, confirm it restarts at the current step's first stop rather than back at Upload.

## Out of scope

- No persistence of "tour completed/dismissed" across page reloads (matches the rest of the app's statelessness).
- No back button within the tour — linear, Next/Skip only.
- No synthetic/demo data — the tour only ever shows the user's real data, per the approved design decision in brainstorming.
- No focus trap or full accessibility audit — a lightweight opt-in visual aid, not a modal dialog.

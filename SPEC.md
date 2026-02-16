# Project Specification: Deadliner

## 1. Project Overview

**Name:** Deadliner
**Description:** A privacy-focused, client-side utility that converts PDF course syllabi into downloadable `.ics` calendar files using AI.
**Target Audience:** University students who need to digitize their assignment schedules quickly.

## 2. Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (Strict mode)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **AI Provider:** OpenAI API (Model: `gpt-4o-mini`)
- **Key Libraries:**
  - `pdf-parse`: For server-side text extraction from PDFs.
  - `ics`: For generating the calendar file blob.
  - `react-dropzone`: For file upload UI.
  - `zod`: For schema validation.

## 3. Core Features (MVP)

### 3.1 File Ingestion

- **UI:** Central drag-and-drop zone.
- **Constraints:** Accept `.pdf` only. Max file size 5MB.
- **Process:** File is sent to Next.js API route (`/api/parse`) as FormData.

### 3.2 Intelligence Layer (Server-Side)

- **Input:** Raw text extracted from PDF via `pdf-parse`.
- **Processing:** OpenAI API call with `response_format: { type: "json_object" }`.
- **System Prompt Goal:** Extract deadlines into a strict JSON array.
- **Ambiguity Handling:** If year is missing, default to current year. If time is missing, set to null (all-day event).

### 3.3 Review Interface (Client-Side)

- **Display:** A responsive table/list showing: Event Title, Date, Time, Type (Exam/Assignment/Reading), Weight.
- **Interactivity:**
  - Users can **Edit** any field (fix AI typos).
  - Users can **Delete** rows (remove false positives).
  - "Export" button is disabled while scanning.

### 3.4 Export

- **Action:** Clicking "Export" generates a `.ics` file using the `ics` library.
- **Format:** Events set to "Floating" time (no specific timezone locked) to adapt to user's device.

## 4. Data Privacy Rules

- **No Database:** Do not set up a database (Postgres/MySQL).
- **Ephemeral:** PDF files and extracted data exist in memory/state only. Nothing is persisted to disk or cloud storage.

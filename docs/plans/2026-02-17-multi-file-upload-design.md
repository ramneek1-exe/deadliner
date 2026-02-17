# Multi-File Upload & Course Grouping Design

## Problem

Students get syllabi in various formats (PDF, DOCX, XLSX, images, text) and have multiple courses. The current single-PDF flow forces repetitive uploads with no course organization.

## Solution

Transform the upload step into a multi-file queue manager that accepts various formats, processes files in parallel, groups deadlines by AI-inferred course names, and exports everything as a single `.ics` file.

---

## Data Model

### Extended DeadlineEvent

```ts
interface DeadlineEvent {
  id: string;
  title: string;
  date: string;        // YYYY-MM-DD
  time: string | null;  // HH:mm or null
  type: EventType;
  weight: string;
  notes: string;
  course: string;       // NEW — AI-inferred, user-editable
}
```

### FileQueueItem (client-side only)

```ts
type FileItemStatus = "pending" | "processing" | "done" | "error";
type FileItemSource = "file" | "text";

interface FileQueueItem {
  id: string;
  source: FileItemSource;
  file?: File;
  text?: string;
  courseName: string;
  status: FileItemStatus;
  error?: string;
  events: DeadlineEvent[];
}
```

### API Response

```ts
interface ParseResponse {
  events: DeadlineEvent[];
  courseName: string;
}
```

---

## Upload Step

- Dropzone accepts: PDF, DOCX, XLSX, JPG, PNG, HEIC
- Max 10 files in queue
- "Add text" button opens a modal (textarea + course name input), adds to queue as `source: "text"`
- On drop: files added to queue with `status: "pending"`, then immediately processed (max 3 concurrent API calls)
- Each queue item shows: file type icon, filename, course name (editable inline), status indicator, remove button
- Errored items show message + "Retry" button
- "Review Deadlines" button enabled once at least one file is `done`; disabled while any are `processing`
- Summary line: "Found N deadlines across M courses"

---

## API Route (`/api/parse`)

### Input

- `type` field: `"file"` or `"text"`
- For files: `file` field (FormData)
- For text: `text` field + optional `courseName` field

### File Type Extractors

| Format | Method | Package |
|--------|--------|---------|
| PDF | Extract text | `pdf-parse` (existing) |
| DOCX | Extract raw text | `mammoth` (new) |
| XLSX | Convert sheets to text | `xlsx` (new) |
| JPG/PNG/HEIC | GPT-4o vision (base64) | `openai` (existing) |
| Text (paste) | Pass through | none |

### AI Prompt Changes

- For text-based formats: same prompt as current but requests `courseName` in JSON output
- For images: send base64 image to GPT-4o (not mini) with vision, same structured extraction prompt
- Response: `{ events: [...], courseName: "MATH 201" }`

---

## Review Step

- Deadlines grouped by course in collapsible sections (expanded by default)
- Section header: "MATH 201 — 8 deadlines" with edit course name button
- Desktop: table per course section
- Mobile: card list per course section
- Editing a course name updates all events in that group
- Edit drawer adds a "Course" dropdown/input field
- Summary: "We found N deadlines across M courses"
- Single "Export Calendar" button exports all courses into one `.ics`

---

## Export Changes

- `generate-ics.ts` receives all events (already has course field)
- Event description in `.ics` includes course name
- File named `deadlines-all-courses.ics`
- Export summary: "Exporting N events from M courses"

---

## Error Handling

- Per-file errors shown inline in queue (retry or remove)
- Image size limit: 10MB client-side
- File count limit: dropzone disabled at 10, shows message
- Partial success: proceed with successful files, errors don't block
- Empty results: "No deadlines found in this file"

---

## New Dependencies

- `mammoth` — DOCX to text extraction
- `xlsx` — spreadsheet to text extraction

## Accepted Formats

PDF, DOCX, XLSX, JPG, PNG, HEIC, pasted text

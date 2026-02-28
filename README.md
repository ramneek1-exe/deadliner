# Deadliner

**Turn your course syllabi into a calendar in seconds.**

Deadliner is a web app that reads your syllabus files — PDF, DOCX, XLSX, images, or pasted text — uses AI to extract every deadline, and exports them as a single `.ics` file you can import into any calendar app.

---

## Features

- **Multi-format ingestion** — PDF, DOCX, XLSX, JPEG, PNG, HEIC, and pasted text
- **AI extraction** — GPT-4o-mini for documents/text; GPT-4o vision for images
- **Multi-file support** — up to 10 files processed in parallel (max 3 concurrent)
- **Review & edit** — inspect, rename, delete, or edit individual events before exporting
- **Course grouping** — events are grouped by course; multiple files can share a course name
- **Export to any calendar** — downloads a `.ics` file compatible with Apple Calendar, Google Calendar, Outlook, and any other app that supports the iCalendar standard
- **Copy as text** — copy all deadlines as a plain-text list for pasting into notes or docs
- **Dark mode** — automatic via `prefers-color-scheme`
- **Mobile-friendly** — responsive layout with bottom-sheet editing and app-picker deep links

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/deadliner.git
cd deadliner

# 2. Install dependencies
npm install

# 3. Add your OpenAI key
cp .env.local.example .env.local
# then edit .env.local and set OPENAI_API_KEY

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key — used by the `/api/parse` route |

Create a `.env.local` file in the project root:

```env
OPENAI_API_KEY=sk-...
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## How It Works

Deadliner follows a three-step wizard:

```
Upload  →  Review  →  Export
```

### 1. Upload

Users drop files or paste syllabus text. Each file is processed independently and in parallel (max 3 concurrent). A course name is extracted automatically and can be edited. Multiple files can share a course name — their events will be merged into one group.

### 2. Parse (server-side)

Each file hits `POST /api/parse`:

1. **Text extraction** — PDF via `unpdf`, DOCX via `mammoth`, XLSX via `xlsx`
2. **Images** — sent directly to GPT-4o as base64 data URLs (vision)
3. **AI extraction** — GPT-4o-mini (text) or GPT-4o (images) with a structured JSON prompt
4. **Validation** — Zod schemas normalize dates, times, and event types; malformed events are salvaged individually rather than failing the whole response

### 3. Review

Events are grouped by course and displayed in a collapsible table (desktop) or card list (mobile). Users can:
- Edit any field inline (date, time) or via a full edit drawer
- Rename courses
- Delete events

### 4. Export

A `.ics` file is generated client-side using the `ics` library. Events with invalid dates are automatically skipped. The file can be:
- Downloaded directly (desktop)
- Opened with Apple Calendar or Google Calendar (mobile, via OS app picker)
- Opened with Outlook (mobile, via OS app picker; desktop, double-click the downloaded file)
- Copied as plain text to the clipboard

---

## Project Structure

```
deadliner/
├── app/
│   ├── page.tsx              # Wizard state, step routing
│   ├── layout.tsx            # Root layout, fonts, metadata
│   ├── globals.css           # CSS variables, keyframes, base styles
│   └── api/
│       └── parse/
│           └── route.ts      # File parsing + AI extraction endpoint
├── components/
│   ├── AppShell.tsx          # Layout wrapper, header switching
│   ├── HeroHeader.tsx        # Scroll-animated hero (upload step)
│   ├── UploadStep.tsx        # File queue, parallel processing
│   ├── TextPasteModal.tsx    # Modal for pasting syllabus text
│   ├── ReviewStep.tsx        # Course-grouped event table + editing
│   ├── EditDrawer.tsx        # Side drawer / bottom sheet for editing
│   ├── ExportStep.tsx        # Download, calendar deep links, copy as text
│   ├── StepIndicator.tsx     # Step circles with labels
│   ├── Logo.tsx              # Inline SVG logo (dark mode aware)
│   └── Faq.tsx               # Collapsible FAQ
├── lib/
│   ├── types.ts              # DeadlineEvent, FileQueueItem, ParseResponse
│   ├── schemas.ts            # Zod schemas for AI response validation
│   └── generate-ics.ts       # ICS file generation
├── hooks/
│   └── useScrollProgress.ts  # Scroll-driven animation (0→1)
└── public/
    ├── google-calendar.svg
    ├── outlook-logo.svg
    └── ...
```

---

## API Reference

### `POST /api/parse`

Extracts deadline events from a file or pasted text.

**Request** — `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `type` | `"file"` \| `"text"` | Input type (default: `"file"`) |
| `file` | `File` | The syllabus file (when `type=file`) |
| `text` | `string` | Raw syllabus text (when `type=text`) |

**Accepted file types**

| Format | MIME type | Max size |
|---|---|---|
| PDF | `application/pdf` | 5 MB |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 5 MB |
| XLSX / XLS | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | 5 MB |
| JPEG | `image/jpeg` | 10 MB |
| PNG | `image/png` | 10 MB |
| HEIC / HEIF | `image/heic`, `image/heif` | 10 MB |

**Response** — `200 OK`

```json
{
  "courseName": "CS 350",
  "events": [
    {
      "id": "uuid",
      "title": "Midterm Exam",
      "date": "2026-03-15",
      "time": "14:00",
      "type": "Exam",
      "weight": "25%",
      "notes": "Chapters 1–5, closed book",
      "course": "CS 350"
    }
  ]
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | Missing or invalid file / text |
| `422` | File could not be parsed (corrupt or image-based PDF) |
| `429` | Rate limit exceeded (15 requests / minute per IP) |
| `502` | OpenAI unavailable or returned invalid data |
| `500` | Unexpected server error |

**Rate limiting** — 15 requests per minute per IP address, enforced with an in-memory sliding-window counter. Resets after one minute.

---

## Data Model

### `DeadlineEvent`

```ts
interface DeadlineEvent {
  id: string;       // UUID, generated server-side
  title: string;    // Event name (e.g. "Assignment 3")
  date: string;     // YYYY-MM-DD
  time: string | null; // HH:mm (24-hour) or null for all-day events
  type: "Exam" | "Assignment" | "Reading" | "Other";
  weight: string;   // Grade weight if mentioned (e.g. "20%"), otherwise ""
  notes: string;    // Additional context from the syllabus
  course: string;   // Course name (e.g. "CS 350")
}
```

### `FileQueueItem`

Client-side tracking for the upload queue:

```ts
interface FileQueueItem {
  id: string;
  source: "file" | "text";
  file?: File;
  text?: string;
  courseName: string;   // Editable in the upload step; overrides AI-extracted name
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  events: DeadlineEvent[];
}
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4 |
| AI | OpenAI GPT-4o-mini (text), GPT-4o (images) |
| PDF parsing | `unpdf` |
| DOCX parsing | `mammoth` |
| XLSX parsing | `xlsx` |
| Schema validation | `zod` |
| Calendar generation | `ics` |
| File upload UI | `react-dropzone` |
| Icons | `geist-icons`, `lucide-react` |
| Fonts | `geist` (sans, mono) |
| Analytics | `@vercel/analytics`, `@vercel/speed-insights` |

---

## Deployment

The easiest way to deploy is [Vercel](https://vercel.com):

1. Push the repo to GitHub
2. Import the project in Vercel
3. Add `OPENAI_API_KEY` as an environment variable
4. Deploy

> **Note:** The in-memory rate limiter resets on every cold start. For production at scale, replace it with a Redis-backed solution (e.g. Upstash).

---

## Known Limitations

- **Rate limiting is in-memory** — resets on server restart; not suitable for multi-instance deployments without an external store
- **Image-based PDFs** — scanned PDFs without embedded text cannot be parsed as documents; upload as an image (JPEG/PNG) instead
- **AI accuracy** — dates and event names may be incorrect; always review before exporting
- **No persistence** — all data lives in the browser; refreshing the page resets the wizard

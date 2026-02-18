# Multi-File Upload & Course Grouping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Deadliner from a single-PDF uploader into a multi-file, multi-format queue that groups deadlines by course and exports a single `.ics` file.

**Architecture:** The upload step becomes a queue manager with per-file status tracking. Files are processed in parallel (max 3 concurrent) via the existing `/api/parse` route, which gains format-specific text extractors (PDF, DOCX, XLSX, images via GPT-4o vision, pasted text). The review step groups events by AI-inferred course names in collapsible sections.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, OpenAI (GPT-4o-mini for text, GPT-4o for images), pdf-parse, mammoth (new), xlsx (new), zod, ics, lucide-react

---

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install mammoth and xlsx**

Run:
```bash
npm install mammoth xlsx
```

**Step 2: Verify installation**

Run: `npm run build`
Expected: Clean build, no errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add mammoth and xlsx dependencies for multi-format support"
```

---

### Task 2: Update types

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add `course` field to `DeadlineEvent`, add `FileQueueItem`, update `ParseResponse`**

Replace the entire contents of `lib/types.ts` with:

```ts
export type EventType = "Exam" | "Assignment" | "Reading" | "Other";

export type WizardStep = "upload" | "review" | "export";

export interface DeadlineEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm or null for all-day
  type: EventType;
  weight: string;
  notes: string;
  course: string;
}

export interface ParseResponse {
  events: DeadlineEvent[];
  courseName: string;
}

export interface ParseErrorResponse {
  error: string;
}

// Client-side only — upload queue tracking
export type FileItemStatus = "pending" | "processing" | "done" | "error";
export type FileItemSource = "file" | "text";

export interface FileQueueItem {
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

**Step 2: Verify build**

Run: `npm run build`
Expected: Type errors in multiple files (expected — we haven't updated consumers yet). That's fine, we'll fix them in subsequent tasks. If build errors are ONLY about the missing `course` property, proceed.

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "Add course field to DeadlineEvent, add FileQueueItem type"
```

---

### Task 3: Update Zod schemas

**Files:**
- Modify: `lib/schemas.ts`

**Step 1: Add `courseName` to AI response schema, add `course` to event schema**

The `aiEventSchema` needs a `course` field (will be populated from the response-level `courseName`). The `aiResponseSchema` needs a `courseName` field.

In `lib/schemas.ts`, add a `course` field to `aiEventSchema`:

```ts
// After the existing notes field, add:
  course: z.string().default(""),
```

Update `aiResponseSchema` to:

```ts
export const aiResponseSchema = z.object({
  events: z.array(aiEventSchema),
  courseName: z.string().default("Unknown Course"),
});
```

**Step 2: Commit**

```bash
git add lib/schemas.ts
git commit -m "Add courseName to AI response schema"
```

---

### Task 4: Update API route — multi-format support

**Files:**
- Modify: `app/api/parse/route.ts`

This is the biggest backend change. The route needs to:
1. Accept both `type=file` and `type=text` inputs
2. Detect file format and extract text accordingly
3. For images, use GPT-4o vision instead of text extraction
4. Include `courseName` in the AI prompt and response
5. Return `{ events, courseName }`

**Step 1: Update the system prompt**

Add a `courseName` field to the expected JSON output in `SYSTEM_PROMPT`. Add this line to the JSON format section:

```
"courseName": "string — the course name/code extracted from the document (e.g., 'MATH 201', 'CS 350'). If not found, use 'Unknown Course'."
```

So the full JSON format in the prompt becomes:
```json
{
  "courseName": "string",
  "events": [...]
}
```

**Step 2: Add file type detection and text extraction functions**

Add these functions above the `POST` handler:

```ts
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

function isImageType(mime: string): boolean {
  return IMAGE_TYPES.has(mime);
}

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await pdf.getText();
  return result.text.trim();
}

async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value.trim();
}

async function extractTextFromXLSX(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      lines.push(`--- ${sheetName} ---`);
      lines.push(csv.trim());
    }
  }
  return lines.join("\n");
}

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const mime = file.type;

  if (mime === "application/pdf") {
    return extractTextFromPDF(buffer);
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractTextFromDOCX(buffer);
  }
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mime === "application/vnd.ms-excel") {
    return extractTextFromXLSX(buffer);
  }

  throw new Error(`Unsupported file type: ${mime}`);
}
```

**Step 3: Rewrite the POST handler**

Replace the entire `POST` function. The new handler:
- Checks for `type` field in FormData: `"file"` or `"text"`
- For `type=text`: reads `text` and optional `courseName` fields
- For `type=file`: validates MIME type, extracts text or handles image
- For images: sends base64 to GPT-4o vision
- For text: sends to GPT-4o-mini as before
- Returns `{ events, courseName }`

```ts
export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json<ParseErrorResponse>(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const inputType = (formData.get("type") as string) || "file";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let completion;

    if (inputType === "text") {
      // Handle pasted text
      const text = formData.get("text") as string;
      if (!text?.trim()) {
        return NextResponse.json<ParseErrorResponse>(
          { error: "No text provided." },
          { status: 400 }
        );
      }

      try {
        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
        });
      } catch {
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI service is currently unavailable. Please try again later." },
          { status: 502 }
        );
      }
    } else {
      // Handle file upload
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json<ParseErrorResponse>(
          { error: "No file provided." },
          { status: 400 }
        );
      }

      if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        return NextResponse.json<ParseErrorResponse>(
          { error: "Unsupported file type. Accepted: PDF, DOCX, XLSX, JPG, PNG, HEIC." },
          { status: 400 }
        );
      }

      const maxSize = isImageType(file.type) ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json<ParseErrorResponse>(
          { error: `File too large. Maximum size is ${isImageType(file.type) ? "10MB" : "5MB"}.` },
          { status: 400 }
        );
      }

      if (isImageType(file.type)) {
        // Image → GPT-4o vision
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const dataUrl = `data:${file.type};base64,${base64}`;

        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract all deadlines from this syllabus image." },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
          });
        } catch {
          return NextResponse.json<ParseErrorResponse>(
            { error: "AI service is currently unavailable. Please try again later." },
            { status: 502 }
          );
        }
      } else {
        // Document → extract text → GPT-4o-mini
        let text: string;
        try {
          text = await extractText(file);
        } catch {
          return NextResponse.json<ParseErrorResponse>(
            { error: "Could not extract text from this file. It may be corrupted or image-based." },
            { status: 422 }
          );
        }

        if (!text) {
          return NextResponse.json<ParseErrorResponse>(
            { error: "Could not extract text from this file. It may be empty." },
            { status: 422 }
          );
        }

        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: text },
            ],
          });
        } catch {
          return NextResponse.json<ParseErrorResponse>(
            { error: "AI service is currently unavailable. Please try again later." },
            { status: 502 }
          );
        }
      }
    }

    // Parse AI response (shared path for all input types)
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json<ParseErrorResponse>(
        { error: "AI returned an empty response. Please try again." },
        { status: 502 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json<ParseErrorResponse>(
        { error: "AI returned invalid data. Please try again." },
        { status: 502 }
      );
    }

    const validated = aiResponseSchema.safeParse(parsed);
    if (!validated.success) {
      // Try to salvage individual events
      const rawEvents = Array.isArray(parsed?.events) ? parsed.events : [];
      const courseName = typeof parsed?.courseName === "string" ? parsed.courseName : "Unknown Course";

      if (rawEvents.length === 0) {
        console.error("AI validation failed:", validated.error.issues);
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI returned unexpected data format. Please try again." },
          { status: 502 }
        );
      }

      const { aiEventSchema } = await import("@/lib/schemas");
      const salvaged: DeadlineEvent[] = [];
      for (const raw of rawEvents) {
        const result = aiEventSchema.safeParse(raw);
        if (result.success) {
          salvaged.push({
            ...result.data,
            id: crypto.randomUUID(),
            course: result.data.course || courseName,
          });
        }
      }

      if (salvaged.length === 0) {
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI returned unexpected data format. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json<ParseResponse>({ events: salvaged, courseName });
    }

    const courseName = validated.data.courseName;
    const events: DeadlineEvent[] = validated.data.events.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      course: e.course || courseName,
    }));

    return NextResponse.json<ParseResponse>({ events, courseName });
  } catch {
    return NextResponse.json<ParseErrorResponse>(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
```

**Step 4: Remove the old static `PDFParse` import at the top** since we now dynamically import it inside `extractTextFromPDF`. The top-level imports become:

```ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { aiResponseSchema } from "@/lib/schemas";
import type { DeadlineEvent, ParseResponse, ParseErrorResponse } from "@/lib/types";
```

**Step 5: Verify build**

Run: `npm run build`
Expected: May still have downstream type errors in components (missing `course` prop). The API route itself should compile cleanly.

**Step 6: Commit**

```bash
git add app/api/parse/route.ts
git commit -m "Support multi-format file parsing: PDF, DOCX, XLSX, images, text"
```

---

### Task 5: Update UploadStep — multi-file queue

**Files:**
- Rewrite: `components/UploadStep.tsx`
- Create: `components/TextPasteModal.tsx`

This is the largest frontend change. The component transforms from a single-file dropzone into a queue manager.

**Step 1: Create TextPasteModal**

Create `components/TextPasteModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface TextPasteModalProps {
  onAdd: (text: string, courseName: string) => void;
  onClose: () => void;
}

export function TextPasteModal({ onAdd, onClose }: TextPasteModalProps) {
  const [text, setText] = useState("");
  const [courseName, setCourseName] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), courseName.trim());
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-lg border border-border bg-background p-6"
          style={{ boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Paste Syllabus Text</h3>
            <button
              onClick={onClose}
              className="rounded-md p-2 hover:bg-foreground/5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Course Name
                <span className="ml-1 font-normal text-muted">(optional)</span>
              </label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. MATH 201"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Syllabus Text
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste your syllabus content here..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="flex-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Add to Queue
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-foreground/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

**Step 2: Rewrite UploadStep**

Replace the entire contents of `components/UploadStep.tsx`:

```tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Type,
  RotateCcw,
} from "lucide-react";
import { TextPasteModal } from "@/components/TextPasteModal";
import type { DeadlineEvent, FileQueueItem, ParseResponse } from "@/lib/types";

interface UploadStepProps {
  onEventsExtracted: (events: DeadlineEvent[]) => void;
}

const MAX_FILES = 10;
const MAX_CONCURRENT = 3;

const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

function getFileIcon(file?: File, source?: string) {
  if (source === "text") return <Type className="h-4 w-4 text-muted shrink-0" />;
  if (!file) return <FileText className="h-4 w-4 text-muted shrink-0" />;
  const mime = file.type;
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-muted shrink-0" />;
  if (mime.includes("spreadsheet") || mime.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-muted shrink-0" />;
  return <FileText className="h-4 w-4 text-muted shrink-0" />;
}

function getStatusIcon(status: FileQueueItem["status"]) {
  switch (status) {
    case "pending":
      return <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />;
    case "processing":
      return <Loader2 className="h-4 w-4 animate-spin text-muted shrink-0" />;
    case "done":
      return <CheckCircle className="h-4 w-4 text-accent shrink-0" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-danger shrink-0" />;
  }
}

export function UploadStep({ onEventsExtracted }: UploadStepProps) {
  const [queue, setQueue] = useState<FileQueueItem[]>([]);
  const [showTextModal, setShowTextModal] = useState(false);
  const processingCount = useRef(0);

  const processItem = useCallback(async (item: FileQueueItem) => {
    setQueue((q) =>
      q.map((i) => (i.id === item.id ? { ...i, status: "processing" } : i))
    );

    try {
      const formData = new FormData();

      if (item.source === "text") {
        formData.append("type", "text");
        formData.append("text", item.text!);
        if (item.courseName) formData.append("courseName", item.courseName);
      } else {
        formData.append("type", "file");
        formData.append("file", item.file!);
      }

      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setQueue((q) =>
          q.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: data.error || "Something went wrong." }
              : i
          )
        );
        return;
      }

      const response = data as ParseResponse;
      setQueue((q) =>
        q.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: "done",
                events: response.events,
                courseName: i.courseName || response.courseName,
              }
            : i
        )
      );
    } catch {
      setQueue((q) =>
        q.map((i) =>
          i.id === item.id
            ? { ...i, status: "error", error: "Network error. Check your connection." }
            : i
        )
      );
    } finally {
      processingCount.current--;
    }
  }, []);

  const startProcessing = useCallback(
    (items: FileQueueItem[]) => {
      for (const item of items) {
        if (processingCount.current >= MAX_CONCURRENT) break;
        if (item.status !== "pending") continue;
        processingCount.current++;
        processItem(item);
      }
    },
    [processItem]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      setQueue((prev) => {
        const remaining = MAX_FILES - prev.length;
        const toAdd = files.slice(0, remaining);
        const newItems: FileQueueItem[] = toAdd.map((file) => ({
          id: crypto.randomUUID(),
          source: "file" as const,
          file,
          courseName: "",
          status: "pending" as const,
          events: [],
        }));
        const updated = [...prev, ...newItems];

        // Start processing after state update
        setTimeout(() => startProcessing(updated), 0);
        return updated;
      });
    },
    [startProcessing]
  );

  const addText = useCallback(
    (text: string, courseName: string) => {
      setQueue((prev) => {
        if (prev.length >= MAX_FILES) return prev;
        const item: FileQueueItem = {
          id: crypto.randomUUID(),
          source: "text",
          text,
          courseName,
          status: "pending",
          events: [],
        };
        const updated = [...prev, item];
        setTimeout(() => startProcessing(updated), 0);
        return updated;
      });
    },
    [startProcessing]
  );

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const retryItem = useCallback(
    (id: string) => {
      setQueue((prev) => {
        const updated = prev.map((i) =>
          i.id === id ? { ...i, status: "pending" as const, error: undefined } : i
        );
        setTimeout(() => startProcessing(updated), 0);
        return updated;
      });
    },
    [startProcessing]
  );

  const updateCourseName = useCallback((id: string, name: string) => {
    setQueue((prev) =>
      prev.map((i) => (i.id === id ? { ...i, courseName: name } : i))
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    accept: ACCEPTED_TYPES,
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    disabled: queue.length >= MAX_FILES,
  });

  const doneItems = queue.filter((i) => i.status === "done");
  const processingItems = queue.filter((i) => i.status === "processing");
  const totalEvents = doneItems.reduce((sum, i) => sum + i.events.length, 0);
  const courseCount = new Set(doneItems.flatMap((i) => i.events.map((e) => e.course))).size;
  const canProceed = doneItems.length > 0 && processingItems.length === 0;

  const handleProceed = () => {
    const allEvents = doneItems.flatMap((item) =>
      item.events.map((e) => ({
        ...e,
        course: item.courseName || e.course,
      }))
    );
    onEventsExtracted(allEvents);
  };

  return (
    <div className="animate-fade-in-up">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 sm:p-16 transition-colors ${
          queue.length >= MAX_FILES
            ? "pointer-events-none border-border opacity-50"
            : isDragActive
              ? "border-foreground bg-foreground/5"
              : "border-border hover:border-foreground/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <Upload
            className={`h-8 w-8 sm:h-10 sm:w-10 ${
              isDragActive ? "text-foreground" : "text-muted"
            }`}
          />
          <div className="text-center">
            <p className="text-base sm:text-lg font-medium text-foreground">
              {queue.length >= MAX_FILES
                ? "Maximum files reached"
                : isDragActive
                  ? "Drop your files here"
                  : "Drop your syllabi here"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {queue.length >= MAX_FILES
                ? `${MAX_FILES} files maximum`
                : `or click to browse. PDF, DOCX, XLSX, or images. Up to ${MAX_FILES} files.`}
            </p>
          </div>
        </div>
      </div>

      {/* Paste text button */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={() => setShowTextModal(true)}
          disabled={queue.length >= MAX_FILES}
          className="text-sm text-muted hover:text-foreground transition-colors disabled:opacity-40"
        >
          + Paste text instead
        </button>
      </div>

      {/* Queue list */}
      {queue.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-col gap-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5"
              >
                {getFileIcon(item.file, item.source)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.source === "text"
                      ? "Pasted text"
                      : item.file?.name ?? "Unknown file"}
                  </p>
                  {item.status === "error" && item.error && (
                    <p className="text-xs text-danger mt-0.5">{item.error}</p>
                  )}
                  {item.status === "done" && item.events.length === 0 && (
                    <p className="text-xs text-muted mt-0.5">No deadlines found</p>
                  )}
                  {item.status === "done" && item.events.length > 0 && (
                    <p className="text-xs text-muted mt-0.5">
                      {item.events.length} deadline{item.events.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                {/* Editable course name */}
                {item.status === "done" && (
                  <input
                    type="text"
                    value={item.courseName}
                    onChange={(e) => updateCourseName(item.id, e.target.value)}
                    placeholder="Course name"
                    className="w-28 sm:w-36 rounded border border-border bg-background px-2 py-1 text-xs outline-none transition-colors focus:border-foreground"
                  />
                )}
                {getStatusIcon(item.status)}
                {item.status === "error" && (
                  <button
                    onClick={() => retryItem(item.id)}
                    className="rounded-md p-1.5 hover:bg-foreground/5 transition-colors"
                    title="Retry"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-muted" />
                  </button>
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  className="rounded-md p-1.5 hover:bg-foreground/5 transition-colors"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5 text-muted" />
                </button>
              </div>
            ))}
          </div>

          {/* Summary + proceed */}
          {doneItems.length > 0 && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted">
                Found{" "}
                <span className="font-medium text-foreground">{totalEvents} deadline{totalEvents !== 1 ? "s" : ""}</span>
                {courseCount > 0 && (
                  <>
                    {" "}across{" "}
                    <span className="font-medium text-foreground">{courseCount} course{courseCount !== 1 ? "s" : ""}</span>
                  </>
                )}
              </p>
              <button
                onClick={handleProceed}
                disabled={!canProceed}
                className="mt-4 rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {processingItems.length > 0 ? "Processing..." : "Review Deadlines"}
              </button>
            </div>
          )}
        </div>
      )}

      {showTextModal && (
        <TextPasteModal
          onAdd={addText}
          onClose={() => setShowTextModal(false)}
        />
      )}
    </div>
  );
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Should compile. Check for any remaining type errors.

**Step 4: Commit**

```bash
git add components/UploadStep.tsx components/TextPasteModal.tsx
git commit -m "Rewrite upload step: multi-file queue with text paste support"
```

---

### Task 6: Update page.tsx — accumulate events

**Files:**
- Modify: `app/page.tsx`

**Step 1: Update handleEventsExtracted**

The handler now receives all events from all processed files (already merged in UploadStep's `handleProceed`). No structural change needed — just accept the array. The `course` field is already present on each event.

The current code already works:
```tsx
const handleEventsExtracted = (extracted: DeadlineEvent[]) => {
  setEvents(extracted);
  setStep("review");
};
```

No changes needed to this file. The `DeadlineEvent` type already includes `course` from Task 2.

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build

---

### Task 7: Update ReviewStep — course grouping

**Files:**
- Modify: `components/ReviewStep.tsx`

**Step 1: Add course grouping logic and collapsible sections**

Replace the entire `components/ReviewStep.tsx` with:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { EditDrawer } from "@/components/EditDrawer";
import type { DeadlineEvent } from "@/lib/types";

interface ReviewStepProps {
  events: DeadlineEvent[];
  onEventsChange: (events: DeadlineEvent[]) => void;
  onExport: () => void;
  onReset: () => void;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string | null): string {
  if (!time) return "All day";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const TYPE_LABELS: Record<string, string> = {
  Exam: "Exam",
  Assignment: "Asst",
  Reading: "Read",
  Other: "Other",
};

function groupByCourse(events: DeadlineEvent[]): Map<string, DeadlineEvent[]> {
  const groups = new Map<string, DeadlineEvent[]>();
  for (const event of events) {
    const course = event.course || "Uncategorized";
    const group = groups.get(course) ?? [];
    group.push(event);
    groups.set(course, group);
  }
  return groups;
}

export function ReviewStep({
  events,
  onEventsChange,
  onExport,
  onReset,
}: ReviewStepProps) {
  const [editingEvent, setEditingEvent] = useState<DeadlineEvent | null>(null);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());
  const [editingCourseName, setEditingCourseName] = useState<string | null>(null);
  const [courseNameDraft, setCourseNameDraft] = useState("");

  const courseGroups = useMemo(() => groupByCourse(events), [events]);
  const courseCount = courseGroups.size;

  const toggleCourse = (course: string) => {
    setCollapsedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) next.delete(course);
      else next.add(course);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    onEventsChange(events.filter((e) => e.id !== id));
  };

  const handleSave = (updated: DeadlineEvent) => {
    onEventsChange(events.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEvent(null);
  };

  const startEditCourseName = (course: string) => {
    setEditingCourseName(course);
    setCourseNameDraft(course);
  };

  const saveCourseName = () => {
    if (!editingCourseName || !courseNameDraft.trim()) {
      setEditingCourseName(null);
      return;
    }
    onEventsChange(
      events.map((e) =>
        e.course === editingCourseName
          ? { ...e, course: courseNameDraft.trim() }
          : e
      )
    );
    setEditingCourseName(null);
  };

  if (events.length === 0) {
    return (
      <div className="animate-fade-in-up text-center py-16">
        <p className="text-lg font-medium">No events remaining</p>
        <p className="mt-1 text-sm text-muted">
          You&apos;ve removed all events.
        </p>
        <button
          onClick={onReset}
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm hover:bg-foreground/5 transition-colors"
        >
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          We found {events.length} deadline{events.length !== 1 ? "s" : ""}
          {courseCount > 1 && ` across ${courseCount} courses`}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Review, edit, or remove events before exporting.
        </p>
      </div>

      {/* Course groups */}
      <div className="flex flex-col gap-6">
        {Array.from(courseGroups.entries()).map(([course, courseEvents]) => {
          const isCollapsed = collapsedCourses.has(course);
          const isEditingName = editingCourseName === course;

          return (
            <div key={course} className="rounded-lg border border-border">
              {/* Course header */}
              <button
                onClick={() => toggleCourse(course)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted shrink-0" />
                )}
                {isEditingName ? (
                  <input
                    type="text"
                    value={courseNameDraft}
                    onChange={(e) => setCourseNameDraft(e.target.value)}
                    onBlur={saveCourseName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCourseName();
                      if (e.key === "Escape") setEditingCourseName(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold outline-none focus:border-foreground"
                  />
                ) : (
                  <span className="text-sm font-semibold">{course}</span>
                )}
                <span className="text-xs text-muted">
                  {courseEvents.length} deadline{courseEvents.length !== 1 ? "s" : ""}
                </span>
                {!isEditingName && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditCourseName(course);
                    }}
                    className="ml-auto rounded-md p-1.5 hover:bg-foreground/5 transition-colors"
                    title="Edit course name"
                  >
                    <Pencil className="h-3 w-3 text-muted" />
                  </button>
                )}
              </button>

              {/* Course events */}
              {!isCollapsed && (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-t border-border">
                          <th className="px-4 py-2.5 font-medium text-muted">Title</th>
                          <th className="px-4 py-2.5 font-medium text-muted">Date</th>
                          <th className="px-4 py-2.5 font-medium text-muted">Time</th>
                          <th className="px-4 py-2.5 font-medium text-muted">Type</th>
                          <th className="px-4 py-2.5 font-medium text-muted">Weight</th>
                          <th className="px-4 py-2.5 font-medium text-muted w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseEvents.map((event) => (
                          <tr
                            key={event.id}
                            className="border-t border-border last:border-0"
                          >
                            <td className="px-4 py-2.5 font-medium">{event.title}</td>
                            <td className="px-4 py-2.5 text-muted">{formatDate(event.date)}</td>
                            <td className="px-4 py-2.5 text-muted">{formatTime(event.time)}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block rounded border border-border px-2 py-0.5 text-xs text-muted">
                                {TYPE_LABELS[event.type] ?? event.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted">{event.weight || "\u2014"}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setEditingEvent(event)}
                                  className="rounded-md p-1.5 hover:bg-foreground/5 transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4 text-muted" />
                                </button>
                                <button
                                  onClick={() => handleDelete(event.id)}
                                  className="rounded-md p-1.5 hover:bg-danger/10 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4 text-danger" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="flex flex-col gap-3 p-3 md:hidden">
                    {courseEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-border p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{event.title}</p>
                            <p className="mt-1 text-sm text-muted">
                              {formatDate(event.date)} · {formatTime(event.time)}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-block rounded border border-border px-2 py-0.5 text-xs text-muted">
                                {TYPE_LABELS[event.type] ?? event.type}
                              </span>
                              {event.weight && (
                                <span className="text-xs text-muted">{event.weight}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-3">
                            <button
                              onClick={() => setEditingEvent(event)}
                              className="rounded-md p-2.5 hover:bg-foreground/5 transition-colors"
                            >
                              <Pencil className="h-4 w-4 text-muted" />
                            </button>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="rounded-md p-2.5 hover:bg-danger/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4 text-danger" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={onExport}
          className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Export Calendar
        </button>
        <button
          onClick={onReset}
          className="rounded-md border border-border px-4 py-2.5 text-sm text-muted hover:bg-foreground/5 transition-colors"
        >
          Start Over
        </button>
      </div>

      <EditDrawer
        event={editingEvent}
        onSave={handleSave}
        onClose={() => setEditingEvent(null)}
      />
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build

**Step 3: Commit**

```bash
git add components/ReviewStep.tsx
git commit -m "Add course-grouped review with collapsible sections"
```

---

### Task 8: Update EditDrawer — add course field

**Files:**
- Modify: `components/EditDrawer.tsx`

**Step 1: Add course input to EditForm**

In the `EditForm` component inside `EditDrawer.tsx`, add a `course` state and input field.

Add to the state declarations (after the `weight` state):
```tsx
const [course, setCourse] = useState(event.course);
```

Add `course` to the `handleSave` spread:
```tsx
const handleSave = () => {
  onSave({
    ...event,
    title,
    notes,
    date,
    time: time || null,
    type,
    weight,
    course,
  });
};
```

Add a course input field after the Weight field (before the closing `</div>` of the form fields container):

```tsx
<div>
  <label className="mb-1.5 block text-sm font-medium">Course</label>
  <input
    type="text"
    value={course}
    onChange={(e) => setCourse(e.target.value)}
    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
  />
</div>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build

**Step 3: Commit**

```bash
git add components/EditDrawer.tsx
git commit -m "Add course field to edit drawer"
```

---

### Task 9: Update ExportStep and generate-ics — course-aware export

**Files:**
- Modify: `lib/generate-ics.ts`
- Modify: `components/ExportStep.tsx`

**Step 1: Include course name in ICS event title/description**

In `lib/generate-ics.ts`, update the event mapping to include the course in the title:

Change the title line in both branches (timed and all-day):
```ts
title: event.course ? `${event.course}: ${event.title}` : event.title,
```

Also update the description to include the course:
```ts
description: [event.course, event.notes].filter(Boolean).join(" — ") || undefined,
```

Also update the filename:
```ts
a.download = "deadlines.ics";
```
Change to:
```ts
a.download = "deadlines-all-courses.ics";
```
(This change is in `ExportStep.tsx`)

**Step 2: Update ExportStep summary**

In `components/ExportStep.tsx`, make the summary course-aware:

```tsx
const courseCount = new Set(events.map((e) => e.course).filter(Boolean)).size;
```

Update the summary text:
```tsx
<p className="mt-2 text-sm text-muted">
  {events.length} event{events.length !== 1 ? "s" : ""}
  {courseCount > 1 && ` from ${courseCount} courses`}
  {" "}will be added to your calendar.
</p>
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Clean build

**Step 4: Commit**

```bash
git add lib/generate-ics.ts components/ExportStep.tsx
git commit -m "Course-aware ICS export with course names in event titles"
```

---

### Task 10: Update Faq component

**Files:**
- Modify: `components/Faq.tsx`

**Step 1: Update FAQ text**

Update the FAQ entries to reflect the new multi-file, multi-format capabilities. Key changes:
- "What file types are supported?" → mention PDF, DOCX, XLSX, images, pasted text
- "How many files can I upload?" → mention 10 file limit
- Update any references to "PDF only" or single-file behavior

Read the current FAQ content first and update accordingly.

**Step 2: Commit**

```bash
git add components/Faq.tsx
git commit -m "Update FAQ for multi-file multi-format support"
```

---

### Task 11: Final verification

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, zero errors

**Step 2: Manual test checklist**

Run: `npm run dev`

Test at http://localhost:3000:
- [ ] Drop a single PDF — processes, shows in queue with checkmark
- [ ] Drop multiple files at once — all process with spinners, then checkmarks
- [ ] "Paste text" modal opens, accepts text + course name, adds to queue
- [ ] Queue shows per-file status, editable course names
- [ ] "Review Deadlines" button appears after processing, click to proceed
- [ ] Review step shows events grouped by course in collapsible sections
- [ ] Can edit course name in section header
- [ ] Edit drawer has course field
- [ ] "Export Calendar" downloads `.ics` with course names in event titles
- [ ] Mobile (375px): queue items stack properly, bottom-sheet drawer works
- [ ] Start Over resets everything

**Step 3: Final commit**

```bash
git add -A
git commit -m "Multi-file upload with course grouping — complete"
```

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { aiResponseSchema } from "@/lib/schemas";
import type { DeadlineEvent, ParseResponse, ParseErrorResponse } from "@/lib/types";

// --- Rate Limiting (15 requests/min per IP, in-memory sliding window) ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const rateLimitMap = new Map<string, number[]>();
let requestCount = 0;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  requestCount++;

  // Periodic cleanup of stale entries
  if (requestCount % 100 === 0) {
    for (const [key, timestamps] of rateLimitMap) {
      const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (recent.length === 0) rateLimitMap.delete(key);
      else rateLimitMap.set(key, recent);
    }
  }

  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

const SYSTEM_PROMPT = `You are a syllabus parser. Extract all deadlines, due dates, exams, quizzes, assignments, readings, and other time-sensitive items from the provided syllabus text.

Rules:
- Only extract deadlines and due dates. Do NOT extract office hours, class policies, instructor info, or general course descriptions.
- For each deadline, extract: title, date, time (if specified), type, weight (if mentioned), and any relevant notes or details.

Date handling:
- Output date format: YYYY-MM-DD. You MUST always output dates in this format.
- Syllabi use many date formats — "Fri 30 Jan", "January 30", "1/30", "Jan 30, 2026", "Week 5", etc. Convert ALL of them to YYYY-MM-DD.
- If no year is specified, default to the current year (2026). For academic terms spanning two years, infer the correct year from context (e.g., a Winter 2026 term starting in January 2026).
- If only a day of the week is given with no date, skip that item.

Time handling:
- Output time format: HH:mm (24-hour). Convert AM/PM to 24-hour (e.g., "2:00 PM" → "14:00", "11:59pm" → "23:59").
- Pay attention to contextual time info that applies broadly. For example, if the syllabus says "all assignments are due by 11:59pm on the due date", then apply "23:59" as the time for every assignment deadline.
- If no specific time is mentioned or implied for an item, set time to null.

Type: must be one of "Exam", "Assignment", "Reading", "Other".
Weight: include if mentioned (e.g., "30%"), otherwise use empty string.
Notes: include any additional context like location, topics covered, or special instructions.

Respond with JSON only in this exact format:
{
  "courseName": "string — the course name/code extracted from the document (e.g., 'MATH 201', 'CS 350'). If not found, use 'Unknown Course'.",
  "events": [
    {
      "title": "string",
      "date": "YYYY-MM-DD",
      "time": "HH:mm" | null,
      "type": "Exam" | "Assignment" | "Reading" | "Other",
      "weight": "string",
      "notes": "string"
    }
  ]
}`;

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text).trim();
}

async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value.trim();
}

async function extractTextFromXLSX(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    parts.push(`--- ${sheetName} ---`);
    parts.push(XLSX.utils.sheet_to_csv(sheet));
  }
  return parts.join("\n");
}

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  switch (file.type) {
    case "application/pdf":
      return extractTextFromPDF(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractTextFromDOCX(buffer);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.ms-excel":
      return extractTextFromXLSX(buffer);
    default:
      throw new Error(`Unsupported file type: ${file.type}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json<ParseErrorResponse>(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json<ParseErrorResponse>(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    const inputType = (formData.get("type") as string) || "file";
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let completion;

    if (inputType === "text") {
      // --- Text input path ---
      const text = formData.get("text") as string;
      if (!text || !text.trim()) {
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
            { role: "user", content: text.trim() },
          ],
        });
      } catch {
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI service is currently unavailable. Please try again later." },
          { status: 502 }
        );
      }
    } else {
      // --- File input path ---
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return NextResponse.json<ParseErrorResponse>(
          { error: "No file provided." },
          { status: 400 }
        );
      }

      if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        return NextResponse.json<ParseErrorResponse>(
          { error: "Unsupported file type. Accepted: PDF, DOCX, XLSX, JPEG, PNG, HEIC." },
          { status: 400 }
        );
      }

      const isImage = IMAGE_TYPES.has(file.type);
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;
      const maxLabel = isImage ? "10MB" : "5MB";

      if (file.size > maxSize) {
        return NextResponse.json<ParseErrorResponse>(
          { error: `File too large. Maximum size is ${maxLabel}.` },
          { status: 400 }
        );
      }

      if (isImage) {
        // --- Image vision path ---
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
                  {
                    type: "text",
                    text: "Extract all deadlines, due dates, exams, quizzes, assignments, readings, and other time-sensitive items from this syllabus image.",
                  },
                  {
                    type: "image_url",
                    image_url: { url: dataUrl },
                  },
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
        // --- Document text extraction path ---
        let text: string;
        try {
          text = await extractText(file);
        } catch (err) {
          console.error("Text extraction failed:", err);
          return NextResponse.json<ParseErrorResponse>(
            { error: "Could not extract text from this file. It may be corrupted or empty." },
            { status: 422 }
          );
        }

        if (!text) {
          return NextResponse.json<ParseErrorResponse>(
            { error: "Could not extract text from this file. It may be image-based or empty." },
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

    // --- Shared response parsing ---
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
      // Try to salvage individual events if the top-level parse fails
      const rawEvents = Array.isArray(parsed?.events) ? parsed.events : [];
      if (rawEvents.length === 0) {
        console.error("AI validation failed:", validated.error.issues);
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI returned unexpected data format. Please try again." },
          { status: 502 }
        );
      }

      // Parse events individually, keeping valid ones
      const { aiEventSchema } = await import("@/lib/schemas");
      const courseName = typeof parsed?.courseName === "string" ? parsed.courseName : "Unknown Course";
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
        console.error("AI validation failed for all events:", validated.error.issues);
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

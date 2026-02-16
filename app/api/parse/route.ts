import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { aiResponseSchema } from "@/lib/schemas";
import type { DeadlineEvent, ParseResponse, ParseErrorResponse } from "@/lib/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json<ParseErrorResponse>(
        { error: "No file provided." },
        { status: 400 }
      );
    }
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json<ParseErrorResponse>(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json<ParseErrorResponse>(
        { error: "Only PDF files are accepted." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ParseErrorResponse>(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    let text: string;
    try {
      const pdf = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await pdf.getText();
      text = result.text.trim();
    } catch {
      return NextResponse.json<ParseErrorResponse>(
        { error: "Could not extract text from this PDF. It may be image-based or corrupted." },
        { status: 422 }
      );
    }

    if (!text) {
      return NextResponse.json<ParseErrorResponse>(
        { error: "Could not extract text from this PDF. It may be image-based or empty." },
        { status: 422 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let completion;
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
      const salvaged: DeadlineEvent[] = [];
      for (const raw of rawEvents) {
        const result = aiEventSchema.safeParse(raw);
        if (result.success) {
          salvaged.push({ ...result.data, id: crypto.randomUUID() });
        }
      }

      if (salvaged.length === 0) {
        console.error("AI validation failed for all events:", validated.error.issues);
        return NextResponse.json<ParseErrorResponse>(
          { error: "AI returned unexpected data format. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json<ParseResponse>({ events: salvaged });
    }

    const events: DeadlineEvent[] = validated.data.events.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
    }));

    return NextResponse.json<ParseResponse>({ events });
  } catch {
    return NextResponse.json<ParseErrorResponse>(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

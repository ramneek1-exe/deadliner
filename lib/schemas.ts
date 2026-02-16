import { z } from "zod";

/**
 * Normalize a date string to YYYY-MM-DD format.
 * Handles: "2026-1-30", "2026/01/30", "January 30, 2026", etc.
 * Returns the original string if parsing fails (let the AI retry or the user edit).
 */
function normalizeDate(val: string): string {
  // Already in correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  // Try padding single-digit month/day: "2026-1-30" → "2026-01-30"
  const dashParts = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashParts) {
    return `${dashParts[1]}-${dashParts[2].padStart(2, "0")}-${dashParts[3].padStart(2, "0")}`;
  }

  // Try JS Date parsing as fallback
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  return val;
}

/**
 * Normalize a time string to HH:mm format.
 * Handles: "2:00", "9:30", "14:00", "2:00 PM", "11:59pm", etc.
 */
function normalizeTime(val: string): string {
  // Already correct
  if (/^\d{2}:\d{2}$/.test(val)) return val;

  // Handle AM/PM: "2:00 PM", "11:59pm", "9:30 AM"
  const ampmMatch = val.match(/^(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const period = ampmMatch[3].toLowerCase();
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  // Handle missing leading zero: "9:30" → "09:30"
  const shortMatch = val.match(/^(\d{1,2}):(\d{2})$/);
  if (shortMatch) {
    return `${shortMatch[1].padStart(2, "0")}:${shortMatch[2]}`;
  }

  return val;
}

export const aiEventSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1).transform(normalizeDate),
  time: z
    .union([z.string().transform(normalizeTime), z.null()])
    .optional()
    .default(null),
  type: z
    .string()
    .transform((val) => {
      // Normalize common variations
      const lower = val.toLowerCase();
      if (lower.includes("exam") || lower.includes("quiz") || lower.includes("test") || lower.includes("midterm") || lower.includes("final")) return "Exam" as const;
      if (lower.includes("assign") || lower.includes("homework") || lower.includes("hw") || lower.includes("project") || lower.includes("paper") || lower.includes("essay") || lower.includes("lab") || lower.includes("report")) return "Assignment" as const;
      if (lower.includes("read")) return "Reading" as const;
      return "Other" as const;
    }),
  weight: z.string().default(""),
  notes: z.string().default(""),
});

export const aiResponseSchema = z.object({
  events: z.array(aiEventSchema),
});

export type AIEvent = z.infer<typeof aiEventSchema>;
export type AIResponse = z.infer<typeof aiResponseSchema>;

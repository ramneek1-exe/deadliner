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
}

export interface ParseResponse {
  events: DeadlineEvent[];
}

export interface ParseErrorResponse {
  error: string;
}

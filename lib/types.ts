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

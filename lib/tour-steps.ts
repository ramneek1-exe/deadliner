import type { WizardStep } from "@/lib/types";

export interface TourStep {
  id: string;
  wizardStep: WizardStep;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "upload-dropzone",
    wizardStep: "upload",
    title: "Drop your files here",
    body: "PDF, DOCX, XLSX, or an image all work (drag and drop, or click to browse).",
  },
  {
    id: "upload-paste",
    wizardStep: "upload",
    title: "Or paste text",
    body: "No file handy? Paste the syllabus text directly instead.",
  },
  {
    id: "review-course-header",
    wizardStep: "review",
    title: "Grouped by course",
    body: "Deadlines are grouped by course. Click the name to rename it, or the arrow to collapse a group.",
  },
  {
    id: "review-row-edit",
    wizardStep: "review",
    title: "Edit anything",
    body: "Click any date or time to edit it inline, or use the pencil icon for full details (location, notes, and more).",
  },
  {
    id: "review-export-button",
    wizardStep: "review",
    title: "Ready to export",
    body: "Once everything looks right, hit Export Calendar.",
  },
  {
    id: "export-primary-button",
    wizardStep: "export",
    title: "Add to your calendar",
    body: "Add straight to your calendar app; we detect Apple, Google, or desktop automatically.",
  },
  {
    id: "export-copy-text",
    wizardStep: "export",
    title: "Or copy as text",
    body: "Prefer plain text? Copy everything to paste into notes or a doc.",
  },
];

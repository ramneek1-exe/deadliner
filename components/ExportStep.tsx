"use client";

import { useCallback } from "react";
import { CheckCircle, Download } from "lucide-react";
import { generateICS } from "@/lib/generate-ics";
import type { DeadlineEvent } from "@/lib/types";

interface ExportStepProps {
  events: DeadlineEvent[];
  onReset: () => void;
}

export function ExportStep({ events, onReset }: ExportStepProps) {
  const handleDownload = useCallback(() => {
    const blob = generateICS(events);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deadlines.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [events]);

  return (
    <div className="animate-fade-in-up flex flex-col items-center py-12">
      <CheckCircle className="h-16 w-16 text-accent" strokeWidth={1.5} />

      <h2 className="mt-6 text-2xl font-bold tracking-tight">
        Your calendar is ready!
      </h2>
      <p className="mt-2 text-sm text-muted">
        {events.length} event{events.length !== 1 ? "s" : ""} will be added to
        your calendar.
      </p>

      <button
        onClick={handleDownload}
        className="mt-8 flex items-center gap-2 rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
      >
        <Download className="h-4 w-4" />
        Download .ics
      </button>

      <button
        onClick={onReset}
        className="mt-4 rounded-md border border-border px-4 py-2.5 text-sm text-muted hover:bg-foreground/5 transition-colors"
      >
        Start Over
      </button>
    </div>
  );
}

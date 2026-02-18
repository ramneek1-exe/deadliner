import { createEvents, type EventAttributes } from "ics";
import type { DeadlineEvent } from "@/lib/types";

export function generateICS(events: DeadlineEvent[]): Blob {
  const icsEvents: EventAttributes[] = events.map((event) => {
    const [y, m, d] = event.date.split("-").map(Number);

    if (event.time) {
      const [h, min] = event.time.split(":").map(Number);
      return {
        title: event.course ? `${event.course}: ${event.title}` : event.title,
        description: [event.course, event.notes].filter(Boolean).join(" — ") || undefined,
        start: [y, m, d, h, min] as [number, number, number, number, number],
        duration: { hours: 1 },
      };
    }

    return {
      title: event.title,
      description: event.notes || undefined,
      start: [y, m, d] as [number, number, number],
      duration: { days: 1 },
    };
  });

  const { error, value } = createEvents(icsEvents);

  if (error || !value) {
    throw new Error("Failed to generate calendar file.");
  }

  return new Blob([value], { type: "text/calendar" });
}

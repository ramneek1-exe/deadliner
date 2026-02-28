import { createEvents, type EventAttributes } from "ics";
import type { DeadlineEvent } from "@/lib/types";

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return !isNaN(y) && !isNaN(m) && !isNaN(d) && y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

export function generateICS(events: DeadlineEvent[]): Blob {
  const icsEvents: EventAttributes[] = events
    .filter((event) => isValidDate(event.date))
    .map((event) => {
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

  // ics returns an empty object {} (truthy) as error in some failure cases,
  // so check value directly rather than relying on error truthiness
  if (!value) {
    throw new Error("Failed to generate calendar file.");
  }

  return new Blob([value], { type: "text/calendar" });
}

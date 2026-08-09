import { createEvents, type EventAttributes } from "ics";
import type { DeadlineEvent } from "@/lib/types";

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return !isNaN(y) && !isNaN(m) && !isNaN(d) && y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

// Inclusive day count between two YYYY-MM-DD dates. Returns 1 for the same
// date. Callers must have already validated both dates with isValidDate.
function daysBetweenInclusive(startStr: string, endStr: string): number {
  const [ys, ms, ds] = startStr.split("-").map(Number);
  const [ye, me, de] = endStr.split("-").map(Number);
  const start = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diffDays + 1;
}

export function generateICS(events: DeadlineEvent[]): Blob {
  const icsEvents: EventAttributes[] = events
    .filter((event) => isValidDate(event.date))
    .map((event) => {
      const [y, m, d] = event.date.split("-").map(Number);

      const hasValidRange = event.endDate !== null && isValidDate(event.endDate);
      const spanDays = hasValidRange
        ? daysBetweenInclusive(event.date, event.endDate as string)
        : 1;

      if (spanDays >= 2) {
        // Ranged events are always all-day, per the multi-day window design
        // decision — time is ignored even if the source mentioned specific
        // open/close hours.
        return {
          title: event.title,
          description: event.notes || undefined,
          location: event.location || undefined,
          start: [y, m, d] as [number, number, number],
          duration: { days: spanDays },
        };
      }

      if (event.time) {
        const [h, min] = event.time.split(":").map(Number);
        return {
          title: event.course ? `${event.course}: ${event.title}` : event.title,
          description: [event.course, event.notes].filter(Boolean).join(" — ") || undefined,
          location: event.location || undefined,
          start: [y, m, d, h, min] as [number, number, number, number, number],
          duration: { hours: 1 },
        };
      }

      return {
        title: event.title,
        description: event.notes || undefined,
        location: event.location || undefined,
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

import { createEvents, type EventAttributes } from "ics";
import type { DeadlineEvent } from "@/lib/types";
import { isValidDate, getSpanDays } from "@/lib/date-range";

export function generateICS(events: DeadlineEvent[]): Blob {
  const icsEvents: EventAttributes[] = events
    .filter((event) => isValidDate(event.date))
    .map((event) => {
      const [y, m, d] = event.date.split("-").map(Number);
      const spanDays = getSpanDays(event.date, event.endDate);

      if (spanDays >= 2) {
        // Ranged events are always all-day, per the multi-day window design
        // decision — time is ignored even if the source mentioned specific
        // open/close hours. Use an exclusive end date (the day after
        // endDate) rather than `duration`, matching iCalendar all-day-event
        // semantics and giving calendar clients a real DTEND.
        const [ey, em, ed] = (event.endDate as string).split("-").map(Number);
        const endExclusive = new Date(ey, em - 1, ed + 1);
        return {
          title: event.title,
          description: event.notes || undefined,
          location: event.location || undefined,
          start: [y, m, d] as [number, number, number],
          end: [
            endExclusive.getFullYear(),
            endExclusive.getMonth() + 1,
            endExclusive.getDate(),
          ] as [number, number, number],
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
